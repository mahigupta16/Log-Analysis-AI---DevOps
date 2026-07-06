import os
import re
import sys
import pickle
import threading
import subprocess
import time

# Config paths
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
CONFIG_FILE = os.path.join(MODELS_DIR, "model_config.json")
LSTM_MODEL_PATH = os.path.join(MODELS_DIR, "lstm_model.pt")
RF_MODEL_PATH = os.path.join(MODELS_DIR, "hdfs_rf_model.pkl")

# HDFS Templates mappings for RF model
TEMPLATES = {
    "E1": re.compile(r"Adding an already existing block", re.IGNORECASE),
    "E2": re.compile(r"Verification succeeded for", re.IGNORECASE),
    "E3": re.compile(r"Served block.*to", re.IGNORECASE),
    "E4": re.compile(r"Got exception while serving.*to", re.IGNORECASE),
    "E5": re.compile(r"Receiving block.*src:.*dest:", re.IGNORECASE),
    "E6": re.compile(r"Received block.*src:.*dest:.*of size", re.IGNORECASE),
    "E7": re.compile(r"writeBlock.*received exception", re.IGNORECASE),
    "E8": re.compile(r"PacketResponder.*for block.*Interrupted", re.IGNORECASE),
    "E9": re.compile(r"Received block.*of size.*from", re.IGNORECASE),
    "E10": re.compile(r"PacketResponder.*Exception", re.IGNORECASE),
    "E11": re.compile(r"PacketResponder.*for block.*terminating", re.IGNORECASE),
    "E12": re.compile(r"Exception writing block.*to mirror", re.IGNORECASE),
    "E13": re.compile(r"Receiving empty packet for block", re.IGNORECASE),
    "E14": re.compile(r"Exception in receiveBlock for block", re.IGNORECASE),
    "E15": re.compile(r"Changing block file offset of block.*from.*to.*meta file offset to", re.IGNORECASE),
    "E16": re.compile(r"Transmitted block.*to", re.IGNORECASE),
    "E17": re.compile(r"Failed to transfer.*to.*got", re.IGNORECASE),
    "E18": re.compile(r"Starting thread to transfer block.*to", re.IGNORECASE),
    "E19": re.compile(r"Reopen Block", re.IGNORECASE),
    "E20": re.compile(r"Unexpected error trying to delete block.*BlockInfo not found in volumeMap", re.IGNORECASE),
    "E21": re.compile(r"Deleting block.*file", re.IGNORECASE),
    "E22": re.compile(r"BLOCK\* NameSystem.*allocateBlock:", re.IGNORECASE),
    "E23": re.compile(r"BLOCK\* NameSystem.*delete:.*is added to invalidSet of", re.IGNORECASE),
    "E24": re.compile(r"BLOCK\* Removing block.*from neededReplications as it does not belong to any file", re.IGNORECASE),
    "E25": re.compile(r"BLOCK\* ask.*to replicate.*to", re.IGNORECASE),
    "E26": re.compile(r"BLOCK\* NameSystem.*addStoredBlock: blockMap updated:.*is added to.*size", re.IGNORECASE),
    "E27": re.compile(r"BLOCK\* NameSystem.*addStoredBlock: Redundant addStoredBlock request received for.*on.*size", re.IGNORECASE),
    "E28": re.compile(r"BLOCK\* NameSystem.*addStoredBlock: addStoredBlock request received for.*on.*size.*But it does not belong to any file", re.IGNORECASE),
    "E29": re.compile(r"PendingReplicationMonitor timed out block", re.IGNORECASE)
}

# Thread safety
model_lock = threading.Lock()

