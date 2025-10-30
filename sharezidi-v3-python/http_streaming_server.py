#!/usr/bin/env python3
"""
ShareZidi v3.0 - HTTP Streaming Server for Large File Transfers
Robust alternative to WebSocket-based transfers using HTTP chunked streaming
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Request, Response
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import uuid
import asyncio
from datetime import datetime
from typing import Dict, Optional
import aiofiles
import hashlib
import mimetypes

app = FastAPI(title="ShareZidi v3.0 - HTTP Streaming Server")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for active transfers (in production, use Redis or database)
active_transfers: Dict[str, Dict] = {}
transfer_metadata: Dict[str, Dict] = {}

# Create uploads directory
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class TransferManager:
    def __init__(self):
        self.transfers = {}
        self.device_ids = {}
    
    def generate_device_id(self):
        """Generate unique device ID like 149-XCABCD"""
        import random
        numbers = ''.join(random.choices('0123456789', k=3))
        letters = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=5))
        return f"{numbers}-{letters}"
    
    def register_device(self, device_id: str, client_info: Dict):
        """Register a new device"""
        self.device_ids[device_id] = {
            "id": device_id,
            "connected_at": datetime.now().isoformat(),
            "info": client_info
        }
        return device_id
    
    def get_devices(self):
        """Get list of connected devices"""
        return list(self.device_ids.values())
    
    def start_transfer(self, sender_id: str, receiver_id: str, file_info: Dict):
        """Start a new file transfer"""
        transfer_id = str(uuid.uuid4())
        self.transfers[transfer_id] = {
            "id": transfer_id,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "file_info": file_info,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "progress": 0,
            "chunks_sent": 0,
            "total_chunks": 0
        }
        return transfer_id
    
    def update_transfer_progress(self, transfer_id: str, progress: float, chunks_sent: int):
        """Update transfer progress"""
        if transfer_id in self.transfers:
            self.transfers[transfer_id]["progress"] = progress
            self.transfers[transfer_id]["chunks_sent"] = chunks_sent
    
    def complete_transfer(self, transfer_id: str):
        """Mark transfer as completed"""
        if transfer_id in self.transfers:
            self.transfers[transfer_id]["status"] = "completed"
            self.transfers[transfer_id]["completed_at"] = datetime.now().isoformat()

transfer_manager = TransferManager()

@app.get("/")
async def root():
    """Root endpoint with server info"""
    return {
        "message": "ShareZidi v3.0 - HTTP Streaming Server",
        "status": "running",
        "transfers": len(transfer_manager.transfers),
        "devices": len(transfer_manager.device_ids)
    }

@app.get("/devices")
async def get_devices():
    """Get list of connected devices"""
    return {
        "devices": transfer_manager.get_devices(),
        "total": len(transfer_manager.device_ids)
    }

@app.post("/register")
async def register_device(request: Request):
    """Register a new device"""
    data = await request.json()
    device_id = transfer_manager.generate_device_id()
    transfer_manager.register_device(device_id, data)
    return {"device_id": device_id, "status": "registered"}

@app.post("/transfer/start")
async def start_transfer(request: Request):
    """Start a new file transfer"""
    data = await request.json()
    sender_id = data.get("sender_id")
    receiver_id = data.get("receiver_id")
    file_info = data.get("file_info", {})
    
    if not sender_id or not receiver_id:
        raise HTTPException(status_code=400, detail="Missing sender_id or receiver_id")
    
    transfer_id = transfer_manager.start_transfer(sender_id, receiver_id, file_info)
    
    return {
        "transfer_id": transfer_id,
        "status": "started",
        "upload_url": f"/transfer/upload/{transfer_id}",
        "download_url": f"/transfer/download/{transfer_id}"
    }

@app.post("/transfer/upload/{transfer_id}")
async def upload_file_chunk(transfer_id: str, request: Request):
    """Upload file chunk via HTTP streaming"""
    if transfer_id not in transfer_manager.transfers:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    transfer = transfer_manager.transfers[transfer_id]
    
    # Get chunk info from headers
    chunk_index = int(request.headers.get("X-Chunk-Index", 0))
    total_chunks = int(request.headers.get("X-Total-Chunks", 1))
    file_name = request.headers.get("X-File-Name", "unknown")
    
    # Create file path
    file_path = os.path.join(UPLOAD_DIR, f"{transfer_id}_{file_name}")
    
    try:
        # Append chunk to file
        async with aiofiles.open(file_path, "ab") as f:
            async for chunk in request.stream():
                await f.write(chunk)
        
        # Update progress
        progress = ((chunk_index + 1) / total_chunks) * 100
        transfer_manager.update_transfer_progress(transfer_id, progress, chunk_index + 1)
        
        return {
            "status": "chunk_received",
            "chunk_index": chunk_index,
            "progress": progress,
            "transfer_id": transfer_id
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/transfer/download/{transfer_id}")
async def download_file(transfer_id: str):
    """Download file via HTTP streaming"""
    if transfer_id not in transfer_manager.transfers:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    transfer = transfer_manager.transfers[transfer_id]
    file_name = transfer["file_info"].get("name", "unknown")
    file_path = os.path.join(UPLOAD_DIR, f"{transfer_id}_{file_name}")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Get file size
    file_size = os.path.getsize(file_path)
    
    async def generate_file_chunks():
        """Generator to stream file in chunks"""
        chunk_size = 64 * 1024  # 64KB chunks
        chunk_index = 0
        async with aiofiles.open(file_path, "rb") as f:
            while True:
                chunk = await f.read(chunk_size)
                if not chunk:
                    break
                
                # Track downloaded chunks for progress
                if 'downloaded_chunks' not in transfer_manager.transfers[transfer_id]:
                    transfer_manager.transfers[transfer_id]['downloaded_chunks'] = set()
                transfer_manager.transfers[transfer_id]['downloaded_chunks'].add(chunk_index)
                chunk_index += 1
                
                yield chunk
    
    # Mark transfer as completed
    transfer_manager.complete_transfer(transfer_id)
    
    return StreamingResponse(
        generate_file_chunks(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename={file_name}",
            "Content-Length": str(file_size),
            "X-Transfer-ID": transfer_id
        }
    )

@app.get("/transfer/status/{transfer_id}")
async def get_transfer_status(transfer_id: str):
    """Get transfer status and progress"""
    if transfer_id not in transfer_manager.transfers:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    transfer = transfer_manager.transfers[transfer_id]
    
    # Calculate receiver progress based on downloaded chunks
    receiver_progress = 0
    if 'downloaded_chunks' in transfer:
        receiver_progress = len(transfer['downloaded_chunks'])
    
    return {
        **transfer,
        'receiver_progress': receiver_progress,
        'total_chunks': transfer.get('total_chunks', 0)
    }

@app.get("/test", response_class=HTMLResponse)
async def test_page():
    """Test page for HTTP streaming file transfers"""
    return """
