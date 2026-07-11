-- Log Analysis AI - SQLite Database Schema
-- Stores upload history, root cause analysis, and recommendations

CREATE TABLE IF NOT EXISTS log_analysis_history (
    id                  TEXT PRIMARY KEY,
    uploaded_at         TEXT NOT NULL,

    -- File & dataset info
    filename            TEXT NOT NULL,
    dataset_name        TEXT,
    dataset_category    TEXT,
    archive_filename    TEXT,
    file_size_bytes     INTEGER DEFAULT 0,

    -- Detection results
    status              TEXT NOT NULL DEFAULT 'unknown',
    confidence          REAL DEFAULT 0,
    severity_level      TEXT DEFAULT 'INFO',
    model_used          TEXT,

    -- Root cause & recommendations
    detected_issue      TEXT,
    root_cause          TEXT,
    failed_node         TEXT,
    recommendations     TEXT,

    -- ML metrics
    reconstruction_error REAL DEFAULT 0,
    threshold           REAL DEFAULT 0,
    features_json       TEXT,
    flow_json           TEXT,

    -- AI insight
    ai_explanation      TEXT,

    -- Scan stats
    total_lines_scanned INTEGER DEFAULT 0,
    error_lines_count   INTEGER DEFAULT 0,

    -- Enhanced tracking fields
    upload_source       TEXT DEFAULT 'manual',
    processing_time_ms  INTEGER DEFAULT 0,
    log_format          TEXT DEFAULT 'unknown',
    anomaly_score       REAL DEFAULT 0.0,
    tags                TEXT DEFAULT '[]',
    notes               TEXT DEFAULT '',
    reviewed            INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_history_uploaded_at ON log_analysis_history (uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_dataset_name ON log_analysis_history (dataset_name);
CREATE INDEX IF NOT EXISTS idx_history_status ON log_analysis_history (status);
CREATE INDEX IF NOT EXISTS idx_history_filename ON log_analysis_history (filename);
CREATE INDEX IF NOT EXISTS idx_history_severity ON log_analysis_history (severity_level);
CREATE INDEX IF NOT EXISTS idx_history_reviewed ON log_analysis_history (reviewed);
CREATE INDEX IF NOT EXISTS idx_history_log_format ON log_analysis_history (log_format);
