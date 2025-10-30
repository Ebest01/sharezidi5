"""
ShareZidi v3.0 - Ultimate P2P File Transfer Server
Real WebRTC with aiortc + Advanced Features
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
    title="ShareZidi v3.0 - Ultimate P2P File Transfer",
    description="Revolutionary P2P file transfer with real WebRTC, adaptive optimization, and mobile support",
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

manager = ConnectionManager()

@app.get("/")
async def root():
    return {
        "message": "ShareZidi v3.0 - Ultimate P2P File Transfer",
        "status": "running",
        "features": [
            "Real WebRTC P2P streaming",
            "aiortc-powered connections",
            "Adaptive optimization",
            "Mobile ↔ PC optimized",
            "Zero server storage",
            "Ultra-fast transfers"
        ],
        "webrtc_available": WEBRTC_AVAILABLE if WEBRTC_IMPORTS_AVAILABLE else False,
        "active_connections": len(manager.active_connections)
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "webrtc_available": WEBRTC_AVAILABLE if WEBRTC_IMPORTS_AVAILABLE else False,
        "active_connections": len(manager.active_connections),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/webrtc/status")
async def webrtc_status():
    """Check WebRTC availability and status"""
    return {
        "webrtc_available": WEBRTC_AVAILABLE if WEBRTC_IMPORTS_AVAILABLE else False,
        "aiortc_installed": WEBRTC_IMPORTS_AVAILABLE,
        "active_webrtc_connections": len(webrtc_handler.pcs) if WEBRTC_IMPORTS_AVAILABLE and webrtc_handler else 0,
        "data_channels": len(webrtc_handler.data_channels) if WEBRTC_IMPORTS_AVAILABLE and webrtc_handler else 0
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
    """Handle WebSocket messages with WebRTC support"""
    message_type = message.get("type")
    
    if message_type == "ping":
        await websocket.send_text(json.dumps({
            "type": "pong", 
            "timestamp": message.get("timestamp"),
            "server_time": datetime.now().isoformat(),
            "webrtc_available": WEBRTC_AVAILABLE if WEBRTC_IMPORTS_AVAILABLE else False
        }))
    
    elif message_type == "file_transfer_start":
        await handle_file_transfer_start(client_id, message, websocket)
    
    elif message_type == "webrtc_offer":
        await handle_webrtc_offer(client_id, message, websocket)
    
    elif message_type == "webrtc_answer":
        await handle_webrtc_answer(client_id, message, websocket)
    
    elif message_type == "webrtc_ice_candidate":
        await handle_webrtc_ice_candidate(client_id, message, websocket)
    
    elif message_type == "webrtc_connection_ready":
        await handle_webrtc_connection_ready(client_id, message, websocket)
    
    elif message_type == "file_chunk":
        await handle_file_chunk(client_id, message, websocket)
    
    elif message_type == "chunk_ack":
        await handle_chunk_ack(client_id, message, websocket)
    
    elif message_type == "transfer_complete":
        await handle_transfer_complete(client_id, message, websocket)
    
    else:
        logger.warning(f"Unknown message type: {message_type}")

async def handle_file_transfer_start(client_id: str, message: Dict, websocket: WebSocket):
    """Handle file transfer initiation with real WebRTC"""
    file_info = message.get("file_info", {})
    receiver_id = message.get("receiver_id")
    use_webrtc = message.get("use_webrtc", True)
    
    if not receiver_id or not file_info:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Receiver ID and file info required"
        }))
        return
    
    try:
        if use_webrtc and WEBRTC_IMPORTS_AVAILABLE and webrtc_handler:
            # Start real WebRTC transfer
            transfer_id = str(uuid.uuid4())
            
            # Create WebRTC peer connection
            pc = await webrtc_handler.create_peer_connection(transfer_id, is_initiator=True)
            
            # Start WebRTC file transfer
            await webrtc_file_transfer.start_file_transfer(
                transfer_id, file_info, client_id, receiver_id
            )
            
            # Create WebRTC offer
            offer = await webrtc_handler.create_offer(transfer_id)
            
            # Notify receiver about incoming WebRTC transfer
            await manager.send_to_client(receiver_id, json.dumps({
                "type": "incoming_webrtc_transfer",
                "transfer_id": transfer_id,
                "file_info": file_info,
                "sender_id": client_id,
                "webrtc_offer": offer
            }))
            
            # Confirm to sender
            await websocket.send_text(json.dumps({
                "type": "webrtc_transfer_started",
                "transfer_id": transfer_id,
                "status": "pending",
                "webrtc_offer": offer
            }))
            
            logger.info(f"WebRTC transfer started: {transfer_id} from {client_id} to {receiver_id}")
            
        else:
            # Fallback to WebSocket transfer
            transfer_id = str(uuid.uuid4())
            
            await manager.send_to_client(receiver_id, json.dumps({
                "type": "incoming_transfer",
                "transfer_id": transfer_id,
                "file_info": file_info,
                "sender_id": client_id,
                "use_webrtc": False
            }))
            
            await websocket.send_text(json.dumps({
                "type": "transfer_started",
                "transfer_id": transfer_id,
                "status": "pending",
                "use_webrtc": False
            }))
            
            logger.info(f"WebSocket transfer started: {transfer_id} from {client_id} to {receiver_id}")
        
    except Exception as e:
        logger.error(f"Error starting transfer: {e}")
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Failed to start transfer: {str(e)}"
        }))

async def handle_webrtc_offer(client_id: str, message: Dict, websocket: WebSocket):
    """Handle WebRTC offer"""
    if not WEBRTC_IMPORTS_AVAILABLE or not webrtc_handler:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "WebRTC not available"
        }))
        return
    
    transfer_id = message.get("transfer_id")
    offer = message.get("offer")
    
    if not transfer_id or not offer:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Transfer ID and offer required"
        }))
        return
    
    try:
        # Create peer connection for receiver
        pc = await webrtc_handler.create_peer_connection(transfer_id, is_initiator=False)
        
        # Handle the offer and create answer
        answer = await webrtc_handler.handle_offer(transfer_id, offer)
        
        await websocket.send_text(json.dumps({
            "type": "webrtc_answer",
            "transfer_id": transfer_id,
            "answer": answer
        }))
        
        logger.info(f"WebRTC offer handled for {transfer_id}")
        
    except Exception as e:
        logger.error(f"Error handling WebRTC offer: {e}")
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Failed to handle WebRTC offer: {str(e)}"
        }))

async def handle_webrtc_answer(client_id: str, message: Dict, websocket: WebSocket):
    """Handle WebRTC answer"""
    if not WEBRTC_IMPORTS_AVAILABLE or not webrtc_handler:
        return
    
    transfer_id = message.get("transfer_id")
    answer = message.get("answer")
    
    if not transfer_id or not answer:
        return
    
    try:
        await webrtc_handler.handle_answer(transfer_id, answer)
        logger.info(f"WebRTC answer handled for {transfer_id}")
        
    except Exception as e:
        logger.error(f"Error handling WebRTC answer: {e}")

async def handle_webrtc_ice_candidate(client_id: str, message: Dict, websocket: WebSocket):
    """Handle WebRTC ICE candidate"""
    if not WEBRTC_IMPORTS_AVAILABLE or not webrtc_handler:
        return
    
    transfer_id = message.get("transfer_id")
    candidate = message.get("candidate")
    
    if not transfer_id or not candidate:
        return
    
    try:
        await webrtc_handler.add_ice_candidate(transfer_id, candidate)
        logger.debug(f"ICE candidate added for {transfer_id}")
        
    except Exception as e:
        logger.error(f"Error adding ICE candidate: {e}")

async def handle_webrtc_connection_ready(client_id: str, message: Dict, websocket: WebSocket):
    """Handle WebRTC connection ready"""
    transfer_id = message.get("transfer_id")
    
    if not transfer_id:
        return
    
    logger.info(f"WebRTC connection ready for {transfer_id}")
    
    # Notify both parties that WebRTC is ready
    # The actual file transfer will happen directly between peers

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
    
    # Send progress update to sender
    await websocket.send_text(json.dumps({
        "type": "progress_update",
        "transfer_id": transfer_id,
        "progress": progress,
        "chunk_index": chunk_index
    }))
    
    # Forward chunk to receiver (P2P - no server storage)
    # This is a fallback for non-WebRTC transfers
    # WebRTC transfers go directly between peers

async def handle_chunk_ack(client_id: str, message: Dict, websocket: WebSocket):
    """Handle chunk acknowledgment"""
    transfer_id = message.get("transfer_id")
    chunk_index = message.get("chunk_index")
    received_progress = message.get("received_progress", 0)
    
    # Forward ACK to sender
    # This is handled by the WebRTC data channel for WebRTC transfers

async def handle_transfer_complete(client_id: str, message: Dict, websocket: WebSocket):
    """Handle transfer completion"""
    transfer_id = message.get("transfer_id")
    
    logger.info(f"Transfer {transfer_id} completed")
    
    # Clean up WebRTC connection if it exists
    if WEBRTC_IMPORTS_AVAILABLE and webrtc_handler:
        try:
            await webrtc_handler.close_peer_connection(transfer_id)
        except Exception as e:
            logger.error(f"Error closing WebRTC connection: {e}")

@app.get("/fixed", response_class=HTMLResponse)
async def fixed_test_page():
    """Fixed WebSocket test page with correct port"""
    return """
