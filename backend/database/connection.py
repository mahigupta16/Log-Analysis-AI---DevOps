import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "log_analysis.db")
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")
LEGACY_JSON_PATH = os.path.join(BASE_DIR, "history_db.json")

# New columns added in the enhanced schema — used for safe migration
_NEW_COLUMNS = [
    ("upload_source",      "TEXT    DEFAULT 'manual'"),
    ("processing_time_ms", "INTEGER DEFAULT 0"),
    ("log_format",         "TEXT    DEFAULT 'unknown'"),
    ("anomaly_score",      "REAL    DEFAULT 0.0"),
    ("tags",               "TEXT    DEFAULT '[]'"),
    ("notes",              "TEXT    DEFAULT ''"),
    ("reviewed",           "INTEGER DEFAULT 0"),
]


def get_db_path() -> str:
    return DB_PATH


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _migrate_schema(conn: sqlite3.Connection) -> None:
    """Safely add new columns to an existing database without data loss."""
    existing = {row[1] for row in conn.execute("PRAGMA table_info(log_analysis_history)")}
    for col_name, col_def in _NEW_COLUMNS:
        if col_name not in existing:
            conn.execute(
                f"ALTER TABLE log_analysis_history ADD COLUMN {col_name} {col_def}"
            )
            print(f"[DB Migration] Added column: {col_name}")

    # Add new indexes (IF NOT EXISTS — safe to re-run)
    new_indexes = [
        "CREATE INDEX IF NOT EXISTS idx_history_severity ON log_analysis_history (severity_level)",
        "CREATE INDEX IF NOT EXISTS idx_history_reviewed ON log_analysis_history (reviewed)",
        "CREATE INDEX IF NOT EXISTS idx_history_log_format ON log_analysis_history (log_format)",
    ]
    for idx_sql in new_indexes:
        conn.execute(idx_sql)

    conn.commit()


def init_database() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    with _get_connection() as conn:
        # Split by semicolon to separate tables and indexes
        statements = [s.strip() for s in schema_sql.split(";") if s.strip()]
        
        # 1. Run CREATE TABLE first
        for stmt in statements:
            if "CREATE TABLE" in stmt:
                conn.execute(stmt)
        conn.commit()
        
        # 2. Run migration to add new columns if they don't exist
        _migrate_schema(conn)
        
        # 3. Run remaining statements (like CREATE INDEX)
        for stmt in statements:
            if "CREATE INDEX" in stmt:
                conn.execute(stmt)
        conn.commit()
