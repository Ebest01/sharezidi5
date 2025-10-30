"""
ShareZidi v3.0 - Ultimate P2P File Transfer Server (TEST VERSION)
Real WebRTC with aiortc + Advanced Features - FIXED WEBSOCKET PORT
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import json
import uuid
import logging
from typing import Dict, Optional
from datetime import datetime

# Import our WebRTC components
try:
    from webrtc_transfer import webrtc_handler, webrtc_file_transfer, WEBRTC_AVAILABLE
    from webrtc_manager import webrtc_manager, p2p_transfer_manager
    WEBRTC_IMPORTS_AVAILABLE = True
except ImportError as e:
    WEBRTC_IMPORTS_AVAILABLE = False
    logging.warning(f"WebRTC imports failed: {e}")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ShareZidi v3.0 - Ultimate P2P File Transfer (TEST)",
    description="Revolutionary P2P file transfer with real WebRTC, adaptive optimization, and mobile support - TEST VERSION",
    version="3.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.client_info: Dict[str, Dict] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str, client_info: Dict = None):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        if client_info:
            self.client_info[client_id] = client_info
        logger.info(f"Client {client_id} connected")
        
        # Send welcome message
        await self.send_personal_message({
            "type": "connection_established",
            "client_id": client_id,
            "timestamp": datetime.now().isoformat(),
            "webrtc_available": WEBRTC_AVAILABLE
        }, client_id)
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.client_info:
            del self.client_info[client_id]
        logger.info(f"Client {client_id} disconnected")
    
    async def send_personal_message(self, message: Dict, client_id: str):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending message to {client_id}: {e}")
    
    async def broadcast(self, message: Dict):
        for client_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, client_id)

# Initialize connection manager
manager = ConnectionManager()

# Store active transfers
active_transfers: Dict[str, Dict] = {}

@app.get("/")
async def read_root():
    return {
        "message": "ShareZidi v3.0 - Ultimate P2P File Transfer (TEST)",
        "status": "running",
        "features": [
            "WebRTC P2P streaming",
            "Real-time progress tracking", 
            "Adaptive optimization",
            "Multi-device support",
            "Mobile optimized"
        ],
        "webrtc_available": WEBRTC_AVAILABLE,
        "active_connections": len(manager.active_connections)
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "active_connections": len(manager.active_connections),
        "active_transfers": len(active_transfers),
        "webrtc_connections": len(webrtc_handler.pcs) if WEBRTC_IMPORTS_AVAILABLE else 0,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/stats")
async def get_stats():
    return {
        "connections": {
            "total": len(manager.active_connections),
            "clients": list(manager.active_connections.keys())
        },
        "transfers": {
            "active": len(active_transfers),
            "webrtc_available": WEBRTC_AVAILABLE
        },
        "timestamp": datetime.now().isoformat()
    }

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    # Get client info from query parameters
    client_info = {
        "device_type": websocket.query_params.get("device_type", "unknown"),
        "supports_webrtc": websocket.query_params.get("supports_webrtc", "false").lower() == "true",
        "supports_p2p": websocket.query_params.get("supports_p2p", "false").lower() == "true",
        "max_chunk_size": int(websocket.query_params.get("max_chunk_size", "1048576")),  # 1MB default
        "ip_address": websocket.client.host if websocket.client else "unknown",
        "connected_at": datetime.now().isoformat()
    }
    
    await manager.connect(websocket, client_id, client_info)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            await handle_message(client_id, message, websocket)
            
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        manager.disconnect(client_id)

async def handle_message(client_id: str, message: Dict, websocket: WebSocket):
    """Handle incoming WebSocket messages"""
    message_type = message.get("type")
    
    if message_type == "ping":
        await manager.send_personal_message({
            "type": "pong",
            "timestamp": datetime.now().isoformat()
        }, client_id)
    
    elif message_type == "client_info":
        # Update client info
        manager.client_info[client_id].update(message)
        await manager.send_personal_message({
            "type": "client_info_updated",
            "status": "success"
        }, client_id)
    
    elif message_type == "start_transfer":
        await handle_start_transfer(client_id, message, websocket)
    
    elif message_type == "file_chunk":
        await handle_file_chunk(client_id, message, websocket)
    
    elif message_type == "transfer_complete":
        await handle_transfer_complete(client_id, message, websocket)
    
    else:
        logger.warning(f"Unknown message type: {message_type} from {client_id}")

async def handle_start_transfer(client_id: str, message: Dict, websocket: WebSocket):
    """Handle file transfer initiation"""
    try:
        file_info = message.get("file_info", {})
        receiver_id = message.get("receiver_id")
        
        if not receiver_id or not file_info:
            await manager.send_personal_message({
                "type": "error",
                "message": "Missing receiver_id or file_info"
            }, client_id)
            return
        
        # Check if receiver is connected
        if receiver_id not in manager.active_connections:
            await manager.send_personal_message({
                "type": "error", 
                "message": f"Receiver {receiver_id} not connected"
            }, client_id)
            return
        
        # Create transfer ID
        transfer_id = str(uuid.uuid4())
        
        # Store transfer info
        active_transfers[transfer_id] = {
            "id": transfer_id,
            "sender_id": client_id,
            "receiver_id": receiver_id,
            "file_info": file_info,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "progress": 0
        }
        
        # Notify receiver
        await manager.send_personal_message({
            "type": "incoming_transfer",
            "transfer_id": transfer_id,
            "sender_id": client_id,
            "file_info": file_info
        }, receiver_id)
        
        # Confirm to sender
        await manager.send_personal_message({
            "type": "transfer_started",
            "transfer_id": transfer_id,
            "status": "pending"
        }, client_id)
        
        logger.info(f"Transfer {transfer_id} started from {client_id} to {receiver_id}")
        
    except Exception as e:
        logger.error(f"Error starting transfer: {e}")
        await manager.send_personal_message({
            "type": "error",
            "message": str(e)
        }, client_id)

async def handle_file_chunk(client_id: str, message: Dict, websocket: WebSocket):
    """Handle file chunk data"""
    try:
        transfer_id = message.get("transfer_id")
        chunk_data = message.get("chunk_data")
        chunk_index = message.get("chunk_index")
        
        if transfer_id not in active_transfers:
            await manager.send_personal_message({
                "type": "error",
                "message": f"Transfer {transfer_id} not found"
            }, client_id)
            return
        
        transfer = active_transfers[transfer_id]
        
        # Forward chunk to receiver
        if client_id == transfer["sender_id"]:
            receiver_id = transfer["receiver_id"]
            await manager.send_personal_message({
                "type": "file_chunk",
                "transfer_id": transfer_id,
                "chunk_data": chunk_data,
                "chunk_index": chunk_index
            }, receiver_id)
            
            # Update progress
            total_chunks = transfer["file_info"].get("total_chunks", 1)
            progress = min(100, (chunk_index + 1) / total_chunks * 100)
            transfer["progress"] = progress
            
            # Send progress update to sender
            await manager.send_personal_message({
                "type": "transfer_progress",
                "transfer_id": transfer_id,
                "progress": progress,
                "chunk_index": chunk_index
            }, client_id)
        
    except Exception as e:
        logger.error(f"Error handling file chunk: {e}")

async def handle_transfer_complete(client_id: str, message: Dict, websocket: WebSocket):
    """Handle transfer completion"""
    try:
        transfer_id = message.get("transfer_id")
        
        if transfer_id in active_transfers:
            transfer = active_transfers[transfer_id]
            transfer["status"] = "completed"
            transfer["completed_at"] = datetime.now().isoformat()
            transfer["progress"] = 100
            
            # Notify both sender and receiver
            await manager.send_personal_message({
                "type": "transfer_completed",
                "transfer_id": transfer_id,
                "status": "completed"
            }, transfer["sender_id"])
            
            await manager.send_personal_message({
                "type": "transfer_completed", 
                "transfer_id": transfer_id,
                "status": "completed"
            }, transfer["receiver_id"])
            
            logger.info(f"Transfer {transfer_id} completed")
        
    except Exception as e:
        logger.error(f"Error handling transfer completion: {e}")

@app.get("/test2", response_class=HTMLResponse)
async def test2_page():
    """Clean test page for WebSocket testing - TEST2"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>ShareZidi v3.0 - Clean Test (TEST2)</title>
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
        <h1>ShareZidi v3.0 - Clean Test (TEST2)</h1>
        <div id="status" class="disconnected">Connecting...</div>
        
        <div>
            <button onclick="sendPing()">Send Ping</button>
            <button onclick="getStats()">Get Stats</button>
            <button onclick="clearMessages()">Clear Messages</button>
        </div>
        
        <div id="messages"></div>
        
        <script>
            const clientId = 'test2-client-' + Math.random().toString(36).substr(2, 9);
            console.log('TEST2: Connecting to WebSocket as', clientId);
            // FIXED: Using correct port 8004
            const ws = new WebSocket(`ws://localhost:8004/ws/${clientId}?device_type=desktop&supports_webrtc=true&supports_p2p=true`);
            
            ws.onopen = function(event) {
                document.getElementById('status').textContent = 'Connected!';
                document.getElementById('status').className = 'status connected';
                console.log('TEST2: WebSocket connected successfully!');
                log('WebSocket connected to port 8003');
            };
            
            ws.onmessage = function(event) {
                const message = JSON.parse(event.data);
                console.log('TEST2: Received:', message);
                log('Received: ' + JSON.stringify(message));
            };
            
            ws.onclose = function(event) {
                document.getElementById('status').textContent = 'Disconnected';
                document.getElementById('status').className = 'status disconnected';
                console.log('TEST2: WebSocket closed:', event.code, event.reason);
                log('WebSocket closed: ' + event.code + ' - ' + event.reason);
            };
            
            ws.onerror = function(error) {
                console.log('TEST2: WebSocket error:', error);
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
            
            function getStats() {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'get_stats' }));
                    log('Requested stats');
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

