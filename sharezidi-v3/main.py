"""
ShareZidi v3.0 - Python FastAPI Backend
Revolutionary file transfer with WebSocket, real-time progress, and chunk-based transfers
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import asyncio
import json
import os
import uuid
from typing import Dict, List, Optional
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ShareZidi v3.0",
    description="Revolutionary file transfer with WebSocket and real-time progress",
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
        self.file_transfers: Dict[str, Dict] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected")
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        logger.info(f"Client {client_id} disconnected")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)
    
    async def send_to_client(self, client_id: str, message: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_text(message)
    
    async def broadcast(self, message: str, exclude: Optional[str] = None):
        for client_id, connection in self.active_connections.items():
            if exclude and client_id == exclude:
                continue
            try:
                await connection.send_text(message)
            except:
                # Remove dead connections
                del self.active_connections[client_id]

manager = ConnectionManager()

# File transfer state management (P2P - NO FILE STORAGE)
class FileTransferManager:
    def __init__(self):
        self.transfers: Dict[str, Dict] = {}
        # NO chunks storage - P2P transfer only
    
    def create_transfer(self, transfer_id: str, file_info: Dict, sender_id: str, receiver_id: str):
        self.transfers[transfer_id] = {
            "id": transfer_id,
            "file_info": file_info,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "status": "pending",
            "progress": 0,
            "chunks_received": 0,
            "total_chunks": file_info.get("total_chunks", 0),
            "created_at": datetime.now().isoformat()
        }
        logger.info(f"Created P2P transfer {transfer_id} for file {file_info.get('name')}")
    
    def update_progress(self, transfer_id: str, progress: float):
        if transfer_id in self.transfers:
            self.transfers[transfer_id]["progress"] = progress
            logger.info(f"P2P Transfer {transfer_id} progress: {progress}%")
    
    def complete_transfer(self, transfer_id: str):
        if transfer_id in self.transfers:
            self.transfers[transfer_id]["status"] = "completed"
            self.transfers[transfer_id]["progress"] = 100
            logger.info(f"P2P Transfer {transfer_id} completed")

transfer_manager = FileTransferManager()

@app.get("/")
async def root():
    return {"message": "ShareZidi v3.0 - Python FastAPI Backend", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "active_connections": len(manager.active_connections)}

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            await handle_websocket_message(client_id, message, websocket)
            
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        manager.disconnect(client_id)

async def handle_websocket_message(client_id: str, message: Dict, websocket: WebSocket):
    """Handle incoming WebSocket messages"""
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
    transfer_manager.create_transfer(transfer_id, file_info, client_id, receiver_id)
    
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
    transfer_manager.update_progress(transfer_id, progress)
    
    # Send progress update to sender
    await websocket.send_text(json.dumps({
        "type": "progress_update",
        "transfer_id": transfer_id,
        "progress": progress,
        "chunk_index": chunk_index
    }))
    
    # Forward chunk to receiver (P2P - no server storage)
    if transfer_id in transfer_manager.transfers:
        receiver_id = transfer_manager.transfers[transfer_id]["receiver_id"]
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
    
    if transfer_id in transfer_manager.transfers:
        sender_id = transfer_manager.transfers[transfer_id]["sender_id"]
        
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
    
    if transfer_id in transfer_manager.transfers:
        transfer_manager.complete_transfer(transfer_id)
        
        # Notify sender
        sender_id = transfer_manager.transfers[transfer_id]["sender_id"]
        await manager.send_to_client(sender_id, json.dumps({
            "type": "transfer_completed",
            "transfer_id": transfer_id,
            "status": "completed"
        }))

# Static file serving
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/{path:path}")
async def serve_spa(path: str):
    """Serve SPA for all non-API routes"""
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    # Serve index.html for SPA routes
    return FileResponse("static/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
