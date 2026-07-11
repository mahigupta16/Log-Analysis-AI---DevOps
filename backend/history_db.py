import os
import json
import time
import sqlite3

from database.connection import init_database, _get_connection, LEGACY_JSON_PATH
from database.models import LogAnalysisRecord, infer_dataset_info

ARCHIVE_DIR = os.path.join(os.path.dirname(__file__), "uploads", "archive")
os.makedirs(ARCHIVE_DIR, exist_ok=True)

INSERT_SQL = """
INSERT INTO log_analysis_history (
    id, uploaded_at, filename, dataset_name, dataset_category, archive_filename,
    file_size_bytes, status, confidence, severity_level, model_used,
    detected_issue, root_cause, failed_node, recommendations,
    reconstruction_error, threshold, features_json, flow_json,
    ai_explanation, total_lines_scanned, error_lines_count,
    upload_source, processing_time_ms, log_format, anomaly_score,
    tags, notes, reviewed
) VALUES (
    :id, :uploaded_at, :filename, :dataset_name, :dataset_category, :archive_filename,
    :file_size_bytes, :status, :confidence, :severity_level, :model_used,
    :detected_issue, :root_cause, :failed_node, :recommendations,
    :reconstruction_error, :threshold, :features_json, :flow_json,
    :ai_explanation, :total_lines_scanned, :error_lines_count,
    :upload_source, :processing_time_ms, :log_format, :anomaly_score,
    :tags, :notes, :reviewed
)
"""


def _migrate_legacy_json() -> None:
    if not os.path.exists(LEGACY_JSON_PATH):
        return

    with _get_connection() as conn:
        count = conn.execute("SELECT COUNT(*) FROM log_analysis_history").fetchone()[0]
        if count > 0:
            return

        try:
            with open(LEGACY_JSON_PATH, "r", encoding="utf-8") as f:
                legacy_records = json.load(f)
        except Exception as e:
            print(f"[DB] Legacy JSON migration skipped: {e}")
            return

        for item in legacy_records:
            dataset_name, dataset_category, severity = infer_dataset_info(
                item.get("filename", ""),
                "",
                item.get("detected_issue", ""),
            )
            row = {
                "id": item.get("id", str(int(time.time() * 1000))),
                "uploaded_at": item.get("timestamp", time.strftime('%Y-%m-%d %H:%M:%S')),
                "filename": item.get("filename", "unknown.log"),
                "dataset_name": dataset_name,
                "dataset_category": dataset_category,
                "archive_filename": item.get("archive_filename", ""),
                "file_size_bytes": 0,
                "status": item.get("status", "unknown"),
                "confidence": item.get("confidence", 0),
                "severity_level": severity,
                "model_used": item.get("model_used", ""),
                "detected_issue": item.get("detected_issue", ""),
                "root_cause": item.get("why_it_failed", ""),
                "failed_node": item.get("failed_node", ""),
                "recommendations": json.dumps(item.get("possible_fixes", [])),
                "reconstruction_error": item.get("reconstruction_error", 0),
                "threshold": item.get("threshold", 0),
                "features_json": json.dumps(item.get("features", {})),
                "flow_json": json.dumps(item.get("flow", [])),
                "ai_explanation": item.get("ai_explanation", ""),
                "total_lines_scanned": item.get("total_lines_scanned", 0),
                "error_lines_count": item.get("error_lines_count", 0),
                # Enhanced fields with defaults for migrated records
                "upload_source": "imported",
                "processing_time_ms": 0,
                "log_format": "unknown",
                "anomaly_score": 0.0,
                "tags": json.dumps([item.get("status", "unknown")]),
                "notes": "",
                "reviewed": 0,
            }
            try:
                conn.execute(INSERT_SQL, row)
            except sqlite3.IntegrityError:
                pass

        conn.commit()
        print(f"[DB] Migrated {len(legacy_records)} records from history_db.json to SQLite")


def init_db() -> None:
    init_database()
    _migrate_legacy_json()


def get_all_history() -> list:
    init_db()
    with _get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM log_analysis_history ORDER BY uploaded_at DESC"
        ).fetchall()
    return [LogAnalysisRecord.from_db_row(row).to_api_dict() for row in rows]


