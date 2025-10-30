"""
ShareZidi v3.0 - Ultimate P2P File Transfer
The most advanced file transfer system with WebRTC, streaming optimization, and seamless UX
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import asyncio
import json
import os
import uuid
import time
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

# Import our advanced modules
from webrtc_transfer import WebRTCFileTransfer, webrtc_manager, create_webrtc_transfer
from streaming_optimizer import streaming_engine, OptimizationConfig, OptimizationLevel
from p2p_transfer import P2PTransferManager, TransferMethod
from models import User, FileTransfer, Device
from auth import get_current_user
from database import get_db
from schemas import FileTransferCreate, FileTransferResponse, APIResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ShareZidi v3.0 - Ultimate P2P File Transfer",
    description="Revolutionary file transfer with WebRTC, streaming optimization, and seamless UX",
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

# Global managers
connection_manager = None
p2p_manager = P2PTransferManager()

@app.on_event("startup")
async def startup_event():
    """Initialize the ultimate streaming engine"""
    global connection_manager
    connection_manager = ConnectionManager()
    
    # Initialize streaming engine
    optimization = await streaming_engine.initialize()
    logger.info(f"Ultimate streaming engine initialized with optimization: {optimization}")

class ConnectionManager:
    """Advanced connection manager with WebRTC support"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.webrtc_connections: Dict[str, Any] = {}
        self.device_capabilities: Dict[str, Dict] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str, device_info: Dict = None):
        """Connect client with device capabilities"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        
        if device_info:
            self.device_capabilities[client_id] = device_info
        
        logger.info(f"Client {client_id} connected with capabilities: {device_info}")
    
    def disconnect(self, client_id: str):
        """Disconnect client and cleanup"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.device_capabilities:
            del self.device_capabilities[client_id]
        if client_id in self.webrtc_connections:
            del self.webrtc_connections[client_id]
        
        logger.info(f"Client {client_id} disconnected")
    
    async def send_to_client(self, client_id: str, message: str):
        """Send message to specific client"""
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_text(message)
                return True
            except Exception as e:
                logger.error(f"Failed to send message to {client_id}: {e}")
                return False
        return False
    
    async def broadcast(self, message: str, exclude: Optional[str] = None):
        """Broadcast message to all connected clients"""
        for client_id, connection in self.active_connections.items():
            if exclude and client_id == exclude:
                continue
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Failed to broadcast to {client_id}: {e}")
                # Remove dead connections
                if client_id in self.active_connections:
                    del self.active_connections[client_id]

@app.get("/")
async def root():
    return {
        "message": "ShareZidi v3.0 - Ultimate P2P File Transfer",
        "status": "running",
        "features": [
            "WebRTC P2P streaming",
            "Adaptive optimization",
            "Real-time progress tracking",
            "Multi-device support",
            "Ultimate performance"
        ]
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "active_connections": len(connection_manager.active_connections),
        "webrtc_connections": len(connection_manager.webrtc_connections),
        "optimization_level": "ultimate"
    }

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """Advanced WebSocket endpoint with WebRTC support"""
    await connection_manager.connect(websocket, client_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            await handle_advanced_message(client_id, message, websocket)
            
    except WebSocketDisconnect:
        connection_manager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        connection_manager.disconnect(client_id)

async def handle_advanced_message(client_id: str, message: Dict, websocket: WebSocket):
    """Handle advanced WebSocket messages with WebRTC support"""
    message_type = message.get("type")
    
    if message_type == "ping":
        await websocket.send_text(json.dumps({"type": "pong", "timestamp": message.get("timestamp")}))
    
    elif message_type == "device_capabilities":
        await handle_device_capabilities(client_id, message, websocket)
    
    elif message_type == "webrtc_offer":
        await handle_webrtc_offer(client_id, message, websocket)
    
    elif message_type == "webrtc_answer":
        await handle_webrtc_answer(client_id, message, websocket)
    
    elif message_type == "webrtc_ice_candidate":
        await handle_webrtc_ice_candidate(client_id, message, websocket)
    
    elif message_type == "file_transfer_start":
        await handle_ultimate_file_transfer_start(client_id, message, websocket)
    
    elif message_type == "file_chunk":
        await handle_optimized_file_chunk(client_id, message, websocket)
    
    elif message_type == "chunk_ack":
        await handle_chunk_ack(client_id, message, websocket)
    
    elif message_type == "transfer_complete":
        await handle_transfer_complete(client_id, message, websocket)
    
    else:
        logger.warning(f"Unknown message type: {message_type}")

async def handle_device_capabilities(client_id: str, message: Dict, websocket: WebSocket):
    """Handle device capabilities registration"""
    capabilities = message.get("capabilities", {})
    connection_manager.device_capabilities[client_id] = capabilities
    
    logger.info(f"Device {client_id} capabilities: {capabilities}")
    
    # Send confirmation
    await websocket.send_text(json.dumps({
        "type": "capabilities_registered",
        "status": "success"
    }))

async def handle_webrtc_offer(client_id: str, message: Dict, websocket: WebSocket):
    """Handle WebRTC offer for P2P connection"""
    offer = message.get("offer")
    target_client = message.get("target_client")
    
    if target_client and target_client in connection_manager.active_connections:
        # Forward offer to target client
        await connection_manager.send_to_client(target_client, json.dumps({
            "type": "webrtc_offer",
            "offer": offer,
            "from_client": client_id
        }))
        
        logger.info(f"WebRTC offer forwarded from {client_id} to {target_client}")
    else:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Target client not found"
        }))

