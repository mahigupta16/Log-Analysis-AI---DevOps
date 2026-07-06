import os
import json
import time
import shutil

DB_FILE = os.path.join(os.path.dirname(__file__), "history_db.json")
ARCHIVE_DIR = os.path.join(os.path.dirname(__file__), "uploads", "archive")

# Create folders if they don't exist
os.makedirs(ARCHIVE_DIR, exist_ok=True)

def init_db():
    if not os.path.exists(DB_FILE):
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)

def get_all_history():
    init_db()
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[DB Error] Failed to read database: {e}")
        return []

def save_history(history_list):
    try:
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(history_list, f, indent=2)
    except Exception as e:
        print(f"[DB Error] Failed to save database: {e}")

def add_history_record(filename, file_content, result_data):
    init_db()
    
    # Generate unique ID and timestamp
    record_id = str(int(time.time() * 1000))
    timestamp_str = time.strftime('%Y-%m-%d %H:%M:%S')
    
    # Save the file to archive
    safe_filename = f"{record_id}_{filename}"
    archive_path = os.path.join(ARCHIVE_DIR, safe_filename)
    
    try:
        with open(archive_path, "w", encoding="utf-8", errors="ignore") as f:
            f.write(file_content)
    except Exception as e:
        print(f"[DB Error] Failed to archive file: {e}")
        archive_path = ""
        safe_filename = ""
        
    history = get_all_history()
    
    # Create new record
    new_record = {
        "id": record_id,
        "timestamp": timestamp_str,
        "filename": filename,
        "archive_filename": safe_filename,
        "status": result_data.get("status", "unknown"),
        "confidence": result_data.get("confidence", 0),
        "reconstruction_error": result_data.get("reconstruction_error", 0),
        "threshold": result_data.get("threshold", 0),
        "detected_issue": result_data.get("detected_issue", "N/A"),
        "why_it_failed": result_data.get("why_it_failed", "N/A"),
        "failed_node": result_data.get("failed_node", "N/A"),
        "possible_fixes": result_data.get("possible_fixes", []),
        "flow": result_data.get("flow", []),
        "features": result_data.get("features", {}),
        "ai_explanation": result_data.get("ai_explanation", ""),
        "total_lines_scanned": result_data.get("total_lines_scanned", 0),
        "error_lines_count": result_data.get("error_lines_count", 0),
        "model_used": result_data.get("model_used", "LSTM Autoencoder")
    }
    
    history.insert(0, new_record)  # Add at the top
    save_history(history)
    return new_record

def delete_history_record(record_id):
    history = get_all_history()
    updated_history = []
    deleted_filename = None
    
    for r in history:
        if r.get("id") == record_id:
            deleted_filename = r.get("archive_filename")
        else:
            updated_history.append(r)
            
    save_history(updated_history)
    
    # Delete the archived file
    if deleted_filename:
        archive_path = os.path.join(ARCHIVE_DIR, deleted_filename)
        if os.path.exists(archive_path):
            try:
                os.remove(archive_path)
            except Exception as e:
                print(f"[DB Error] Failed to delete archived file: {e}")
                
    return len(history) != len(updated_history)

def clear_all_history():
    save_history([])
    # Clean archive folder
    if os.path.exists(ARCHIVE_DIR):
        for f in os.listdir(ARCHIVE_DIR):
            file_path = os.path.join(ARCHIVE_DIR, f)
            try:
                if os.path.isfile(file_path):
                    os.remove(file_path)
            except Exception as e:
                print(f"[DB Error] Failed to remove {file_path}: {e}")

def get_archived_file_content(record_id):
    history = get_all_history()
    for r in history:
        if r.get("id") == record_id:
            archive_filename = r.get("archive_filename")
            if archive_filename:
                archive_path = os.path.join(ARCHIVE_DIR, archive_filename)
                if os.path.exists(archive_path):
                    try:
                        with open(archive_path, "r", encoding="utf-8", errors="ignore") as f:
                            return f.read()
                    except Exception as e:
                        return f"Error reading file: {str(e)}"
            break
    return None
