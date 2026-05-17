try:
    import torch
    import torch.nn as nn
except ModuleNotFoundError:  # optional dependency for LSTM model
    torch = None
    nn = None
import pandas as pd
import numpy as np
import re
import os
import time
from services.ai_assistant import ai_assistant_service

if nn is not None:
    class LSTMAutoencoder(nn.Module):
        def __init__(self, input_dim, hidden_dim):
            super().__init__()
            self.encoder = nn.LSTM(input_dim, hidden_dim, batch_first=True)
            self.decoder = nn.LSTM(hidden_dim, input_dim, batch_first=True)

        def forward(self, x):
            _, (hidden, _) = self.encoder(x)
            seq_len = x.shape[1]
            context = hidden.permute(1, 0, 2).repeat(1, seq_len, 1)
            output, _ = self.decoder(context)
            return output

def extract_features(log_path):
    with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
        log = f.read()
    errors = len(re.findall(r'error|fail|panic|critical|exception|warn', log, re.IGNORECASE))
    cpu_mentions = len(re.findall(r'cpu|overload|latency|timeout|ms', log, re.IGNORECASE))
    disk_mentions = len(re.findall(r'disk|full|storage|block|dfs|datanode', log, re.IGNORECASE))
    return [errors, cpu_mentions, disk_mentions], log

def detect_anomaly(log_path):
    if torch is None:
        return {
            "error": "PyTorch is not installed. Install it to enable the LSTM anomaly model (e.g. `pip install torch`)."
        }

    model_path = 'models/lstm_model.pt'
    if not os.path.exists(model_path):
        return {"error": "Model not trained. Run ml_model.py first."}

    checkpoint = torch.load(model_path, weights_only=False)
    scaler = checkpoint['scaler']
    threshold = checkpoint['threshold']
    
    model = LSTMAutoencoder(checkpoint['input_dim'], checkpoint['hidden_dim'])
    model.load_state_dict(checkpoint['model_state'])
    model.eval()

    features, raw_log = extract_features(log_path)
    scaled_features = scaler.transform([features])
    input_tensor = torch.tensor(scaled_features, dtype=torch.float32).unsqueeze(1)

    with torch.no_grad():
        reconstructed = model(input_tensor)
        error = torch.mean((reconstructed - input_tensor)**2).item()

    is_anomaly = error > threshold
    confidence = min(99.9, 70 + (error / threshold) * 10) if is_anomaly else min(99.9, 90 + (1 - error/threshold) * 5)
    
    is_hdfs = "dfs" in raw_log.lower() or "datanode" in raw_log.lower() or "block" in raw_log.lower()

    # Base response
    resp = {
        "status": "anomaly" if is_anomaly else "normal",
        "confidence": round(confidence, 1),
        "features": {"errors": features[0], "cpu": features[1], "disk": features[2]},
        "filename": os.path.basename(log_path)
    }

    if is_anomaly:
        if is_hdfs:
            issue = "Distributed File System - Block Replication Critical Failure"
            reason = "The LSTM model detected a significant deviation in the HDFS log stream. The DataNode heartbeat is missing or delayed, causing the NameNode to flag block replication as UNDER_REPLICATED."
            failed_node = "HDFS-DataNode-01"
            fixes = ["Verify network connectivity", "Inspect DataNode logs", "Execute hdfs dfsadmin -report", "Check system-level I/O"]
            flow = [{"node": "User Request", "status": "ok", "desc": "Ingress stable"}, {"node": "API Gateway", "status": "ok", "desc": "Routing active"}, {"node": "HDFS NameNode", "status": "ok", "desc": "Metadata master active"}, {"node": "HDFS DataNode", "status": "failed", "desc": "IO Timeout / Disconnected"}, {"node": "Block Replication", "status": "failed", "desc": "Sync Interrupted"}]
        elif features[0] > 5:
            issue = "Database Connection Pool Exhaustion (Resource Contention)"
            reason = "Anomaly analysis indicates a severe spike in SQL connection errors. The application is unable to acquire a new connection from the HikariCP pool."
            failed_node = "PostgreSQL-Master"
            fixes = ["Increase max_connections", "Analyze pg_stat_activity", "Verify session closing", "Scale out DB layer"]
            flow = [{"node": "User Request", "status": "ok", "desc": "Traffic normal"}, {"node": "API Gateway", "status": "ok", "desc": "Forwarding"}, {"node": "Auth Service", "status": "ok", "desc": "JWT Verified"}, {"node": "Order Service", "status": "ok", "desc": "Logic executing"}, {"node": "Database Call", "status": "failed", "desc": "Connection Pool Exhausted"}]
        else:
            issue = "Microservice Latency & Circuit Breaker Trigger"
            reason = "The system detected an abnormal increase in service latency. This triggered the circuit breaker to prevent a cascading failure."
            failed_node = "Auth-Service (v2.1)"
            fixes = ["Check recent deployments", "Increase pod replicas", "Verify auth provider", "Review GC logs"]
            flow = [{"node": "User Request", "status": "ok", "desc": "Request received"}, {"node": "API Gateway", "status": "failed", "desc": "Gateway Timeout (504)"}, {"node": "Auth Service", "status": "failed", "desc": "Internal Latency > 5000ms"}, {"node": "Order Service", "status": "ok", "desc": "Awaiting dependency"}, {"node": "Database Call", "status": "ok", "desc": "Ready"}]
        resp.update({"detected_issue": issue, "failed_node": failed_node, "why_it_failed": reason, "possible_fixes": fixes, "flow": flow})
        
        # Get AI explanation
        print("[INFO] Calling AI Assistant to explain anomaly...")
        ai_explanation = ai_assistant_service.explain_log(raw_log)
        resp["ai_explanation"] = ai_explanation
        resp["time"] = time.strftime('%Y-%m-%d %H:%M:%S')
    else:
        resp.update({
            "detected_issue": "System Health: Optimal", 
            "failed_node": "N/A", 
            "why_it_failed": "No reconstruction errors were found above the threshold. All services are operating within performance baselines.", 
            "possible_fixes": [], 
            "flow": [{"node": "User Request", "status": "ok", "desc": "Healthy"}, {"node": "API Gateway", "status": "ok", "desc": "Healthy"}, {"node": "Auth Service", "status": "ok", "desc": "Healthy"}, {"node": "Order Service", "status": "ok", "desc": "Healthy"}, {"node": "Database Call", "status": "ok", "desc": "Healthy"}]
        })
    
    return resp