def get_history_by_id(record_id: str) -> dict | None:
    init_db()
    with _get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM log_analysis_history WHERE id = ?",
            (record_id,),
        ).fetchone()
    if not row:
        return None
    return LogAnalysisRecord.from_db_row(row).to_api_dict()


def add_history_record(filename: str, file_content: str, result_data: dict,
                       processing_time_ms: int = 0, upload_source: str = "manual") -> dict:
    init_db()

    record_id = str(int(time.time() * 1000))
    timestamp_str = time.strftime('%Y-%m-%d %H:%M:%S')

    safe_filename = f"{record_id}_{filename}"
    archive_path = os.path.join(ARCHIVE_DIR, safe_filename)

    try:
        with open(archive_path, "w", encoding="utf-8", errors="ignore") as f:
            f.write(file_content)
    except Exception as e:
        print(f"[DB Error] Failed to archive file: {e}")
        safe_filename = ""

    record = LogAnalysisRecord.from_result(
        record_id, timestamp_str, filename, file_content, safe_filename, result_data,
        processing_time_ms=processing_time_ms, upload_source=upload_source,
    )

    with _get_connection() as conn:
        conn.execute(INSERT_SQL, record.to_db_row())
        conn.commit()

    return record.to_api_dict()


def delete_history_record(record_id: str) -> bool:
    init_db()
    record = get_history_by_id(record_id)
    if not record:
        return False

    with _get_connection() as conn:
        conn.execute("DELETE FROM log_analysis_history WHERE id = ?", (record_id,))
        conn.commit()

    archive_filename = record.get("archive_filename")
    if archive_filename:
        archive_path = os.path.join(ARCHIVE_DIR, archive_filename)
        if os.path.exists(archive_path):
            try:
                os.remove(archive_path)
            except Exception as e:
                print(f"[DB Error] Failed to delete archived file: {e}")

    return True


def clear_all_history() -> None:
    init_db()
    with _get_connection() as conn:
        conn.execute("DELETE FROM log_analysis_history")
        conn.commit()

    if os.path.exists(ARCHIVE_DIR):
        for f in os.listdir(ARCHIVE_DIR):
            file_path = os.path.join(ARCHIVE_DIR, f)
            try:
                if os.path.isfile(file_path):
                    os.remove(file_path)
            except Exception as e:
                print(f"[DB Error] Failed to remove {file_path}: {e}")