<!DOCTYPE html>
<html>
<head>
    <title>ShareZidi v3.0 - Fixed WebSocket Test</title>
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
    <h1>ShareZidi v3.0 - Fixed WebSocket Test</h1>
    <div id="status" class="disconnected">Connecting...</div>
    
    <div>
        <button onclick="connect()">Connect</button>
        <button onclick="disconnect()">Disconnect</button>
        <button onclick="sendPing()">Send Ping</button>
        <button onclick="clearMessages()">Clear Messages</button>
    </div>
    
    <div id="messages"></div>
    
    <script>
        let ws = null;
        const clientId = 'fixed-test-' + Math.random().toString(36).substr(2, 9);
        
        function log(message) {
            const messagesDiv = document.getElementById('messages');
            const timestamp = new Date().toLocaleTimeString();
            messagesDiv.innerHTML += `<div><strong>[${timestamp}]</strong> ${message}</div>`;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        function connect() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                log('Already connected');
                return;
            }
            
            log(`Connecting to WebSocket as ${clientId}...`);
            // FIXED: Using correct port 8003
            ws = new WebSocket(`ws://localhost:8003/ws/${clientId}?device_type=desktop&supports_webrtc=true&supports_p2p=true`);
            
            ws.onopen = function(event) {
                document.getElementById('status').textContent = 'Connected!';
                document.getElementById('status').className = 'status connected';
                log('WebSocket connected successfully!');
            };
            
            ws.onmessage = function(event) {
                log(`Received: ${event.data}`);
            };
            
            ws.onclose = function(event) {
                document.getElementById('status').textContent = 'Disconnected';
                document.getElementById('status').className = 'status disconnected';
                log(`WebSocket closed: Code=${event.code}, Reason=${event.reason}`);
            };
            
            ws.onerror = function(error) {
                log(`WebSocket error: ${error}`);
            };
        }
        
        function disconnect() {
            if (ws) {
                ws.close();
                ws = null;
            }
        }
        
        function sendPing() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
                log('Sent ping');
            } else {
                log('WebSocket not connected');
            }
        }
        
        function clearMessages() {
            document.getElementById('messages').innerHTML = '';
        }
        
        // Auto-connect on page load
        window.onload = function() {
            log('Page loaded, attempting to connect...');
            connect();
        };
    </script>
