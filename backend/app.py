from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any
from anomaly_detector import detect_anomaly
import os
import shutil
import google.generativeai as genai

# Initialize FastAPI app
app = FastAPI(title="AI Log Intelligence API")

# --- GOOGLE GEMINI CONFIGURATION ---
# Replace with your actual API key from https://aistudio.google.com/
GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-pro')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class ChatRequest(BaseModel):
    message: str
    context: dict
    history: List[dict]

@app.get("/")
def read_root():
    return {"message": "AI Log Intelligence API is running"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # We need the raw log content for AI context later
        with open(file_path, "r", encoding='utf-8', errors='ignore') as f:
            raw_log = f.read()

        result = detect_anomaly(file_path)
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
            
        # Include raw log in response for the frontend to pass to chat
        result["raw_log"] = raw_log
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Handles follow-up questions using Google Gemini Pro.
    Provides context about the specific log and the anomaly result.
    """
    try:
        # Construct a rich prompt with context
        system_prompt = (
            "You are a Senior DevOps AI Expert and a friendly mentor. "
            "Your goal is to explain log anomalies to a student in simple, helpful terms. "
            f"CONTEXT OF THE CURRENT LOG FILE:\n{request.context.get('log')}\n\n"
            f"DETECTION RESULT:\n{request.context.get('result')}\n\n"
            "INSTRUCTIONS:\n"
            "1. If the user asks for a detailed explanation, be thorough but simple.\n"
            "2. If they ask follow-up questions, answer based on the log provided.\n"
            "3. If they ask for a flowchart, describe it in steps or use Mermaid syntax.\n"
            "4. Only answer questions related to DevOps, Logs, HDFS, or the provided data."
        )

        # Combine history for context
        full_prompt = system_prompt + "\n\nCHAT HISTORY:\n"
        for msg in request.history:
            role = "User" if msg['role'] == 'user' else "AI"
            full_prompt += f"{role}: {msg['content']}\n"
        
        full_prompt += f"\nUser Question: {request.message}\nAI Reply:"

        response = model.generate_content(full_prompt)
        return {"reply": response.text}

    except Exception as e:
        print(f"Gemini Error: {e}")
        return {"reply": "I'm having trouble thinking right now. Please make sure your Gemini API key is valid in app.py."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
