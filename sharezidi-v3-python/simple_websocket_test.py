"""
Simple WebSocket Test Server
Clean, minimal test for WebSocket connection
"""

from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ShareZidi v3.0 - Simple WebSocket Test")

# Store connections
connections = {}

@app.get("/")
async def root():
    return {
        "message": "ShareZidi v3.0 - Simple WebSocket Test",
        "status": "running",
        "connections": len(connections)
    }

@app.get("/test2", response_class=HTMLResponse)
async def test2():
    return """
<!DOCTYPE html>
<html>
<head>
    <title>ShareZidi v3.0 - Simple Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .connected { background-color: #d4edda; color: #155724; }
        .disconnected { background-color: #f8d7da; color: #721c24; }
        #messages { border: 1px solid #ccc; height: 300px; overflow-y: scroll; padding: 10px; }
        button { padding: 10px 15px; margin: 5px; cursor: pointer; }
    </style>
</head>
<body>
    <h1>ShareZidi v3.0 - Simple Test</h1>
    <div id="status" class="disconnected">Connecting...</div>
    
    <div>
        <button onclick="sendPing()">Send Ping</button>
        <button onclick="clearMessages()">Clear Messages</button>
    </div>
    
    <div id="messages"></div>
    
    <script>
        const clientId = 'simple-' + Math.random().toString(36).substr(2, 9);
        console.log('Connecting to WebSocket as', clientId);
        
        // Use port 8005 to avoid conflicts
        const ws = new WebSocket(`ws://localhost:8005/ws/${clientId}`);
        
        ws.onopen = function(event) {
            document.getElementById('status').textContent = 'Connected!';
            document.getElementById('status').className = 'status connected';
            console.log('WebSocket connected successfully!');
            log('WebSocket connected to port 8005');
        };
        
        ws.onmessage = function(event) {
            const message = JSON.parse(event.data);
            console.log('Received:', message);
            log('Received: ' + JSON.stringify(message));
        };
        
        ws.onclose = function(event) {
            document.getElementById('status').textContent = 'Disconnected';
            document.getElementById('status').className = 'status disconnected';
            console.log('WebSocket closed:', event.code, event.reason);
            log('WebSocket closed: ' + event.code + ' - ' + event.reason);
        };
        
        ws.onerror = function(error) {
            console.log('WebSocket error:', error);
            log('WebSocket error: ' + error);
        };
        
        function log(message) {
            const messagesDiv = document.getElementById('messages');
            const timestamp = new Date().toLocaleTimeString();
            messagesDiv.innerHTML += `<div><strong>[${timestamp}]</strong> ${message}</div>`;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        function sendPing() {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
                log('Sent ping');
            } else {
                log('WebSocket not connected');
            }
        }
        
        function clearMessages() {
            document.getElementById('messages').innerHTML = '';
        }
    </script>
</body>
</html>
    """

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket, client_id: str):
    await websocket.accept()
    connections[client_id] = websocket
    logger.info(f"Client {client_id} connected")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "client_id": client_id,
                    "timestamp": "2025-10-23T03:40:00Z"
                }))
                logger.info(f"Ping received from {client_id}")
            
    except Exception as e:
        logger.error(f"WebSocket error for {client_id}: {e}")
    finally:
        if client_id in connections:
            del connections[client_id]
        logger.info(f"Client {client_id} disconnected")

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Simple WebSocket Test Server")
    print("📡 WebSocket will run on port 8005")
    print("🌐 Test page: http://localhost:8005/test2")
    print("=" * 50)
    uvicorn.run(app, host="127.0.0.1", port=8005, log_level="info")




