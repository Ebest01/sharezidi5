"""
Simple test server to verify FastAPI is working
"""

from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "ShareZidi v3.0 Test Server", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    print("🚀 Starting ShareZidi v3.0 Test Server...")
    print("📱 Open http://localhost:8000 in your browser")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

