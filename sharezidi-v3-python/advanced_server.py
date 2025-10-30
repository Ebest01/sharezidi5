"""
ShareZidi v3.0 - Advanced P2P File Transfer Server
WebRTC + WebSocket + Real-time Progress Tracking
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import json
import uuid
import logging
from typing import Dict, Optional
from datetime import datetime

from webrtc_manager import webrtc_manager, p2p_transfer_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ShareZidi v3.0 - Advanced P2P File Transfer",
    description="Revolutionary P2P file transfer with WebRTC and real-time optimization",
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
        self.client_info[client_id] = client_info or {}
        logger.info(f"Client {client_id} connected")
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.client_info:
            del self.client_info[client_id]
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
    
    async def broadcast_to_clients(self, message: str, exclude: Optional[str] = None):
        """Broadcast message to all connected clients"""
        for client_id, connection in self.active_connections.items():
            if exclude and client_id == exclude:
                continue
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Failed to broadcast to {client_id}: {e}")
    
    async def broadcast_to_others(self, sender_id: str, message: Dict):
        """Broadcast message to all clients except sender"""
        message_str = json.dumps(message)
        logger.info(f"Broadcasting from {sender_id} to {len(self.active_connections)-1} other clients: {message}")
        for client_id, connection in self.active_connections.items():
            if client_id != sender_id:
                try:
                    await connection.send_text(message_str)
                    logger.info(f"Successfully sent message to {client_id}")
                except Exception as e:
                    logger.error(f"Failed to broadcast to {client_id}: {e}")

manager = ConnectionManager()

@app.get("/")
async def root():
    return {
        "message": "ShareZidi v3.0 - Advanced P2P File Transfer",
        "status": "running",
        "features": [
            "WebRTC P2P streaming",
            "Real-time progress tracking",
            "Adaptive optimization",
            "Multi-device support",
            "Mobile optimized"
        ],
        "active_connections": len(manager.active_connections),
        "active_transfers": len(p2p_transfer_manager.active_transfers)
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "active_connections": len(manager.active_connections),
        "active_transfers": len(p2p_transfer_manager.active_transfers),
        "webrtc_connections": len(webrtc_manager.active_connections),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/stats")
async def get_stats():
    """Get detailed server statistics"""
    return {
        "connections": {
            "total": len(manager.active_connections),
            "clients": list(manager.client_info.keys())
        },
        "transfers": {
            "total": len(p2p_transfer_manager.active_transfers),
            "pending": len([t for t in p2p_transfer_manager.active_transfers.values() if t["status"] == "pending"]),
            "active": len([t for t in p2p_transfer_manager.active_transfers.values() if t["status"] == "active"]),
            "completed": len([t for t in p2p_transfer_manager.active_transfers.values() if t["status"] == "completed"])
        },
        "webrtc": {
            "connections": len(webrtc_manager.active_connections),
            "pending_offers": len(webrtc_manager.pending_offers),
            "pending_answers": len(webrtc_manager.pending_answers)
        }
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
    """Handle WebSocket messages"""
    logger.info(f"Received message from {client_id}: {message}")
    message_type = message.get("type")
    
    if message_type == "ping":
        await websocket.send_text(json.dumps({
            "type": "pong", 
            "timestamp": message.get("timestamp"),
            "server_time": datetime.now().isoformat()
        }))
    
    elif message_type == "broadcast":
        # Broadcast message to all other clients
        await manager.broadcast_to_others(client_id, {
            "type": "message_from_client",
            "from_client": client_id,
            "content": message.get("content", ""),
            "timestamp": datetime.now().isoformat()
        })
        logger.info(f"Client {client_id} broadcasted message to others")
    
    elif message_type == "send_to_client":
        # Send message to specific client
        target_client = message.get("target_client")
        if target_client and target_client in manager.active_connections:
            await manager.send_to_client(target_client, json.dumps({
                "type": "message_from_client",
                "from_client": client_id,
                "content": message.get("content", ""),
                "timestamp": datetime.now().isoformat()
            }))
            logger.info(f"Client {client_id} sent message to {target_client}")
        else:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Target client {target_client} not found"
            }))
    
    elif message_type == "client_info":
        # Update client information
        if client_id in manager.client_info:
            manager.client_info[client_id].update(message.get("info", {}))
            logger.info(f"Client {client_id} info updated")
    
    elif message_type == "file_transfer_start":
        await handle_file_transfer_start(client_id, message, websocket)
    
    elif message_type == "webrtc_offer":
        await handle_webrtc_offer(client_id, message, websocket)
    
    elif message_type == "webrtc_answer":
        await handle_webrtc_answer(client_id, message, websocket)
    
    elif message_type == "webrtc_ice_candidate":
        await handle_webrtc_ice_candidate(client_id, message, websocket)
    
    elif message_type == "file_chunk":
        await handle_file_chunk(client_id, message, websocket)
    
    elif message_type == "chunk_ack":
        await handle_chunk_ack(client_id, message, websocket)
    
    elif message_type == "transfer_progress":
        await handle_transfer_progress(client_id, message, websocket)
    
    elif message_type == "transfer_complete":
        await handle_transfer_complete(client_id, message, websocket)
    
    elif message_type == "get_transfers":
        await handle_get_transfers(client_id, message, websocket)
    
    else:
        logger.warning(f"Unknown message type: {message_type}")

async def handle_file_transfer_start(client_id: str, message: Dict, websocket: WebSocket):
    """Handle file transfer initiation with WebRTC support"""
    file_info = message.get("file_info", {})
    receiver_id = message.get("receiver_id")
    use_webrtc = message.get("use_webrtc", True)
    
    if not receiver_id:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Receiver ID required"
        }))
        return
    
    if not file_info:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "File info required"
        }))
        return
    
    try:
        if use_webrtc:
            # Start P2P transfer with WebRTC
            transfer_id = await p2p_transfer_manager.start_transfer(
                client_id, receiver_id, file_info
            )
            
            # Get WebRTC connection info
            connection_info = await webrtc_manager.get_connection_info(
                p2p_transfer_manager.active_transfers[transfer_id]["connection_id"]
            )
            
            # Notify receiver about incoming transfer
            await manager.send_to_client(receiver_id, json.dumps({
                "type": "incoming_transfer",
                "transfer_id": transfer_id,
                "file_info": file_info,
                "sender_id": client_id,
                "use_webrtc": True,
                "connection_id": connection_info["connection_id"] if connection_info else None
            }))
            
            # Confirm to sender
            await websocket.send_text(json.dumps({
                "type": "transfer_started",
                "transfer_id": transfer_id,
                "status": "pending",
                "use_webrtc": True,
                "connection_id": connection_info["connection_id"] if connection_info else None
            }))
            
        else:
            # Fallback to WebSocket transfer
            transfer_id = str(uuid.uuid4())
            
            # Notify receiver
            await manager.send_to_client(receiver_id, json.dumps({
                "type": "incoming_transfer",
                "transfer_id": transfer_id,
                "file_info": file_info,
                "sender_id": client_id,
                "use_webrtc": False
            }))
            
            # Confirm to sender
            await websocket.send_text(json.dumps({
                "type": "transfer_started",
                "transfer_id": transfer_id,
                "status": "pending",
                "use_webrtc": False
            }))
        
        logger.info(f"File transfer started: {transfer_id} from {client_id} to {receiver_id}")
        
    except Exception as e:
        logger.error(f"Error starting transfer: {e}")
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Failed to start transfer: {str(e)}"
        }))

async def handle_webrtc_offer(client_id: str, message: Dict, websocket: WebSocket):
    """Handle WebRTC offer"""
    connection_id = message.get("connection_id")
    offer = message.get("offer")
    
    if not connection_id or not offer:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Connection ID and offer required"
        }))
        return
    
    success = await webrtc_manager.handle_offer(connection_id, offer, client_id)
    
    if success:
        # Forward offer to receiver
        connection_info = await webrtc_manager.get_connection_info(connection_id)
        if connection_info:
            await manager.send_to_client(connection_info["receiver_id"], json.dumps({
                "type": "webrtc_offer",
                "connection_id": connection_id,
                "offer": offer,
                "sender_id": client_id
            }))
    
    await websocket.send_text(json.dumps({
        "type": "webrtc_offer_processed",
        "connection_id": connection_id,
        "success": success
    }))

async def handle_webrtc_answer(client_id: str, message: Dict, websocket: WebSocket):
    """Handle WebRTC answer"""
    connection_id = message.get("connection_id")
    answer = message.get("answer")
    
    if not connection_id or not answer:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Connection ID and answer required"
        }))
        return
    
    success = await webrtc_manager.handle_answer(connection_id, answer, client_id)
    
    if success:
        # Forward answer to sender
        connection_info = await webrtc_manager.get_connection_info(connection_id)
        if connection_info:
            await manager.send_to_client(connection_info["sender_id"], json.dumps({
                "type": "webrtc_answer",
                "connection_id": connection_id,
                "answer": answer,
                "receiver_id": client_id
            }))
    
    await websocket.send_text(json.dumps({
        "type": "webrtc_answer_processed",
        "connection_id": connection_id,
        "success": success
    }))

async def handle_webrtc_ice_candidate(client_id: str, message: Dict, websocket: WebSocket):
    """Handle WebRTC ICE candidate"""
    connection_id = message.get("connection_id")
    candidate = message.get("candidate")
    
    if not connection_id or not candidate:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Connection ID and candidate required"
        }))
        return
    
    success = await webrtc_manager.handle_ice_candidate(connection_id, candidate, client_id)
    
    if success:
        # Forward ICE candidate to the other peer
        connection_info = await webrtc_manager.get_connection_info(connection_id)
        if connection_info:
            target_id = connection_info["receiver_id"] if client_id == connection_info["sender_id"] else connection_info["sender_id"]
            await manager.send_to_client(target_id, json.dumps({
                "type": "webrtc_ice_candidate",
                "connection_id": connection_id,
                "candidate": candidate,
                "from_client": client_id
            }))
    
    await websocket.send_text(json.dumps({
        "type": "webrtc_ice_candidate_processed",
        "connection_id": connection_id,
        "success": success
    }))

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
    if transfer_id in p2p_transfer_manager.active_transfers:
        await p2p_transfer_manager.update_transfer_progress(
            transfer_id, progress, chunks_sent=chunk_index + 1
        )
    
    # Send progress update to sender
    await websocket.send_text(json.dumps({
        "type": "progress_update",
        "transfer_id": transfer_id,
        "progress": progress,
        "chunk_index": chunk_index
    }))
    
    # Forward chunk to receiver (P2P - no server storage)
    if transfer_id in p2p_transfer_manager.active_transfers:
        transfer_info = p2p_transfer_manager.active_transfers[transfer_id]
        receiver_id = transfer_info["receiver_id"]
        
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
    
    if transfer_id in p2p_transfer_manager.active_transfers:
        transfer_info = p2p_transfer_manager.active_transfers[transfer_id]
        sender_id = transfer_info["sender_id"]
        
        # Update receiver progress
        await p2p_transfer_manager.update_transfer_progress(
            transfer_id, received_progress, chunks_received=chunk_index + 1
        )
        
        # Send ACK to sender
        await manager.send_to_client(sender_id, json.dumps({
            "type": "chunk_ack",
            "transfer_id": transfer_id,
            "chunk_index": chunk_index,
            "received_progress": received_progress
        }))

async def handle_transfer_progress(client_id: str, message: Dict, websocket: WebSocket):
    """Handle transfer progress updates"""
    transfer_id = message.get("transfer_id")
    progress = message.get("progress")
    speed = message.get("speed", 0)
    eta = message.get("eta", 0)
    
    if transfer_id in p2p_transfer_manager.active_transfers:
        await p2p_transfer_manager.update_transfer_progress(transfer_id, progress)
        
        # Update transfer stats
        if transfer_id in p2p_transfer_manager.transfer_stats:
            stats = p2p_transfer_manager.transfer_stats[transfer_id]
            stats["bytes_transferred"] = message.get("bytes_transferred", 0)
            stats["network_quality"] = message.get("network_quality", "unknown")

async def handle_transfer_complete(client_id: str, message: Dict, websocket: WebSocket):
    """Handle transfer completion"""
    transfer_id = message.get("transfer_id")
    
    if transfer_id in p2p_transfer_manager.active_transfers:
        await p2p_transfer_manager.complete_transfer(transfer_id)
        
        transfer_info = p2p_transfer_manager.active_transfers[transfer_id]
        sender_id = transfer_info["sender_id"]
        receiver_id = transfer_info["receiver_id"]
        
        # Notify both sender and receiver
        for target_id in [sender_id, receiver_id]:
            await manager.send_to_client(target_id, json.dumps({
                "type": "transfer_completed",
                "transfer_id": transfer_id,
                "status": "completed"
            }))
        
        logger.info(f"Transfer {transfer_id} completed")

async def handle_get_transfers(client_id: str, message: Dict, websocket: WebSocket):
    """Handle request for transfer information"""
    transfers = await p2p_transfer_manager.get_transfers_for_client(client_id)
    
    await websocket.send_text(json.dumps({
        "type": "transfers_list",
        "transfers": transfers
    }))

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
        // FIXED: Using correct port 8003
        const ws = new WebSocket(`ws://localhost:8003/ws/${clientId}?device_type=desktop&supports_webrtc=true&supports_p2p=true`);
        
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
    """Advanced test page for WebSocket and WebRTC testing"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>ShareZidi v3.0 - Advanced Test</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .connected { background-color: #d4edda; color: #155724; }
            .disconnected { background-color: #f8d7da; color: #721c24; }
            #messages { border: 1px solid #ccc; height: 400px; overflow-y: scroll; padding: 10px; }
            .controls { margin: 20px 0; }
            button { padding: 10px 15px; margin: 5px; cursor: pointer; }
            input, select { padding: 8px; margin: 5px; }
        </style>
    </head>
    <body>
        <h1>ShareZidi v3.0 - Advanced P2P Test</h1>
        <div id="status" class="disconnected">Connecting...</div>
        
        <div class="controls">
            <button onclick="sendPing()">Send Ping</button>
            <button onclick="getStats()">Get Stats</button>
            <button onclick="getTransfers()">Get Transfers</button>
            <button onclick="clearMessages()">Clear Messages</button>
        </div>
        
        <div id="messages"></div>
        
        <script>
            const clientId = 'test-client-' + Math.random().toString(36).substr(2, 9);
            const ws = new WebSocket(`ws://localhost:8003/ws/${clientId}?device_type=desktop&supports_webrtc=true&supports_p2p=true`);
            
            ws.onopen = function(event) {
                document.getElementById('status').textContent = 'Connected!';
                document.getElementById('status').className = 'status connected';
                console.log('WebSocket connected');
                
                // Send client info
                ws.send(JSON.stringify({
                    type: 'client_info',
                    info: {
                        device_type: 'desktop',
                        supports_webrtc: true,
                        supports_p2p: true,
                        max_chunk_size: 1048576
                    }
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
            };
            
            function sendPing() {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'ping',
                        timestamp: Date.now()
                    }));
                }
            }
            
            function getStats() {
                if (ws.readyState === WebSocket.OPEN) {
                    fetch('/stats')
                        .then(response => response.json())
                        .then(data => {
                            const messagesDiv = document.getElementById('messages');
                            messagesDiv.innerHTML += `<div><strong>Server Stats:</strong> ${JSON.stringify(data, null, 2)}</div>`;
                        });
                }
            }
            
            function getTransfers() {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'get_transfers'
                    }));
                }
            }
            
            function clearMessages() {
                document.getElementById('messages').innerHTML = '';
            }
            
            // Auto ping every 10 seconds
            setInterval(sendPing, 10000);
        </script>
    </body>
    </html>
    """

if __name__ == "__main__":
    import uvicorn
    print("Starting ShareZidi v3.0 - Advanced P2P File Transfer")
    print("Open http://localhost:8003/test for advanced WebSocket testing")
    print("API docs: http://localhost:8003/docs")
    print("Stats: http://localhost:8003/stats")
    uvicorn.run(app, host="127.0.0.1", port=8003, log_level="info")
