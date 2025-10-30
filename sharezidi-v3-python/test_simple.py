#!/usr/bin/env python3
"""
Simple test server to verify the issue
"""
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI()

@app.get("/test", response_class=HTMLResponse)
async def test_page():
    return """
<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
</head>
<body>
    <h1>Test Page</h1>
    <div id="deviceId" style="margin: 10px 0; padding: 8px; background: #e8f4fd; border-radius: 4px; font-weight: bold;">
        ID: <span id="deviceIdValue">123-ABCDE</span>
    </div>
    <p>This is a test page with device ID</p>
</body>
</html>
    """

if __name__ == "__main__":
    import uvicorn
    print("Starting test server on port 8004")
    uvicorn.run(app, host="127.0.0.1", port=8004, log_level="info")




