import json
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


def infer_dataset_info(filename: str, raw_log: str = "", detected_issue: str = "") -> tuple[str, str, str]:
    """Return (dataset_name, dataset_category, severity_level)."""
    name_lower = filename.lower()
    log_lower = (raw_log or "").lower()
    issue_lower = (detected_issue or "").lower()
    combined = f"{name_lower} {log_lower} {issue_lower}"

    if any(k in combined for k in ["hdfs", "datanode", "namenode", "block", "dfs"]):
        return "HDFS Log Dataset", "hdfs", "CRITICAL"
    if any(k in combined for k in ["postgres", "mysql", "sql", "connection pool", "database"]):
        return "PostgreSQL Log Dataset", "postgresql", "CRITICAL"
    if any(k in combined for k in ["ssh", "auth", "brute", "login", "unauthorized"]):
        return "SSH Security Log Dataset", "security", "CRITICAL"
    if any(k in combined for k in ["disk", "storage", "space", "full", "mount"]):
        return "Disk Storage Log Dataset", "storage", "CRITICAL"
    if any(k in combined for k in ["normal", "healthy", "boot"]):
        return "System Health Log Dataset", "healthy", "INFO"

    stem = re.sub(r"[_\-\.]", " ", os_path_stem(filename)).strip().title()
    return stem or "Custom Log Dataset", "general", "WARNING"


def infer_log_format(filename: str, raw_log: str = "") -> str:
    """Detect the log format from filename extension and content patterns."""
    name_lower = filename.lower()
    log_lower = (raw_log or "")[:2000].lower()

    if any(k in name_lower for k in ["hdfs", "datanode", "namenode"]):
        return "HDFS"
    if any(k in name_lower for k in ["nginx", "apache", "access"]):
        return "nginx/Apache"
    if any(k in name_lower for k in ["syslog", "auth.log", "kern.log"]):
        return "syslog"
    if "postgres" in name_lower or "mysql" in name_lower:
        return "Database"
    if name_lower.endswith(".json"):
        return "JSON"
    if name_lower.endswith(".csv"):
        return "CSV"

    # Content-based detection
    if re.search(r'\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}', log_lower):
        return "ISO Timestamp"
    if re.search(r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}', log_lower):
        return "syslog"
    if "level=" in log_lower or "severity=" in log_lower:
        return "Structured KV"

    return "Custom/Unknown"


def infer_tags(filename: str, raw_log: str = "", detected_issue: str = "", status: str = "") -> List[str]:
    """Auto-generate relevant tags for a log record."""
    tags = []
    combined = f"{filename} {(raw_log or '')[:500]} {detected_issue}".lower()

    if status == "anomaly":
        tags.append("anomaly")
    else:
        tags.append("normal")

    if any(k in combined for k in ["hdfs", "datanode", "namenode"]):
        tags.append("hadoop")
    if any(k in combined for k in ["postgres", "mysql", "sql"]):
        tags.append("database")
    if any(k in combined for k in ["ssh", "auth", "brute"]):
        tags.append("security")
    if any(k in combined for k in ["disk", "storage", "space", "full"]):
        tags.append("storage")
    if any(k in combined for k in ["connection refused", "timeout", "unreachable"]):
        tags.append("network")
    if any(k in combined for k in ["oom", "memory", "out of memory"]):
        tags.append("memory")
    if any(k in combined for k in ["cpu", "load average", "high load"]):
        tags.append("performance")
    if any(k in combined for k in ["error", "exception", "fatal", "critical"]):
        tags.append("error")

    return list(dict.fromkeys(tags))  # deduplicate while preserving order


def os_path_stem(filename: str) -> str:
    return filename.rsplit(".", 1)[0] if "." in filename else filename


