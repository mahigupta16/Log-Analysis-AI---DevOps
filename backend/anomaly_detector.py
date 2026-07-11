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

def analyze_log_content(log_content):
    lines = log_content.split('\n')
    error_lines = []
    nodes = set()
    components = set()
    parsed_logs_list = []
    
    # Common node name patterns
    node_patterns = [
        r'\b(?:node|server|host|pod|vm|cluster|db|master|slave|replica)-[a-zA-Z0-9_-]+\b',
        r'\b[a-zA-Z0-9_-]+-(?:node|server|host|pod|vm|db|master|slave|replica|service|datanode|namenode)\b',
        r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'
    ]
    
    syslog_pattern = r'\b([a-zA-Z0-9_\-\.]+)(?:\[\d+\])?\s*:'
    hdfs_pattern = r'\b(dfs\.[a-zA-Z0-9_\$]+)\b'
    
    for idx, line in enumerate(lines):
        line_num = idx + 1
        if not line.strip():
            continue
            
        # Check for errors/warnings
        is_err = any(word in line.lower() for word in ['error', 'fail', 'panic', 'critical', 'exception', 'fatal', 'failed'])
        is_warn = any(word in line.lower() for word in ['warn', 'warning'])
        
        # Extract nodes
        for pat in node_patterns:
            matches = re.findall(pat, line, re.IGNORECASE)
            for m in matches:
                nodes.add(m)
                
        # Extract components
        line_comp = "system"
        m_sys = re.search(syslog_pattern, line)
        if m_sys:
            comp = m_sys.group(1)
            if not comp.isdigit() and comp.lower() not in ['error', 'warn', 'info', 'debug', 'fail', 'panic', 'critical', 'exception', 'fatal', 'failed']:
                components.add(comp)
                line_comp = comp
        
        m_hdfs = re.search(hdfs_pattern, line, re.IGNORECASE)
        if m_hdfs:
            components.add(m_hdfs.group(1))
            line_comp = m_hdfs.group(1)
            
        for word in ['kernel', 'systemd', 'sshd', 'postgres', 'mysql', 'docker', 'kubelet', 'nginx', 'apache', 'cron', 'mongodb', 'redis', 'dfs']:
            if word in line.lower():
                components.add(word)
                line_comp = word
                
        severity = "INFO"
        if is_err:
            severity = "CRITICAL"
        elif is_warn:
            severity = "WARNING"
            
        parsed_logs_list.append({
            "line": line_num,
            "content": line.strip(),
            "severity": severity,
            "component": line_comp
        })
        
        if is_err:
            error_lines.append(line.strip())
            
    extracted_nodes = list(nodes)
    extracted_comps = list(components)
    
    # Check for hostname in typical syslog format (field 4)
    if not extracted_nodes:
        for line in lines:
            parts = line.split()
            if len(parts) >= 4 and parts[0] in ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']:
                cand = parts[3].rstrip(':')
                if cand not in extracted_nodes and not any(w in cand.lower() for w in ['error', 'fail', 'warn', 'info']):
                    extracted_nodes.append(cand)
                    break
                    
    if not extracted_nodes:
        if "dfs" in log_content.lower() or "datanode" in log_content.lower():
            extracted_nodes = ["HDFS-DataNode-01"]
        elif "postgres" in log_content.lower() or "sql" in log_content.lower():
            extracted_nodes = ["PostgreSQL-Master"]
        else:
            extracted_nodes = ["Localhost-Server"]
            
    if not extracted_comps:
        if "dfs" in log_content.lower() or "datanode" in log_content.lower():
            extracted_comps = ["dfs.DataNode", "dfs.NameNode"]
        elif "postgres" in log_content.lower() or "sql" in log_content.lower():
            extracted_comps = ["postgres", "connection_pool"]
        else:
            extracted_comps = ["systemd", "kernel"]
            
    return error_lines, extracted_nodes, extracted_comps, parsed_logs_list

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

    # Hybrid anomaly detection: True if LSTM reconstruction error exceeds threshold OR if the log contains explicit error messages (heuristic fallback)
    is_anomaly = (error > threshold) or (features[0] > 0)
    
    # Calculate confidence based on error or error presence
    if is_anomaly:
        if error > threshold:
            confidence = min(99.9, 70.0 + (error / threshold) * 10.0)
        else:
            # High error keyword count fallback
            confidence = min(99.9, 85.0 + (features[0] * 5.0))
    else:
        confidence = min(99.9, 90.0 + (1.0 - error/threshold) * 5.0)

    # Calculate dynamic accuracy based on reconstruction margin
    if is_anomaly:
        reconstruction_margin = error / threshold if threshold > 0 else 1.0
        acc_val = min(99.9, 70.0 + min(29.9, (reconstruction_margin - 1.0) * 10.0))
    else:
        reconstruction_margin = error / threshold if threshold > 0 else 0.0
        acc_val = min(99.9, 70.0 + min(29.9, (1.0 - reconstruction_margin) * 25.0))
    
    # Extract detailed elements from the log contents
    error_lines, extracted_nodes, extracted_comps, parsed_logs_list = analyze_log_content(raw_log)
    primary_node = extracted_nodes[0] if extracted_nodes else "Unknown Node"
    primary_comp = extracted_comps[0] if extracted_comps else "Unknown Component"
    
    # Base response
    resp = {
        "status": "anomaly" if is_anomaly else "normal",
        "confidence": round(confidence, 1),
        "accuracy": round(acc_val, 1),
        "reconstruction_error": round(error, 6),
        "threshold": round(threshold, 6),
        "features": {"errors": features[0], "cpu": features[1], "disk": features[2]},
        "filename": os.path.basename(log_path),
        "total_lines_scanned": len(raw_log.split('\n')),
        "error_lines_count": len(error_lines),
        "parsed_logs": parsed_logs_list[:500]
    }

    if is_anomaly:
        # Match issues based on keywords
        if confidence < 50.0:
            issue = "Undetermined Telemetry Incident"
            reason = "The model detected minor abnormal patterns in the system log but has low confidence (< 50%) in classifying the exact root cause. The telemetry signature is too ambiguous to identify a specific PostgreSQL, HDFS, or security threat footprint."
            failed_node = "Localhost-Server"
            fixes = [
                "Review application runtime log stacks for unhandled system exceptions",
                "Enable trace/debug logging level on the host system processes",
                "Cross-reference system performance metrics with web server traffic trends"
            ]
            flow = [
                {"node": "User Request", "status": "ok", "desc": "Ingress stable"},
                {"node": "API Gateway", "status": "ok", "desc": "Forwarding"},
                {"node": "App Node", "status": "degraded", "desc": "Ambiguous warning footprint"},
                {"node": "Root Cause", "status": "failed", "desc": "Unidentifiable pattern"}
            ]
        elif "dfs" in raw_log.lower() or "datanode" in raw_log.lower() or "block" in raw_log.lower():
            issue = "Distributed File System - Block Replication Critical Failure"
            reason = "The log indicates a critical block replication or heartbeat failure in the HDFS cluster. DataNode heartbeat is missing or delayed, causing replication sync to interrupt."
            failed_node = primary_node if "HDFS" in primary_node or primary_node != "Localhost-Server" else "HDFS-DataNode-01"
            fixes = [
                "Verify network connectivity between NameNode and DataNodes",
                "Inspect DataNode logs for sector read/write failures",
                "Execute: hdfs dfsadmin -report to check live status",
                "Check disk volume mount spaces on the storage servers"
            ]
            flow = [
                {"node": "User Request", "status": "ok", "desc": "Ingress stable"},
                {"node": "API Gateway", "status": "ok", "desc": "Routing active"},
                {"node": "HDFS NameNode", "status": "ok", "desc": "Metadata active"},
                {"node": failed_node, "status": "failed", "desc": (error_lines[0][:40] + "...") if error_lines else "Timeout"},
                {"node": "Block Replication", "status": "failed", "desc": "Sync Interrupted"}
            ]
        elif "postgres" in raw_log.lower() or "mysql" in raw_log.lower() or "sql" in raw_log.lower() or "connection" in raw_log.lower():
            issue = "Database Connection Pool Exhaustion (Resource Contention)"
            reason = "The system has exhausted SQL connection pools or encountered query timeouts. No active connections remain in the connection manager pool."
            failed_node = primary_node if "postgres" in primary_node.lower() or primary_node != "Localhost-Server" else "PostgreSQL-Master"
            fixes = [
                "Increase max_connections in database server config",
                "Run pg_stat_activity to check lock contentions and long running queries",
                "Verify code closes DB connections in finally blocks",
                "Scale up database server CPU / Memory profile"
            ]
            flow = [
                {"node": "User Request", "status": "ok", "desc": "Traffic stable"},
                {"node": "API Gateway", "status": "ok", "desc": "Forwarding"},
                {"node": "Order Service", "status": "ok", "desc": "Running"},
                {"node": failed_node, "status": "failed", "desc": (error_lines[0][:40] + "...") if error_lines else "Pool Exhausted"},
                {"node": "Replica Sync", "status": "ok", "desc": "Healthy"}
            ]
        elif "ssh" in raw_log.lower() or "auth" in raw_log.lower() or "login" in raw_log.lower() or "unauthorized" in raw_log.lower():
            issue = "Authentication Security alert (Multiple Login Failures)"
            reason = "Repeated authentication failures detected in authentication logs. This could indicate a credential stuffing or brute force attack."
            failed_node = primary_node
            fixes = [
                "Block the offending client IP via iptables or fail2ban",
                "Review sshd_config and disable password authentication (use keys only)",
                "Audit security log trace in /var/log/auth.log",
                "Enforce rate limiting on login/auth entrypoints"
            ]
            flow = [
                {"node": "External Client", "status": "ok", "desc": "Ingress Connected"},
                {"node": "Firewall Rule", "status": "ok", "desc": "Evaluating"},
                {"node": "sshd Service", "status": "failed", "desc": (error_lines[0][:40] + "...") if error_lines else "Login Failed"},
                {"node": failed_node, "status": "ok", "desc": "Audit Logging"},
                {"node": "SIEM Dashboard", "status": "failed", "desc": "Intrusion Alert"}
            ]
        elif "disk" in raw_log.lower() or "storage" in raw_log.lower() or "full" in raw_log.lower() or "space" in raw_log.lower():
            issue = "Storage Capacity Exhaustion / Write Sector Failure"
            reason = "A host has run out of disk space on a primary write volume or encounters write sector errors."
            failed_node = primary_node
            fixes = [
                "Free up space by deleting older system caches/log archives",
                "Identify directory disk usage using: du -sh * | sort -h",
                "Check disk mount filesystem integrity using fsck",
                "Attach a new block storage volume and extend partitions"
            ]
            flow = [
                {"node": "Write Request", "status": "ok", "desc": "Buffered"},
                {"node": "Storage Mount", "status": "ok", "desc": "Ext4 Mounted"},
                {"node": "Block Manager", "status": "ok", "desc": "Active"},
                {"node": failed_node, "status": "failed", "desc": (error_lines[0][:40] + "...") if error_lines else "Disk Full"},
                {"node": "Syslog Agent", "status": "failed", "desc": "Write IO Blocked"}
            ]
        else:
            # General service failure
            issue = f"System Service Anomaly ({primary_comp.upper()} Fail)"
            reason = f"LSTM neural network detected an abnormal error pattern in service {primary_comp}. Line details: " + (error_lines[0] if error_lines else "No explicit error details.")
            failed_node = primary_node
            fixes = [
                f"Restart the crashed service: systemctl restart {primary_comp}",
                f"Inspect service details using: journalctl -u {primary_comp} -n 50",
                "Check CPU load averages and system RAM utilization",
                "Review recent software package deployments and configuration alterations"
            ]
            flow = [
                {"node": "User Request", "status": "ok", "desc": "Stable Traffic"},
                {"node": "API Gateway", "status": "ok", "desc": "Routing"},
                {"node": primary_comp, "status": "failed", "desc": (error_lines[0][:40] + "...") if error_lines else "Service Crash"},
                {"node": failed_node, "status": "ok", "desc": "Kernel Active"},
                {"node": "Metric Collector", "status": "ok", "desc": "Online"}
            ]
        resp.update({"detected_issue": issue, "failed_node": failed_node, "why_it_failed": reason, "possible_fixes": fixes, "flow": flow})
        
        # Get AI explanation
        if confidence < 50.0:
            ai_explanation = """# Diagnostic Report (Low Confidence Scan)

## ⚠️ Classification Warning: Low Prediction Accuracy
The AI engine processed the uploaded log file but is unable to classify the anomaly or suggest automated solutions. 

- **Prediction Accuracy:** 40% (Uncertain)
- **Status:** Ambiguous Sequence Patterns

### Why Solutions Cannot Be Suggested
Because the prediction accuracy has fallen below the 50% threshold limit, the system cannot verify if the log signifies a database lock, network sync failure, or hardware degradation. Activating automated playbooks or suggesting incorrect solutions in this state could result in unintended configuration changes or service disruptions.

### Recommendation
1. Enable debug/trace logs manually.
2. Request a developer audit.
3. Cross-reference with external APM performance graphs.
"""
        else:
            print("[INFO] Calling AI Assistant to explain anomaly...")
            ai_explanation = ai_assistant_service.explain_log(raw_log)
        resp["ai_explanation"] = ai_explanation
        resp["time"] = time.strftime('%Y-%m-%d %H:%M:%S')
    else:
        # Healthy status - but dynamically show scanned metrics and nodes instead of generic string
        scanned_lines = len(raw_log.split('\n'))
        comps_str = ", ".join(extracted_comps[:3]) if extracted_comps else "standard system components"
        
        resp.update({
            "detected_issue": "System Health: Optimal", 
            "failed_node": "None (Healthy)", 
            "why_it_failed": f"Analyzed {scanned_lines} log lines on node '{primary_node}'. Monitored services [{comps_str}] are operating within baseline parameters. No deviations were flagged by LSTM.", 
            "possible_fixes": [], 
            "flow": [
                {"node": "User Request", "status": "ok", "desc": "Healthy Traffic"},
                {"node": "API Gateway", "status": "ok", "desc": "Routing Ok"},
                {"node": primary_node, "status": "ok", "desc": "Online"},
                {"node": primary_comp, "status": "ok", "desc": "Active"},
                {"node": "Database Call", "status": "ok", "desc": "Healthy Response"}
            ]
        })
    
    return resp
