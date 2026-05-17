from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from services.ai_assistant import ai_assistant_service

router = APIRouter()

class LogRequest(BaseModel):
    log: str

class ChatRequest(BaseModel):
    message: str
    context: Dict[str, Any]
    history: List[Dict[str, Any]]

@router.post("/explain")
async def explain_error(request: LogRequest):
    if not request.log:
        raise HTTPException(status_code=400, detail="Log text is required")
    # explain_log is synchronous currently, if it takes time we can run it in a threadpool, 
    # but for simplicity we call it directly.
    response = ai_assistant_service.explain_log(request.log)
    return {"response": response}

@router.post("/bash")
async def generate_bash(request: LogRequest):
    if not request.log:
        raise HTTPException(status_code=400, detail="Log text is required")
    response = ai_assistant_service.generate_bash_script(request.log)
    return {"response": response}

@router.post("/k8s")
async def suggest_k8s(request: LogRequest):
    if not request.log:
        raise HTTPException(status_code=400, detail="Log text is required")
    response = ai_assistant_service.suggest_k8s_fix(request.log)
    return {"response": response}

@router.post("/chat")
async def ai_chat(request: ChatRequest):
    response = await ai_assistant_service.chat_with_context(
        request.message, 
        request.context, 
        request.history
    )
    return {"reply": response}