@dataclass
class LogAnalysisRecord:
    id: str
    uploaded_at: str
    filename: str
    dataset_name: str = ""
    dataset_category: str = "general"
    archive_filename: str = ""
    file_size_bytes: int = 0
    status: str = "unknown"
    confidence: float = 0.0
    severity_level: str = "INFO"
    model_used: str = ""
    detected_issue: str = ""
    root_cause: str = ""
    failed_node: str = ""
    recommendations: List[str] = None
    reconstruction_error: float = 0.0
    threshold: float = 0.0
    features: Optional[Dict[str, Any]] = None
    flow: Optional[List[Dict[str, Any]]] = None
    ai_explanation: str = ""
    total_lines_scanned: int = 0
    error_lines_count: int = 0

    # Enhanced tracking fields
    upload_source: str = "manual"
    processing_time_ms: int = 0
    log_format: str = "unknown"
    anomaly_score: float = 0.0
    tags: List[str] = None
    notes: str = ""
    reviewed: bool = False

    def __post_init__(self):
        if self.recommendations is None:
            self.recommendations = []
        if self.features is None:
            self.features = {}
        if self.flow is None:
            self.flow = []
        if self.tags is None:
            self.tags = []

    @classmethod
    def from_result(cls, record_id: str, uploaded_at: str, filename: str,
                    file_content: str, archive_filename: str, result_data: dict,
                    processing_time_ms: int = 0, upload_source: str = "manual") -> "LogAnalysisRecord":
        dataset_name, dataset_category, severity = infer_dataset_info(
            filename,
            file_content,
            result_data.get("detected_issue", ""),
        )
        if result_data.get("status") == "normal":
            severity = "INFO"
        elif result_data.get("error_lines_count", 0) > 0:
            severity = "CRITICAL"

        status = result_data.get("status", "unknown")
        log_fmt = infer_log_format(filename, file_content)
        auto_tags = infer_tags(
            filename,
            file_content,
            result_data.get("detected_issue", ""),
            status,
        )

        # Normalize anomaly score to 0–1
        recon_err = float(result_data.get("reconstruction_error", 0))
        threshold = float(result_data.get("threshold", 0))
        anomaly_score = min(recon_err / threshold, 1.0) if threshold > 0 else (
            float(result_data.get("confidence", 0)) / 100.0 if status == "anomaly" else 0.0
        )

        return cls(
            id=record_id,
            uploaded_at=uploaded_at,
            filename=filename,
            dataset_name=dataset_name,
            dataset_category=dataset_category,
            archive_filename=archive_filename,
            file_size_bytes=len(file_content.encode("utf-8", errors="ignore")),
            status=status,
            confidence=float(result_data.get("confidence", 0)),
            severity_level=severity,
            model_used=result_data.get("model_used", "LSTM Autoencoder"),
            detected_issue=result_data.get("detected_issue", "N/A"),
            root_cause=result_data.get("why_it_failed", "N/A"),
            failed_node=result_data.get("failed_node", "N/A"),
            recommendations=result_data.get("possible_fixes", []) or [],
            reconstruction_error=recon_err,
            threshold=threshold,
            features=result_data.get("features", {}) or {},
            flow=result_data.get("flow", []) or [],
            ai_explanation=result_data.get("ai_explanation", ""),
            total_lines_scanned=int(result_data.get("total_lines_scanned", 0)),
            error_lines_count=int(result_data.get("error_lines_count", 0)),
            # Enhanced fields
            upload_source=upload_source,
            processing_time_ms=processing_time_ms,
            log_format=log_fmt,
            anomaly_score=round(anomaly_score, 4),
            tags=auto_tags,
            notes="",
            reviewed=False,
        )

    def to_db_row(self) -> dict:
        return {
            "id": self.id,
            "uploaded_at": self.uploaded_at,
            "filename": self.filename,
            "dataset_name": self.dataset_name,
            "dataset_category": self.dataset_category,
            "archive_filename": self.archive_filename,
            "file_size_bytes": self.file_size_bytes,
            "status": self.status,
            "confidence": self.confidence,
            "severity_level": self.severity_level,
            "model_used": self.model_used,
            "detected_issue": self.detected_issue,
            "root_cause": self.root_cause,
            "failed_node": self.failed_node,
            "recommendations": json.dumps(self.recommendations),
            "reconstruction_error": self.reconstruction_error,
            "threshold": self.threshold,
            "features_json": json.dumps(self.features),
            "flow_json": json.dumps(self.flow),
            "ai_explanation": self.ai_explanation,
            "total_lines_scanned": self.total_lines_scanned,
            "error_lines_count": self.error_lines_count,
            # Enhanced fields
            "upload_source": self.upload_source,
            "processing_time_ms": self.processing_time_ms,
            "log_format": self.log_format,
            "anomaly_score": self.anomaly_score,
            "tags": json.dumps(self.tags),
            "notes": self.notes,
            "reviewed": 1 if self.reviewed else 0,
        }

    def to_api_dict(self) -> dict:
        """Backward-compatible response for existing frontend routes."""
        return {
            "id": self.id,
            "timestamp": self.uploaded_at,
            "filename": self.filename,
            "dataset_name": self.dataset_name,
            "dataset_category": self.dataset_category,
            "archive_filename": self.archive_filename,
            "file_size_bytes": self.file_size_bytes,
            "status": self.status,
            "confidence": self.confidence,
            "severity_level": self.severity_level,
            "model_used": self.model_used,
            "detected_issue": self.detected_issue,
            "why_it_failed": self.root_cause,
            "root_cause": self.root_cause,
            "failed_node": self.failed_node,
            "possible_fixes": self.recommendations,
            "recommendations": self.recommendations,
            "reconstruction_error": self.reconstruction_error,
            "threshold": self.threshold,
            "features": self.features,
            "flow": self.flow,
            "ai_explanation": self.ai_explanation,
            "total_lines_scanned": self.total_lines_scanned,
            "error_lines_count": self.error_lines_count,
            # Enhanced fields
            "upload_source": self.upload_source,
            "processing_time_ms": self.processing_time_ms,
            "log_format": self.log_format,
            "anomaly_score": self.anomaly_score,
            "tags": self.tags,
            "notes": self.notes,
            "reviewed": self.reviewed,
        }

    @classmethod
    def from_db_row(cls, row) -> "LogAnalysisRecord":
        recommendations = json.loads(row["recommendations"] or "[]")
        features = json.loads(row["features_json"] or "{}")
        flow = json.loads(row["flow_json"] or "[]")

        # Safe access for new columns (may not exist in old DB rows before migration)
        def _get(key, default):
            try:
                return row[key]
            except (IndexError, KeyError):
                return default

        tags_raw = _get("tags", "[]")
        tags = json.loads(tags_raw) if tags_raw else []

        return cls(
            id=row["id"],
            uploaded_at=row["uploaded_at"],
            filename=row["filename"],
            dataset_name=row["dataset_name"] or "",
            dataset_category=row["dataset_category"] or "general",
            archive_filename=row["archive_filename"] or "",
            file_size_bytes=row["file_size_bytes"] or 0,
            status=row["status"],
            confidence=row["confidence"] or 0,
            severity_level=row["severity_level"] or "INFO",
            model_used=row["model_used"] or "",
            detected_issue=row["detected_issue"] or "",
            root_cause=row["root_cause"] or "",
            failed_node=row["failed_node"] or "",
            recommendations=recommendations,
            reconstruction_error=row["reconstruction_error"] or 0,
            threshold=row["threshold"] or 0,
            features=features,
            flow=flow,
            ai_explanation=row["ai_explanation"] or "",
            total_lines_scanned=row["total_lines_scanned"] or 0,
            error_lines_count=row["error_lines_count"] or 0,
            # Enhanced fields
            upload_source=_get("upload_source", "manual") or "manual",
            processing_time_ms=_get("processing_time_ms", 0) or 0,
            log_format=_get("log_format", "unknown") or "unknown",
            anomaly_score=_get("anomaly_score", 0.0) or 0.0,
            tags=tags,
            notes=_get("notes", "") or "",
            reviewed=bool(_get("reviewed", 0)),
        )
