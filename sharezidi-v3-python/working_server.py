"""
ShareZidi v3.0 - Working FastAPI Server
No emojis to avoid Unicode issues
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import json
import uuid
import logging
from typing import Dict, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ShareZidi v3.0 - P2P File Transfer",
    description="Revolutionary P2P file transfer with WebRTC",
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
        self.transfers: Dict[str, Dict] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected")
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        logger.info(f"Client {client_id} disconnected")
    
    async def send_to_client(self, client_id: str, message: str):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_text(message)
                return True
            except Exception as e:
                logger.error(f"Failed to send message to {client_id}: {e}")
                return False
        return False

manager = ConnectionManager()

@app.get("/")
async def root():
    return {
        "message": "ShareZidi v3.0 - P2P File Transfer",
        "status": "running",
        "features": [
            "WebSocket P2P streaming",
            "Real-time progress tracking", 
            "Multi-device support",
            "Mobile optimized"
        ]
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "active_connections": len(manager.active_connections),
        "active_transfers": len(manager.transfers)
    }

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    
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
    """Handle WebSocket messages"""
    message_type = message.get("type")
    
    if message_type == "ping":
        await websocket.send_text(json.dumps({"type": "pong", "timestamp": message.get("timestamp")}))
    
    elif message_type == "file_transfer_start":
        await handle_file_transfer_start(client_id, message, websocket)
    
    elif message_type == "file_chunk":
        await handle_file_chunk(client_id, message, websocket)
    
    elif message_type == "chunk_ack":
        await handle_chunk_ack(client_id, message, websocket)
    
    elif message_type == "transfer_complete":
        await handle_transfer_complete(client_id, message, websocket)
    
    else:
        logger.warning(f"Unknown message type: {message_type}")

async def handle_file_transfer_start(client_id: str, message: Dict, websocket: WebSocket):
    """Handle file transfer initiation"""
    file_info = message.get("file_info", {})
    receiver_id = message.get("receiver_id")
    
    if not receiver_id:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Receiver ID required"
        }))
        return
    
    transfer_id = str(uuid.uuid4())
    
    # Create transfer record
    manager.transfers[transfer_id] = {
        "id": transfer_id,
        "file_info": file_info,
        "sender_id": client_id,
        "receiver_id": receiver_id,
        "status": "pending",
        "progress": 0,
        "chunks_received": 0,
        "total_chunks": file_info.get("total_chunks", 0)
    }
    
    # Notify receiver
    await manager.send_to_client(receiver_id, json.dumps({
        "type": "incoming_transfer",
        "transfer_id": transfer_id,
        "file_info": file_info,
        "sender_id": client_id
    }))
    
    # Confirm to sender
    await websocket.send_text(json.dumps({
        "type": "transfer_started",
        "transfer_id": transfer_id,
        "status": "pending"
    }))
    
    logger.info(f"Transfer {transfer_id} started from {client_id} to {receiver_id}")

async def handle_file_chunk(client_id: str, message: Dict, websocket: WebSocket):
    """Handle file chunk data - FORWARD ONLY, NO STORAGE"""
    transfer_id = message.get("transfer_id")
    chunk_data = message.get("chunk_data")
    chunk_index = message.get("chunk_index")
    total_chunks = message.get("total_chunks")
    
    if not all([transfer_id, chunk_data, chunk_index is not None]):
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Missing required chunk data"
        }))
        return
    
    # Calculate progress
    progress = ((chunk_index + 1) / total_chunks) * 100
    
    # Update transfer progress
    if transfer_id in manager.transfers:
        manager.transfers[transfer_id]["progress"] = progress
        manager.transfers[transfer_id]["chunks_received"] = chunk_index + 1
    
    # Send progress update to sender
    await websocket.send_text(json.dumps({
        "type": "progress_update",
        "transfer_id": transfer_id,
        "progress": progress,
        "chunk_index": chunk_index
    }))
    
    # Forward chunk to receiver (P2P - no server storage)
    if transfer_id in manager.transfers:
        receiver_id = manager.transfers[transfer_id]["receiver_id"]
        await manager.send_to_client(receiver_id, json.dumps({
            "type": "file_chunk",
            "transfer_id": transfer_id,
            "chunk_data": chunk_data,
            "chunk_index": chunk_index,
            "total_chunks": total_chunks
        }))

async def handle_chunk_ack(client_id: str, message: Dict, websocket: WebSocket):
    """Handle chunk acknowledgment"""
    transfer_id = message.get("transfer_id")
    chunk_index = message.get("chunk_index")
    received_progress = message.get("received_progress", 0)
    
    if transfer_id in manager.transfers:
        sender_id = manager.transfers[transfer_id]["sender_id"]
        
        # Send ACK to sender
        await manager.send_to_client(sender_id, json.dumps({
            "type": "chunk_ack",
            "transfer_id": transfer_id,
            "chunk_index": chunk_index,
            "received_progress": received_progress
        }))

async def handle_transfer_complete(client_id: str, message: Dict, websocket: WebSocket):
    """Handle transfer completion"""
    transfer_id = message.get("transfer_id")
    
    if transfer_id in manager.transfers:
        manager.transfers[transfer_id]["status"] = "completed"
        manager.transfers[transfer_id]["progress"] = 100
        
        # Notify sender
        sender_id = manager.transfers[transfer_id]["sender_id"]
        await manager.send_to_client(sender_id, json.dumps({
            "type": "transfer_completed",
            "transfer_id": transfer_id,
            "status": "completed"
        }))
        
        logger.info(f"Transfer {transfer_id} completed")

@app.get("/test", response_class=HTMLResponse)
async def test_page():
    """Test page for WebSocket testing"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>ShareZidi v3.0 Test</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .connected { background-color: #d4edda; color: #155724; }
            .disconnected { background-color: #f8d7da; color: #721c24; }
            #messages { border: 1px solid #ccc; height: 300px; overflow-y: scroll; padding: 10px; }
        </style>
    </head>
    <body>
        <h1>ShareZidi v3.0 - WebSocket Test</h1>
        <div id="status" class="disconnected">Connecting...</div>
        <div id="messages"></div>
        
        <script>
            const clientId = 'test-client-' + Math.random().toString(36).substr(2, 9);
            const ws = new WebSocket(`ws://localhost:8000/ws/${clientId}`);
            
            ws.onopen = function(event) {
                document.getElementById('status').textContent = 'Connected!';
                document.getElementById('status').className = 'status connected';
                console.log('WebSocket connected');
            };
            
            ws.onmessage = function(event) {
                const message = JSON.parse(event.data);
                console.log('Received:', message);
                
                const messagesDiv = document.getElementById('messages');
                messagesDiv.innerHTML += '<div>' + JSON.stringify(message, null, 2) + '</div>';
            };
            
            ws.onclose = function(event) {
                document.getElementById('status').textContent = 'Disconnected';
                document.getElementById('status').className = 'status disconnected';
            };
            
            // Send ping every 5 seconds
            setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'ping',
                        timestamp: Date.now()
                    }));
                }
            }, 5000);
        </script>
    </body>
    </html>
    """

if __name__ == "__main__":
    import uvicorn
    print("Starting ShareZidi v3.0 - P2P File Transfer")
    print("Open http://localhost:8002/test for WebSocket testing")
    print("API docs: http://localhost:8002/docs")
    uvicorn.run(app, host="127.0.0.1", port=8002, log_level="info")