<!DOCTYPE html>
<html>
<head>
    <title>ShareZidi v3.0 - HTTP Streaming Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .connected { background-color: #d4edda; color: #155724; }
        .disconnected { background-color: #f8d7da; color: #721c24; }
        button { padding: 10px 15px; margin: 5px; cursor: pointer; }
        input { padding: 5px; margin: 5px; }
        .progress-bar { width: 100%; height: 20px; background-color: #f0f0f0; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background-color: #4CAF50; transition: width 0.3s; }
        .device-list { margin: 10px 0; }
        .device-item { padding: 5px; margin: 2px; background-color: #f8f9fa; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>ShareZidi v3.0 - HTTP Streaming Test</h1>
    <div id="status" class="disconnected">Connecting...</div>
    <div id="deviceId" style="margin: 10px 0; padding: 8px; background: #e8f4fd; border-radius: 4px; font-weight: bold; display: none;">
        ID: <span id="deviceIdValue">Loading...</span>
    </div>
    
    <div>
        <button onclick="registerDevice()">Register Device</button>
        <button onclick="getDevices()">Get Devices</button>
        <button onclick="clearMessages()">Clear Messages</button>
    </div>
    
    <div class="device-list">
        <h3>Connected Devices:</h3>
        <div id="deviceList">Loading...</div>
    </div>
    
    <hr>
    <h2>File Transfer Test</h2>
    <div>
        <input type="file" id="fileInput" style="margin: 5px;">
        <button onclick="selectFile()">Select File</button>
    </div>
    
    <div id="fileInfo" style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; display: none;">
        <div><strong>Selected File:</strong> <span id="fileName"></span></div>
        <div><strong>Size:</strong> <span id="fileSize"></span></div>
        <div><strong>Type:</strong> <span id="fileType"></span></div>
    </div>
    
    <div>
        <select id="receiverSelect" style="margin: 5px;">
            <option value="">Select Receiver...</option>
        </select>
        <button onclick="startTransfer()" id="startBtn" disabled>Start Transfer</button>
    </div>
    
    <div id="transferProgress" style="margin: 20px 0; display: none;">
        <h3>Transfer Progress</h3>
        <div>
            <strong>Sender Progress:</strong>
            <div class="progress-bar">
                <div id="senderProgress" class="progress-fill" style="width: 0%;"></div>
            </div>
            <span id="senderPercent">0%</span>
        </div>
        <div>
            <strong>Receiver Progress:</strong>
            <div class="progress-bar">
                <div id="receiverProgress" class="progress-fill" style="width: 0%;"></div>
            </div>
            <span id="receiverPercent">0%</span>
        </div>
        <div id="transferStatus">Ready to transfer...</div>
        <div style="margin-top: 10px;">
            <button onclick="stopTransfer()" id="stopBtn" style="background-color: #dc3545; color: white;">Stop Sending</button>
            <button onclick="clearCache()" id="clearBtn" style="background-color: #6c757d; color: white;">Clear Cache</button>
        </div>
    </div>
    
    <div id="messages" style="border: 1px solid #ccc; height: 300px; overflow-y: scroll; padding: 10px; margin-top: 20px;">
    </div>

    <script>
        let myDeviceId = null;
        let selectedFile = null;
        let currentTransfer = null;
        let devices = {};
        let progressInterval = null;
        let isTransferring = false;
        
        function log(message) {
            const messagesDiv = document.getElementById('messages');
            const timestamp = new Date().toLocaleTimeString();
            messagesDiv.innerHTML += `<div><strong>[${timestamp}]</strong> ${message}</div>`;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        function updateStatus(message, isConnected = true) {
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = message;
            statusDiv.className = isConnected ? 'status connected' : 'status disconnected';
        }
        
        async function registerDevice() {
            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_agent: navigator.userAgent,
                        timestamp: new Date().toISOString()
                    })
                });
                
                const data = await response.json();
                myDeviceId = data.device_id;
                document.getElementById('deviceIdValue').textContent = myDeviceId;
                document.getElementById('deviceId').style.display = 'block';
                updateStatus('Connected!');
                log(`Device registered: ${myDeviceId}`);
                await getDevices();
            } catch (error) {
                log(`Registration failed: ${error.message}`);
                updateStatus('Registration failed', false);
            }
        }
        
        async function getDevices() {
            try {
                const response = await fetch('/devices');
                const data = await response.json();
                devices = {};
                data.devices.forEach(device => {
                    devices[device.id] = device;
                });
                updateDeviceList();
                updateReceiverSelect();
                log(`Found ${data.total} devices`);
            } catch (error) {
                log(`Failed to get devices: ${error.message}`);
            }
        }
        
        function updateDeviceList() {
            const deviceList = document.getElementById('deviceList');
            deviceList.innerHTML = '';
            Object.values(devices).forEach(device => {
                const deviceDiv = document.createElement('div');
                deviceDiv.className = 'device-item';
                deviceDiv.textContent = `${device.id} (${device.info.timestamp})`;
                deviceList.appendChild(deviceDiv);
            });
        }
        
        function updateReceiverSelect() {
            const select = document.getElementById('receiverSelect');
            select.innerHTML = '<option value="">Select Receiver...</option>';
            Object.values(devices).forEach(device => {
                if (device.id !== myDeviceId) {
                    const option = document.createElement('option');
                    option.value = device.id;
                    option.textContent = device.id;
                    select.appendChild(option);
                }
            });
        }
        
        function selectFile() {
            const fileInput = document.getElementById('fileInput');
            selectedFile = fileInput.files[0];
            
            if (selectedFile) {
                document.getElementById('fileName').textContent = selectedFile.name;
                document.getElementById('fileSize').textContent = formatFileSize(selectedFile.size);
                document.getElementById('fileType').textContent = selectedFile.type || 'Unknown';
                document.getElementById('fileInfo').style.display = 'block';
                document.getElementById('startBtn').disabled = false;
                log(`File selected: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`);
            }
        }
        
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        async function startTransfer() {
            const receiverId = document.getElementById('receiverSelect').value;
            if (!receiverId) {
                alert('Please select a receiver');
                return;
            }
            if (!selectedFile) {
                alert('Please select a file');
                return;
            }
            
            isTransferring = true;
            
            try {
                // Start transfer
                const response = await fetch('/transfer/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sender_id: myDeviceId,
                        receiver_id: receiverId,
                        file_info: {
                            name: selectedFile.name,
                            size: selectedFile.size,
                            type: selectedFile.type
                        }
                    })
                });
                
                const data = await response.json();
                currentTransfer = data.transfer_id;
                
                document.getElementById('transferProgress').style.display = 'block';
                document.getElementById('transferStatus').textContent = 'Uploading file...';
                document.getElementById('stopBtn').disabled = false;
                
                log(`Transfer started: ${currentTransfer}`);
                
                // Start progress polling
                startProgressPolling();
                
                // Upload file in chunks
                await uploadFileInChunks(data.upload_url);
                
            } catch (error) {
                log(`Transfer failed: ${error.message}`);
                document.getElementById('transferStatus').textContent = 'Transfer failed!';
                isTransferring = false;
            }
        }
        
        function startProgressPolling() {
            if (progressInterval) {
                clearInterval(progressInterval);
            }
            
            progressInterval = setInterval(async () => {
                if (!currentTransfer || !isTransferring) return;
                
                try {
                    const response = await fetch(`/transfer/status/${currentTransfer}`);
                    const status = await response.json();
                    
                    if (status.receiver_progress !== undefined) {
                        const receiverProgress = (status.receiver_progress / status.total_chunks) * 100;
                        document.getElementById('receiverProgress').style.width = receiverProgress + '%';
                        document.getElementById('receiverPercent').textContent = receiverProgress.toFixed(1) + '%';
                        
                        if (status.receiver_progress >= status.total_chunks) {
                            clearInterval(progressInterval);
                            document.getElementById('transferStatus').textContent = 'Transfer completed successfully!';
                            isTransferring = false;
                        }
                    }
                } catch (error) {
                    log(`Failed to get receiver progress: ${error.message}`);
                }
            }, 1000); // Poll every second
        }
        
        async function uploadFileInChunks(uploadUrl) {
            const chunkSize = 64 * 1024; // 64KB chunks
            const totalChunks = Math.ceil(selectedFile.size / chunkSize);
            
            for (let i = 0; i < totalChunks; i++) {
                if (!isTransferring) {
                    log('Transfer stopped by user');
                    break;
                }
                
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, selectedFile.size);
                const chunk = selectedFile.slice(start, end);
                
                try {
                    const response = await fetch(uploadUrl, {
                        method: 'POST',
                        headers: {
                            'X-Chunk-Index': i.toString(),
                            'X-Total-Chunks': totalChunks.toString(),
                            'X-File-Name': selectedFile.name
                        },
                        body: chunk
                    });
                    
                    const result = await response.json();
                    
                    // Update progress
                    const progress = ((i + 1) / totalChunks) * 100;
                    document.getElementById('senderProgress').style.width = progress + '%';
                    document.getElementById('senderPercent').textContent = progress.toFixed(1) + '%';
                    
                    log(`Chunk ${i + 1}/${totalChunks} uploaded (${progress.toFixed(1)}%)`);
                    
                } catch (error) {
                    log(`Chunk ${i + 1} upload failed: ${error.message}`);
                    throw error;
                }
            }
            
            if (isTransferring) {
                document.getElementById('transferStatus').textContent = 'Upload completed! File ready for download.';
                log('File upload completed successfully!');
            }
        }
        
        function stopTransfer() {
            isTransferring = false;
            if (progressInterval) {
                clearInterval(progressInterval);
                progressInterval = null;
            }
            document.getElementById('transferStatus').textContent = 'Transfer stopped by user';
            document.getElementById('stopBtn').disabled = true;
            log('Transfer stopped by user');
        }
        
        async function clearCache() {
            try {
                // Clear any cached transfer data
                currentTransfer = null;
                selectedFile = null;
                
                // Reset UI
                document.getElementById('transferProgress').style.display = 'none';
                document.getElementById('senderProgress').style.width = '0%';
                document.getElementById('receiverProgress').style.width = '0%';
                document.getElementById('senderPercent').textContent = '0%';
                document.getElementById('receiverPercent').textContent = '0%';
                document.getElementById('transferStatus').textContent = 'Ready to transfer...';
                document.getElementById('stopBtn').disabled = true;
                document.getElementById('startBtn').disabled = false;
                
                // Clear file input
                document.getElementById('fileInput').value = '';
                document.getElementById('fileInfo').style.display = 'none';
                
                if (progressInterval) {
                    clearInterval(progressInterval);
                    progressInterval = null;
                }
                
                isTransferring = false;
                
                log('Cache cleared successfully');
            } catch (error) {
                log(`Failed to clear cache: ${error.message}`);
            }
        }
        
        function clearMessages() {
            document.getElementById('messages').innerHTML = '';
        }
        
        // Auto-register on page load
        window.onload = function() {
            log('Page loaded, registering device...');
            registerDevice();
        };
    </script>
</body>
</html>
    """

if __name__ == "__main__":
    import uvicorn
    print("Starting ShareZidi v3.0 HTTP Streaming Server")
    print("Upload directory:", UPLOAD_DIR)
    print("Test page: http://localhost:8004/test")
    print("Devices: http://localhost:8004/devices")
    print("=" * 50)
    uvicorn.run(app, host="127.0.0.1", port=8004, log_level="info")
