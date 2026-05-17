from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any
from anomaly_detector import detect_anomaly
import os
import shutil
from dotenv import load_dotenv
from routes.ai_routes import router as ai_router

# Load environment variables
load_dotenv(override=True)

# Initialize FastAPI app
app = FastAPI(title="AI Log Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Include AI routes
app.include_router(
    ai_router,
    prefix="/ai",
    tags=["AI Assistant"]
)

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



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
