import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from services.model_manager import model_manager
from history_db import (
    get_all_history, get_history_by_id, clear_all_history,
    delete_history_record, get_archived_file_content,
    annotate_record, get_db_stats,
)

router = APIRouter()


class SelectModelRequest(BaseModel):
    model: str


class TrainModelRequest(BaseModel):
    model_type: str
    epochs: Optional[int] = 150
    estimators: Optional[int] = 100
    learning_rate: Optional[float] = 0.005


class AnnotateRequest(BaseModel):
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    reviewed: Optional[bool] = None


@router.get("/status")
def get_model_status():
    return model_manager.get_status()


@router.post("/select")
def select_model(req: SelectModelRequest):
    success, msg = model_manager.set_active_model(req.model)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg, "active_model": model_manager.active_model}


@router.post("/train")
def train_model(req: TrainModelRequest):
    if req.model_type not in ["lstm", "random_forest"]:
        raise HTTPException(status_code=400, detail="Invalid model type. Choose 'lstm' or 'random_forest'.")

    success, msg = model_manager.train_model_in_background(
        model_type=req.model_type,
        epochs=req.epochs,
        estimators=req.estimators,
        learning_rate=req.learning_rate
    )
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}


@router.get("/training-log")
def get_training_log():
    return {
        "status": model_manager.training_status["status"],
        "model_type": model_manager.training_status["model_type"],
        "logs": model_manager.training_status["logs"],
        "elapsed_seconds": int(time.time() - model_manager.training_status["start_time"])
        if model_manager.training_status["status"] == "training" else 0
    }


# ─── History Routes ──────────────────────────────────────────────────────────

@router.get("/history")
def get_history():
    return get_all_history()


@router.get("/history/{record_id}")
def get_history_record(record_id: str):
    record = get_history_by_id(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="History record not found.")
    return record


@router.delete("/history")
def clear_history():
    clear_all_history()
    return {"message": "All diagnostic history and archived files cleared successfully."}


@router.delete("/history/{record_id}")
def delete_record(record_id: str):
    success = delete_history_record(record_id)
    if not success:
        raise HTTPException(status_code=404, detail="History record not found.")
    return {"message": f"History record {record_id} deleted."}


@router.get("/history/file/{record_id}")
def get_history_file(record_id: str):
    content = get_archived_file_content(record_id)
    if content is None:
        raise HTTPException(status_code=404, detail="Archived file or record not found.")
    return {"content": content}


@router.patch("/history/{record_id}/annotate")
def annotate_history_record(record_id: str, req: AnnotateRequest):
    """
    Update annotation fields on a history record:
    - notes: free-text user annotation
    - tags: array of string labels
    - reviewed: mark as manually reviewed
    """
    updated = annotate_record(
        record_id,
        notes=req.notes,
        tags=req.tags,
        reviewed=req.reviewed,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="History record not found.")
    return updated


# ─── Database Stats Route ────────────────────────────────────────────────────

@router.get("/db-stats")
def get_database_stats():
    """
    Return aggregate statistics about the entire log analysis history database.
    Used by the Database Explorer UI.
    """
    return get_db_stats()