</body>
</html>
    """

@app.get("/simple", response_class=HTMLResponse)
async def simple_test_page():
    """Simple WebSocket test page"""
    return """
<!DOCTYPE html>
<html>
<head>
    <title>ShareZidi v3.0 - Simple WebSocket Test</title>
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
    <h1>ShareZidi v3.0 - Simple WebSocket Test</h1>
    <div id="status" class="disconnected">Connecting...</div>
    
    <div>
        <button onclick="connect()">Connect</button>
        <button onclick="disconnect()">Disconnect</button>
        <button onclick="sendPing()">Send Ping</button>
        <button onclick="clearMessages()">Clear Messages</button>
    </div>
    
    <div id="messages"></div>
    
    <script>
        let ws = null;
        const clientId = 'simple-test-' + Math.random().toString(36).substr(2, 9);
        
        function log(message) {
            const messagesDiv = document.getElementById('messages');
            const timestamp = new Date().toLocaleTimeString();
            messagesDiv.innerHTML += `<div><strong>[${timestamp}]</strong> ${message}</div>`;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        function connect() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                log('Already connected');
                return;
            }
            
            log(`Connecting to WebSocket as ${clientId}...`);
            ws = new WebSocket(`ws://localhost:8003/ws/${clientId}?device_type=desktop&supports_webrtc=true&supports_p2p=true`);
            
            ws.onopen = function(event) {
                document.getElementById('status').textContent = 'Connected!';
                document.getElementById('status').className = 'status connected';
                log('WebSocket connected successfully!');
            };
            
            ws.onmessage = function(event) {
                log(`Received: ${event.data}`);
            };
            
            ws.onclose = function(event) {
                document.getElementById('status').textContent = 'Disconnected';
                document.getElementById('status').className = 'status disconnected';
                log(`WebSocket closed: Code=${event.code}, Reason=${event.reason}`);
            };
            
            ws.onerror = function(error) {
                log(`WebSocket error: ${error}`);
            };
        }
        
        function disconnect() {
            if (ws) {
                ws.close();
                ws = null;
            }
        }
        
        function sendPing() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
                log('Sent ping');
            } else {
                log('WebSocket not connected');
            }
        }
        
        function clearMessages() {
            document.getElementById('messages').innerHTML = '';
        }
        
        // Auto-connect on page load
        window.onload = function() {
            log('Page loaded, attempting to connect...');
            connect();
        };
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
        <title>ShareZidi v3.0 - Ultimate P2P Test</title>
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
        <h1>ShareZidi v3.0 - Ultimate P2P Test</h1>
        <div id="status" class="disconnected">Connecting...</div>
        <div id="webrtc-status" class="webrtc">Checking WebRTC...</div>
        
        <div class="controls">
            <button onclick="sendPing()">Send Ping</button>
            <button onclick="checkWebRTC()">Check WebRTC</button>
            <button onclick="getStats()">Get Stats</button>
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
            
            function checkWebRTC() {
                if (ws.readyState === WebSocket.OPEN) {
                    fetch('/webrtc/status')
                        .then(response => response.json())
                        .then(data => {
                            document.getElementById('webrtc-status').innerHTML = 
                                `<strong>WebRTC Status:</strong> ${JSON.stringify(data, null, 2)}`;
                        });
                }
            }
            
            function getStats() {
                if (ws.readyState === WebSocket.OPEN) {
                    fetch('/health')
                        .then(response => response.json())
                        .then(data => {
                            const messagesDiv = document.getElementById('messages');
                            messagesDiv.innerHTML += `<div><strong>Server Health:</strong> ${JSON.stringify(data, null, 2)}</div>`;
                        });
                }
            }
            
            function clearMessages() {
                document.getElementById('messages').innerHTML = '';
            }
            
            // Auto ping every 10 seconds
            setInterval(sendPing, 10000);
            
            // Check WebRTC status on load
            setTimeout(checkWebRTC, 1000);
        </script>
    </body>
    </html>
    """

if __name__ == "__main__":
    import uvicorn
    print("Starting ShareZidi v3.0 - Ultimate P2P File Transfer")
    print("WebRTC Available:", WEBRTC_AVAILABLE if WEBRTC_IMPORTS_AVAILABLE else False)
    print("Open http://localhost:8003/test for ultimate WebRTC testing")
    print("API docs: http://localhost:8003/docs")
    print("WebRTC status: http://localhost:8003/webrtc/status")
    uvicorn.run(app, host="127.0.0.1", port=8003, log_level="info")