def get_archived_file_content(record_id: str) -> str | None:
    record = get_history_by_id(record_id)
    if not record:
        return None

    archive_filename = record.get("archive_filename")
    if archive_filename:
        archive_path = os.path.join(ARCHIVE_DIR, archive_filename)
        if os.path.exists(archive_path):
            try:
                with open(archive_path, "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()
            except Exception as e:
                return f"Error reading file: {str(e)}"
    return None


def annotate_record(record_id: str, notes: str = None, tags: list = None, reviewed: bool = None) -> dict | None:
    """Update the annotation fields (notes, tags, reviewed) for a history record."""
    init_db()
    record = get_history_by_id(record_id)
    if not record:
        return None

    updates = {}
    params = []
    if notes is not None:
        updates["notes"] = "notes = ?"
        params.append(notes)
    if tags is not None:
        updates["tags"] = "tags = ?"
        params.append(json.dumps(tags))
    if reviewed is not None:
        updates["reviewed"] = "reviewed = ?"
        params.append(1 if reviewed else 0)

    if not updates:
        return record

    set_clause = ", ".join(updates.values())
    params.append(record_id)

    with _get_connection() as conn:
        conn.execute(
            f"UPDATE log_analysis_history SET {set_clause} WHERE id = ?",
            params
        )
        conn.commit()

    return get_history_by_id(record_id)


def get_db_stats() -> dict:
    """Return aggregate statistics about the log analysis history database."""
    init_db()
    with _get_connection() as conn:
        total = conn.execute("SELECT COUNT(*) FROM log_analysis_history").fetchone()[0]

        anomaly_count = conn.execute(
            "SELECT COUNT(*) FROM log_analysis_history WHERE status = 'anomaly'"
        ).fetchone()[0]

        normal_count = conn.execute(
            "SELECT COUNT(*) FROM log_analysis_history WHERE status = 'normal'"
        ).fetchone()[0]

        reviewed_count = conn.execute(
            "SELECT COUNT(*) FROM log_analysis_history WHERE reviewed = 1"
        ).fetchone()[0]

        avg_confidence = conn.execute(
            "SELECT AVG(confidence) FROM log_analysis_history"
        ).fetchone()[0] or 0.0

        avg_processing_ms = conn.execute(
            "SELECT AVG(processing_time_ms) FROM log_analysis_history WHERE processing_time_ms > 0"
        ).fetchone()[0] or 0.0

        total_lines = conn.execute(
            "SELECT SUM(total_lines_scanned) FROM log_analysis_history"
        ).fetchone()[0] or 0

        total_error_lines = conn.execute(
            "SELECT SUM(error_lines_count) FROM log_analysis_history"
        ).fetchone()[0] or 0

        total_bytes = conn.execute(
            "SELECT SUM(file_size_bytes) FROM log_analysis_history"
        ).fetchone()[0] or 0

        # Dataset breakdown
        dataset_rows = conn.execute(
            """SELECT dataset_name, COUNT(*) as cnt
               FROM log_analysis_history
               GROUP BY dataset_name
               ORDER BY cnt DESC
               LIMIT 10"""
        ).fetchall()

        # Severity breakdown
        severity_rows = conn.execute(
            """SELECT severity_level, COUNT(*) as cnt
               FROM log_analysis_history
               GROUP BY severity_level
               ORDER BY cnt DESC"""
        ).fetchall()

        # Log format breakdown
        format_rows = conn.execute(
            """SELECT log_format, COUNT(*) as cnt
               FROM log_analysis_history
               GROUP BY log_format
               ORDER BY cnt DESC"""
        ).fetchall()

        # Model usage breakdown
        model_rows = conn.execute(
            """SELECT model_used, COUNT(*) as cnt
               FROM log_analysis_history
               GROUP BY model_used
               ORDER BY cnt DESC"""
        ).fetchall()

        # Recent activity — last 7 days by day
        activity_rows = conn.execute(
            """SELECT DATE(uploaded_at) as day, COUNT(*) as cnt
               FROM log_analysis_history
               WHERE uploaded_at >= DATE('now', '-7 days')
               GROUP BY day
               ORDER BY day ASC"""
        ).fetchall()

        # Most common detected issues
        issue_rows = conn.execute(
            """SELECT detected_issue, COUNT(*) as cnt
               FROM log_analysis_history
               WHERE detected_issue IS NOT NULL AND detected_issue != '' AND detected_issue != 'N/A'
               GROUP BY detected_issue
               ORDER BY cnt DESC
               LIMIT 5"""
        ).fetchall()

    return {
        "total_records": total,
        "anomaly_count": anomaly_count,
        "normal_count": normal_count,
        "reviewed_count": reviewed_count,
        "unreviewed_count": total - reviewed_count,
        "anomaly_rate": round((anomaly_count / total * 100) if total > 0 else 0, 1),
        "avg_confidence": round(avg_confidence, 1),
        "avg_processing_ms": round(avg_processing_ms, 0),
        "total_lines_scanned": total_lines,
        "total_error_lines": total_error_lines,
        "total_bytes_processed": total_bytes,
        "dataset_breakdown": [{"name": r[0] or "Unknown", "count": r[1]} for r in dataset_rows],
        "severity_breakdown": [{"level": r[0] or "INFO", "count": r[1]} for r in severity_rows],
        "format_breakdown": [{"format": r[0] or "unknown", "count": r[1]} for r in format_rows],
        "model_breakdown": [{"model": r[0] or "Unknown", "count": r[1]} for r in model_rows],
        "daily_activity": [{"day": r[0], "count": r[1]} for r in activity_rows],
        "top_issues": [{"issue": r[0], "count": r[1]} for r in issue_rows],
    }