@app.get("/test", response_class=HTMLResponse)
async def test_page():
    """Ultimate test page for WebRTC and WebSocket testing"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>ShareZidi v3.0 - Ultimate Test (FIXED PORT)</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .connected { background-color: #d4edda; color: #155724; }
            .disconnected { background-color: #f8d7da; color: #721c24; }
            .webrtc { background-color: #d1ecf1; color: #0c5460; }
            #messages { border: 1px solid #ccc; height: 400px; overflow-y: scroll; padding: 10px; }
            .controls { margin: 20px 0; }
            button { padding: 10px 15px; margin: 5px; cursor: pointer; }
            input, select { padding: 8px; margin: 5px; }
        </style>
    </head>
    <body>
        <h1>ShareZidi v3.0 - Ultimate Test (FIXED PORT)</h1>
        <div id="status" class="disconnected">Connecting...</div>
        <div id="webrtc-status" class="webrtc">Checking WebRTC...</div>
        
        <div class="controls">
            <button onclick="sendPing()">Send Ping</button>
            <button onclick="getStats()">Get Stats</button>
            <button onclick="clearMessages()">Clear Messages</button>
        </div>
        
        <div id="messages"></div>
        
        <script>
            const clientId = 'test-client-' + Math.random().toString(36).substr(2, 9);
            // FIXED: Using correct port 8003
            const ws = new WebSocket(`ws://localhost:8003/ws/${clientId}?device_type=desktop&supports_webrtc=true&supports_p2p=true`);
            
            ws.onopen = function(event) {
                document.getElementById('status').textContent = 'Connected!';
                document.getElementById('status').className = 'status connected';
                console.log('WebSocket connected');
                
                // Send client info
                ws.send(JSON.stringify({
                    type: 'client_info',
                    device_type: 'desktop',
                    supports_webrtc: true,
                    supports_p2p: true,
                    max_chunk_size: 1048576
                }));
            };
            
            ws.onmessage = function(event) {
                const message = JSON.parse(event.data);
                console.log('Received:', message);
                
                const messagesDiv = document.getElementById('messages');
                const timestamp = new Date().toLocaleTimeString();
                messagesDiv.innerHTML += `<div><strong>[${timestamp}]</strong> ${JSON.stringify(message, null, 2)}</div>`;
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            };
            
            ws.onclose = function(event) {
                document.getElementById('status').textContent = 'Disconnected';
                document.getElementById('status').className = 'status disconnected';
                console.log('WebSocket closed:', event.code, event.reason);
            };
            
            ws.onerror = function(error) {
                console.log('WebSocket error:', error);
            };
            
            function sendPing() {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ping' }));
                }
            }
            
            function getStats() {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'get_stats' }));
                }
            }
            
            function clearMessages() {
                document.getElementById('messages').innerHTML = '';
            }
        </script>
    </body>
    </html>
    """

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting ShareZidi v3.0 Ultimate Test Server")
    print("📡 WebSocket will run on port 8004")
    print("🌐 Test page: http://localhost:8004/test")
    print("🌐 Test2 page: http://localhost:8004/test2")
    print("📊 Stats: http://localhost:8004/stats")
    print("=" * 50)
    uvicorn.run(app, host="127.0.0.1", port=8004, log_level="info")