async def handle_webrtc_answer(client_id: str, message: Dict, websocket: WebSocket):
    """Handle WebRTC answer"""
    answer = message.get("answer")
    target_client = message.get("target_client")
    
    if target_client and target_client in connection_manager.active_connections:
        await connection_manager.send_to_client(target_client, json.dumps({
            "type": "webrtc_answer",
            "answer": answer,
            "from_client": client_id
        }))
        
        logger.info(f"WebRTC answer forwarded from {client_id} to {target_client}")

async def handle_webrtc_ice_candidate(client_id: str, message: Dict, websocket: WebSocket):
    """Handle WebRTC ICE candidate"""
    candidate = message.get("candidate")
    target_client = message.get("target_client")
    
    if target_client and target_client in connection_manager.active_connections:
        await connection_manager.send_to_client(target_client, json.dumps({
            "type": "webrtc_ice_candidate",
            "candidate": candidate,
            "from_client": client_id
        }))

async def handle_ultimate_file_transfer_start(client_id: str, message: Dict, websocket: WebSocket):
    """Handle ultimate file transfer initiation with optimization"""
    file_info = message.get("file_info", {})
    receiver_id = message.get("receiver_id")
    transfer_method = message.get("method", "auto")
    
    if not receiver_id:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Receiver ID required"
        }))
        return
    
    transfer_id = str(uuid.uuid4())
    
    # Determine best transfer method
    if transfer_method == "auto":
        # Check device capabilities
        sender_caps = connection_manager.device_capabilities.get(client_id, {})
        receiver_caps = connection_manager.device_capabilities.get(receiver_id, {})
        
        if sender_caps.get("supports_webrtc") and receiver_caps.get("supports_webrtc"):
            transfer_method = "webrtc"
        else:
            transfer_method = "websocket"
    
    # Create optimized stream
    stream_config = await streaming_engine.create_optimized_stream(transfer_id, file_info)
    
    # Notify receiver
    await connection_manager.send_to_client(receiver_id, json.dumps({
        "type": "incoming_transfer",
        "transfer_id": transfer_id,
        "file_info": file_info,
        "sender_id": client_id,
        "method": transfer_method,
        "optimization": stream_config["optimization"]
    }))
    
    # Confirm to sender
    await websocket.send_text(json.dumps({
        "type": "transfer_started",
        "transfer_id": transfer_id,
        "method": transfer_method,
        "optimization": stream_config["optimization"],
        "status": "pending"
    }))
    
    logger.info(f"Ultimate transfer {transfer_id} started with method {transfer_method}")

async def handle_optimized_file_chunk(client_id: str, message: Dict, websocket: WebSocket):
    """Handle optimized file chunk with streaming optimization"""
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
    
    # Update streaming performance metrics
    await streaming_engine.update_stream_performance(transfer_id, {
        "chunk_index": chunk_index,
        "chunk_size": len(chunk_data),
        "timestamp": time.time()
    })
    
    # Calculate optimized progress
    progress = ((chunk_index + 1) / total_chunks) * 100
    
    # Send progress update to sender
    await websocket.send_text(json.dumps({
        "type": "progress_update",
        "transfer_id": transfer_id,
        "progress": progress,
        "chunk_index": chunk_index,
        "optimization": "active"
    }))
    
    # Forward chunk to receiver with optimization
    if transfer_id in streaming_engine.active_streams:
        receiver_id = streaming_engine.active_streams[transfer_id].get("receiver_id")
        if receiver_id:
            await connection_manager.send_to_client(receiver_id, json.dumps({
                "type": "file_chunk",
                "transfer_id": transfer_id,
                "chunk_data": chunk_data,
                "chunk_index": chunk_index,
                "total_chunks": total_chunks,
                "optimization": "streaming"
            }))

async def handle_chunk_ack(client_id: str, message: Dict, websocket: WebSocket):
    """Handle chunk acknowledgment with performance tracking"""
    transfer_id = message.get("transfer_id")
    chunk_index = message.get("chunk_index")
    received_progress = message.get("received_progress", 0)
    
    # Update performance metrics
    await streaming_engine.update_stream_performance(transfer_id, {
        "ack_received": True,
        "chunk_index": chunk_index,
        "progress": received_progress,
        "timestamp": time.time()
    })
    
    # Forward ACK to sender
    if transfer_id in streaming_engine.active_streams:
        sender_id = streaming_engine.active_streams[transfer_id].get("sender_id")
        if sender_id:
            await connection_manager.send_to_client(sender_id, json.dumps({
                "type": "chunk_ack",
                "transfer_id": transfer_id,
                "chunk_index": chunk_index,
                "received_progress": received_progress,
                "optimization": "tracked"
            }))

async def handle_transfer_complete(client_id: str, message: Dict, websocket: WebSocket):
    """Handle transfer completion with final metrics"""
    transfer_id = message.get("transfer_id")
    
    if transfer_id in streaming_engine.active_streams:
        # Get final performance report
        report = await streaming_engine.optimizer.get_optimization_report()
        
        # Notify sender
        sender_id = streaming_engine.active_streams[transfer_id].get("sender_id")
        if sender_id:
            await connection_manager.send_to_client(sender_id, json.dumps({
                "type": "transfer_completed",
                "transfer_id": transfer_id,
                "status": "completed",
                "performance_report": report
            }))
        
        # Cleanup
        del streaming_engine.active_streams[transfer_id]
        logger.info(f"Ultimate transfer {transfer_id} completed with report: {report}")

# API Routes
from routes import router
app.include_router(router, prefix="/api")

# Static file serving
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/{path:path}")
async def serve_spa(path: str):
    """Serve SPA for all non-API routes"""
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    return FileResponse("static/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