class ModelManager:
    def __init__(self):
        self.active_model = "lstm"  # "lstm" or "random_forest"
        self.training_status = {
            "status": "idle",  # "idle" or "training"
            "model_type": "",
            "logs": "No active training logs.",
            "start_time": 0
        }
        self.rf_model_data = None
        self.load_config()
        self.load_rf_model()

    def load_config(self):
        import json
        os.makedirs(MODELS_DIR, exist_ok=True)
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r") as f:
                    config = json.load(f)
                    self.active_model = config.get("active_model", "lstm")
            except Exception as e:
                print(f"[ModelManager] Error reading model config: {e}")

    def save_config(self):
        import json
        try:
            with open(CONFIG_FILE, "w") as f:
                json.dump({"active_model": self.active_model}, f)
        except Exception as e:
            print(f"[ModelManager] Error saving model config: {e}")

    def set_active_model(self, model_name):
        if model_name not in ["lstm", "random_forest"]:
            return False, f"Invalid model name: {model_name}"
        with model_lock:
            self.active_model = model_name
            self.save_config()
        return True, f"Active model set to {model_name}"

    def load_rf_model(self):
        if os.path.exists(RF_MODEL_PATH):
            try:
                with open(RF_MODEL_PATH, "rb") as f:
                    self.rf_model_data = pickle.load(f)
                print("[ModelManager] Random Forest model loaded successfully.")
            except Exception as e:
                print(f"[ModelManager] Error loading RF model: {e}")
                self.rf_model_data = None
        else:
            print("[ModelManager] Random Forest model pickle file not found at " + RF_MODEL_PATH)
            self.rf_model_data = None

    def get_status(self):
        import torch
        
        lstm_trained = os.path.exists(LSTM_MODEL_PATH)
        rf_trained = os.path.exists(RF_MODEL_PATH)
        
        # Read LSTM details if trained
        lstm_info = {}
        if lstm_trained:
            try:
                checkpoint = torch.load(LSTM_MODEL_PATH, map_location="cpu", weights_only=False)
                lstm_info = {
                    "threshold": round(checkpoint.get("threshold", 0.0), 6),
                    "input_dim": checkpoint.get("input_dim", 3),
                    "hidden_dim": checkpoint.get("hidden_dim", 16)
                }
            except Exception as e:
                lstm_info = {"error": str(e)}

        rf_info = {}
        if rf_trained and self.rf_model_data:
            rf_info = {
                "feature_count": len(self.rf_model_data.get("feature_cols", [])),
                "features": self.rf_model_data.get("feature_cols", [])
            }

        return {
            "active_model": self.active_model,
            "training_status": self.training_status["status"],
            "training_model_type": self.training_status["model_type"],
            "models": {
                "lstm": {
                    "trained": lstm_trained,
                    "details": lstm_info,
                    "name": "LSTM Autoencoder (PyTorch)",
                    "description": "Sequence-based neural network. Learns normal baseline log metrics and flags sequences that deviate from the normal path."
                },
                "random_forest": {
                    "trained": rf_trained,
                    "details": rf_info,
                    "name": "Random Forest Classifier (Scikit-Learn)",
                    "description": "Decision tree ensemble model. Maps event occurrences to known system failures like replication loss or disk timeouts."
                }
            }
        }

    def train_model_in_background(self, model_type, epochs=150, estimators=100, learning_rate=0.005):
        if self.training_status["status"] == "training":
            return False, "Training is already in progress."

        self.training_status = {
            "status": "training",
            "model_type": model_type,
            "logs": f"--- Starting {model_type.upper()} Model Training ---\n",
            "start_time": time.time()
        }

        # Run script as subprocess to prevent blocking FastAPI thread
        backend_dir = os.path.dirname(os.path.dirname(__file__))
        
        # Decide which script to run
        if model_type == "lstm":
            script_path = os.path.join(backend_dir, "ml_model.py")
            cmd = [sys.executable, script_path]
        else:
            script_path = os.path.join(backend_dir, "train_hdfs.py")
            cmd = [sys.executable, script_path]

        def worker():
            print(f"[ModelManager] Starting training thread with command: {cmd}")
            try:
                # Use standard environment variables
                env = os.environ.copy()
                process = subprocess.Popen(
                    cmd, 
                    stdout=subprocess.PIPE, 
                    stderr=subprocess.STDOUT, 
                    text=True, 
                    cwd=backend_dir,
                    env=env
                )

                while True:
                    line = process.stdout.readline()
                    if not line:
                        break
                    self.training_status["logs"] += line
                    # Limit log length in memory to avoid overflow
                    if len(self.training_status["logs"]) > 200000:
                        self.training_status["logs"] = self.training_status["logs"][-150000:]

                process.wait()
                if process.returncode == 0:
                    self.training_status["logs"] += f"\n--- Training Complete! Return Code: 0 ---\n"
                    # Reload models
                    if model_type == "random_forest":
                        self.load_rf_model()
                else:
                    self.training_status["logs"] += f"\n--- Training Failed! Return Code: {process.returncode} ---\n"

            except Exception as e:
                self.training_status["logs"] += f"\n--- Process Exception: {str(e)} ---\n"
            finally:
                self.training_status["status"] = "idle"
                self.training_status["model_type"] = ""

        thread = threading.Thread(target=worker)
        thread.daemon = True
        thread.start()
        
        return True, "Training thread started successfully."

    def predict_rf_log(self, file_content):
        if not self.rf_model_data:
            return {"error": "Random Forest model is not loaded. Please train it first."}

        model = self.rf_model_data["model"]
        feature_cols = self.rf_model_data["feature_cols"]

        # Parse block occurrences
        lines = file_content.split("\n")
        block_pattern = re.compile(r"blk_-?\d+")
        
        # Dictionary of block_id -> array of 29 features
        block_events = {}
        block_lines = {} # block_id -> list of raw lines

        # Scan and match
        for line in lines:
            if not line.strip():
                continue
            
            # Find block id in the line
            m_block = block_pattern.search(line)
            if m_block:
                block_id = m_block.group(0)
                if block_id not in block_events:
                    block_events[block_id] = {f"E{i}": 0 for i in range(1, 30)}
                    block_lines[block_id] = []
                
                block_lines[block_id].append(line)
                
                # Check templates matching
                for eid, regex in TEMPLATES.items():
                    if regex.search(line):
                        block_events[block_id][eid] += 1
                        break  # Match only one event template per line

        # If no block IDs were found in the log, evaluate the entire file as a single mock block
        if not block_events:
            block_id = "Aggregated-Log-Data"
            block_events[block_id] = {f"E{i}": 0 for i in range(1, 30)}
            block_lines[block_id] = []
            
            for line in lines:
                if not line.strip():
                    continue
                block_lines[block_id].append(line)
                for eid, regex in TEMPLATES.items():
                    if regex.search(line):
                        block_events[block_id][eid] += 1
                        break

        # Predict status for each block
        anomalous_blocks = []
        block_reports = []

        for bid, events in block_events.items():
            # Build feature array in correct E1 to E29 order
            vector = [events[col] for col in feature_cols]
            
            # Predict
            import traceback
            print(f"[ModelManager DEBUG] Vector: {vector}")
            print(f"[ModelManager DEBUG] Model classes: {model.classes_}")
            try:
                pred_class = model.predict([vector])[0]
                print(f"[ModelManager DEBUG] Predicted class: {pred_class}")
            except Exception as ex:
                print(f"[ModelManager DEBUG] Exception in model.predict:")
                traceback.print_exc()
                raise ex
            prob = model.predict_proba([vector])[0]
            
            # Find the index of the predicted class in model.classes_ to get confidence
            try:
                class_idx = list(model.classes_).index(pred_class)
                confidence = prob[class_idx] * 100
            except ValueError:
                confidence = max(prob) * 100

            is_anomaly = (pred_class == 1) or (str(pred_class).lower() == 'anomaly')
            if is_anomaly:
                anomalous_blocks.append(bid)

            # Find matching events details for explanation
            matching_events = {}
            for col, count in events.items():
                if count > 0:
                    matching_events[col] = count

            block_reports.append({
                "block_id": bid,
                "status": "anomaly" if is_anomaly else "normal",
                "confidence": round(confidence, 1),
                "event_counts": matching_events,
                "line_count": len(block_lines[bid])
            })

        is_file_anomalous = len(anomalous_blocks) > 0
        total_blocks = len(block_events)
        anomaly_ratio = len(anomalous_blocks) / total_blocks if total_blocks > 0 else 0

        # Construct dynamic issue, why it failed, and steps
        if is_file_anomalous:
            bad_block = anomalous_blocks[0]
            issue = "Distributed File System - Block Replication Critical Failure"
            reason = f"Random Forest classifier flagged HDFS block '{bad_block}' as anomalous. The block has anomalous write, transfer or terminating occurrences in the block trace."
            fixes = [
                f"Verify network connectivity between NameNode and node hosting {bad_block}",
                f"Run command: hdfs fsck / -files -blocks -locations | grep {bad_block}",
                "Check for local filesystem issues on affected DataNode disks",
                "Verify replica count satisfies config rules (dfs.replication=3)"
            ]
            flow = [
                {"node": "User Request", "status": "ok", "desc": "Ingress stable"},
                {"node": "API Gateway", "status": "ok", "desc": "Routing active"},
                {"node": "HDFS NameNode", "status": "ok", "desc": "Coordinating block writes"},
                {"node": bad_block, "status": "failed", "desc": "State anomaly flag"},
                {"node": "Block Replication", "status": "failed", "desc": "Data Sync halted"}
            ]
        else:
            issue = "System Health: Optimal"
            reason = f"Analyzed {total_blocks} storage blocks in the HDFS log file. All events matched standard baseline execution patterns. No anomalies flagged."
            fixes = []
            flow = [
                {"node": "User Request", "status": "ok", "desc": "Ingress stable"},
                {"node": "API Gateway", "status": "ok", "desc": "Routing active"},
                {"node": "HDFS NameNode", "status": "ok", "desc": "Metadata synced"},
                {"node": "DataNode-01", "status": "ok", "desc": "Storage healthy"},
                {"node": "Block Replication", "status": "ok", "desc": "Sync active"}
            ]

        # Calculate a combined confidence percentage
        overall_confidence = max([b["confidence"] for b in block_reports]) if block_reports else 95.0

        ai_explanation = ""
        if is_file_anomalous:
            try:
                from services.ai_assistant import ai_assistant_service
                print("[INFO] Calling AI Assistant to explain HDFS RF anomaly...")
                ai_explanation = ai_assistant_service.explain_log(file_content[:5000]) # slice to avoid huge payload
            except Exception as e:
                ai_explanation = f"Error generating AI explanation: {e}"
        else:
            ai_explanation = f"### System Health Report\n\nThe Random Forest classifier evaluated **{total_blocks}** active filesystem block sequences. All event sequences matched the standard normal template benchmarks.\n\n- No anomalies detected.\n- HDFS services are operating within expected parameters."

        return {
            "status": "anomaly" if is_file_anomalous else "normal",
            "confidence": round(overall_confidence, 1),
            "reconstruction_error": 0.0,
            "threshold": 0.0,
            "detected_issue": issue,
            "why_it_failed": reason,
            "failed_node": anomalous_blocks[0] if is_file_anomalous else "None",
            "possible_fixes": fixes,
            "flow": flow,
            "features": {"errors": len(anomalous_blocks), "cpu": total_blocks, "disk": 0},
            "total_lines_scanned": len(lines),
            "error_lines_count": len(anomalous_blocks),
            "block_reports": block_reports[:100],  # Limit output details to first 100 blocks
            "ai_explanation": ai_explanation
        }

# Singleton
model_manager = ModelManager()
