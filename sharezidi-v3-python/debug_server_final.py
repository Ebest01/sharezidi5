#!/usr/bin/env python3
"""
WebRTC File Transfer Server - Final Working Version
Supports both mobile and desktop with proper ICE candidate handling
"""
import json
import logging
import random
import string
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if "text/html" in response.headers.get("content-type", ""):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
        return response

def generate_device_id():
    numbers = ''.join(random.choices('0123456789', k=3))
    letters = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=5))
    return f"{numbers}-{letters}"

app = FastAPI(title="ShareZidi v3.0 - Final Version")
app.add_middleware(NoCacheMiddleware)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.device_ids: Dict[str, str] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        device_id = generate_device_id()
        self.device_ids[client_id] = device_id
        logger.info(f"Client {client_id} connected with device ID {device_id}")
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.device_ids:
            del self.device_ids[client_id]
    
    async def send_to_client(self, client_id: str, message: str):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_text(message)
                return True
            except Exception as e:
                logger.error(f"Failed to send to {client_id}: {e}")
                self.disconnect(client_id)
                return False
        return False
    
    async def broadcast_device_list_update(self):
        all_devices = {cid: self.device_ids.get(cid, "Unknown") 
                      for cid in self.active_connections.keys()}
        
        for client_id in list(self.active_connections.keys()):
            try:
                other_clients = [cid for cid in self.active_connections.keys() 
                               if cid != client_id]
                other_devices = {cid: self.device_ids.get(cid, "Unknown") 
                               for cid in other_clients}
                
                await self.active_connections[client_id].send_text(json.dumps({
                    "type": "devices_updated",
                    "other_clients": other_clients,
                    "other_devices": other_devices
                }))
            except Exception as e:
                logger.error(f"Failed to update {client_id}: {e}")

manager = ConnectionManager()

@app.get("/")
async def root():
    return {"message": "ShareZidi v3.0 - Running", "connections": len(manager.active_connections)}

@app.get("/test", response_class=HTMLResponse)
async def test_page():
    import time
    # Add timestamp to force fresh load every time
    version = f"{int(time.time())}"
    
    html_content = """
<!DOCTYPE html>
<html>
<head>
    <title>ShareZidi v3.0 - Mobile/Desktop File Transfer</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <!-- Version: {version} -->
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .connected { background: #d4edda; color: #155724; }
        .disconnected { background: #f8d7da; color: #721c24; }
        #messages { border: 1px solid #ccc; height: 300px; overflow-y: auto; padding: 10px; }
        button { padding: 10px 15px; margin: 5px; cursor: pointer; }
        .progress-bar { background: #e0e0e0; height: 20px; border-radius: 4px; margin: 5px 0; }
        .progress-fill { background: #4CAF50; height: 100%; border-radius: 4px; transition: width 0.3s; }
        .info-banner { background: #d1ecf1; color: #0c5460; padding: 10px; margin: 10px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>ShareZidi v3.0 - File Transfer</h1>
    <div class="info-banner">
        <strong>Page Version:</strong> {version} | 
        <strong>Loaded at:</strong> <span id="loadTime"></span> |
        <strong>Port:</strong> <script>document.write(window.location.port)</script>
    </div>
    <div id="status" class="status disconnected">Connecting...</div>
    <div id="deviceId" style="display:none; padding: 8px; background: #e8f4fd;">
        Device ID: <span id="deviceIdValue"></span>
    </div>
    
    <div style="margin: 20px 0; padding: 15px; border: 2px dashed #ccc; border-radius: 8px;">
        <h3>File Transfer</h3>
        <input type="file" id="fileInput">
        <button onclick="selectFile()">Select File</button>
        <div id="fileInfo" style="display:none; margin: 10px 0; padding: 10px; background: #f5f5f5;">
            <strong>File:</strong> <span id="fileName"></span><br>
            <strong>Size:</strong> <span id="fileSize"></span>
        </div>
        <select id="receiverSelect" style="padding: 5px; margin: 5px;">
            <option value="">Select Receiver...</option>
        </select>
        <button onclick="startTransfer()" id="transferBtn" disabled>Start Transfer</button>
    </div>
    
    <div id="transferProgress" style="display:none; margin: 20px 0; padding: 15px; border: 1px solid #ddd;">
        <h3>Transfer Progress</h3>
        <div><strong>Status:</strong> <span id="transferStatus">Idle</span></div>
        <div>
            <strong>Progress:</strong>
            <div class="progress-bar">
                <div id="progressFill" class="progress-fill" style="width: 0%;"></div>
            </div>
            <span id="progressPercent">0%</span>
        </div>
    </div>
    
    <div id="messages"></div>
    
    <script>
        // Show when page was loaded to verify fresh loads
        document.getElementById('loadTime').textContent = new Date().toLocaleString();
        
        const clientId = 'client-' + Math.random().toString(36).substr(2, 9);
        let ws = null;
        let selectedFile = null;
        let connectedClients = [];
        let currentTransfer = null;
        let peerConnection = null;
        let dataChannel = null;
        let isChannelReady = false;
        let pendingIceCandidates = [];
        let iceCandidateTimeout = null;
        
        // Enhanced RTC config with multiple TURN servers
        const rtcConfiguration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { 
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ],
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };
        
        function log(message) {
            const timestamp = new Date().toLocaleTimeString();
            const messagesDiv = document.getElementById('messages');
            messagesDiv.innerHTML += '<div>[' + timestamp + '] ' + message + '</div>';
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            console.log('[' + timestamp + '] ' + message);
        }
        
        function connect() {
            // Dynamically get the host and port from current URL
            const host = window.location.hostname;
            const port = window.location.port;
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = wsProtocol + '//' + host + ':' + port + '/ws/' + clientId;
            
            log('Connecting to ' + wsUrl + '...');
            ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                document.getElementById('status').className = 'status connected';
                document.getElementById('status').textContent = 'Connected!';
                log('Connected to server');
            };
            
            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                
                if (message.type === 'device_assigned') {
                    document.getElementById('deviceIdValue').textContent = message.device_id;
                    document.getElementById('deviceId').style.display = 'block';
                } else if (message.type === 'devices_updated') {
                    connectedClients = message.other_clients || [];
                    updateReceiverSelect(message.other_devices || {});
                } else if (message.type === 'webrtc_offer') {
                    handleWebRTCOffer(message);
                } else if (message.type === 'webrtc_answer') {
                    handleWebRTCAnswer(message);
                } else if (message.type === 'webrtc_ice_candidate') {
                    handleWebRTCIceCandidate(message);
                } else if (message.type === 'file_transfer_start') {
                    handleIncomingTransfer(message);
                } else if (message.type === 'file_chunk') {
                    handleFileChunk(message);
                }
            };
            
            ws.onclose = () => {
                document.getElementById('status').className = 'status disconnected';
                document.getElementById('status').textContent = 'Disconnected';
                setTimeout(connect, 2000);
            };
        }
        
        function updateReceiverSelect(devices) {
            const select = document.getElementById('receiverSelect');
            select.innerHTML = '<option value="">Select Receiver...</option>';
            
            connectedClients.forEach(id => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = devices[id] || id;
                select.appendChild(option);
            });
        }
        
        function selectFile() {
            const file = document.getElementById('fileInput').files[0];
            if (file) {
                selectedFile = file;
                document.getElementById('fileName').textContent = file.name;
                document.getElementById('fileSize').textContent = formatFileSize(file.size);
                document.getElementById('fileInfo').style.display = 'block';
                document.getElementById('transferBtn').disabled = false;
                log('Selected: ' + file.name + ' (' + formatFileSize(file.size) + ')');
            }
        }
        
        function formatFileSize(bytes) {
            const sizes = ['B', 'KB', 'MB', 'GB'];
            if (bytes === 0) return '0 B';
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
        }
        
        function startTransfer() {
            const receiverId = document.getElementById('receiverSelect').value;
            if (!receiverId || !selectedFile) {
                alert('Please select file and receiver');
                return;
            }
            
            document.getElementById('transferProgress').style.display = 'block';
            document.getElementById('transferStatus').textContent = 'Initializing...';
            
            // Try WebRTC first
            attemptWebRTCTransfer(receiverId);
        }
        
        function attemptWebRTCTransfer(receiverId) {
            log('Attempting WebRTC connection...');
            pendingIceCandidates = [];
            
            currentTransfer = {
                file: selectedFile,
                receiverId: receiverId,
                method: 'webrtc'
            };
            
            peerConnection = new RTCPeerConnection(rtcConfiguration);
            
            // Create data channel
            dataChannel = peerConnection.createDataChannel('fileTransfer', {
                ordered: true
            });
            // Apply backpressure threshold so 'bufferedAmount' can drain
            try {
                dataChannel.bufferedAmountLowThreshold = 256 * 1024; // 256KB
            } catch (e) { /* some browsers may not support setting this */ }
            
            dataChannel.onopen = () => {
                log('✅ Data channel opened!');
                isChannelReady = true;
                clearTimeout(iceCandidateTimeout);
                sendFileViaWebRTC();
            };
            
            dataChannel.onclose = () => {
                log('Data channel closed');
                isChannelReady = false;
            };
            
            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    ws.send(JSON.stringify({
                        type: 'webrtc_ice_candidate',
                        receiver_id: receiverId,
                        candidate: event.candidate
                    }));
                }
            };
            
            // Set timeout for fallback
            iceCandidateTimeout = setTimeout(() => {
                if (!isChannelReady) {
                    log('WebRTC timeout - falling back to WebSocket');
                    cleanupWebRTC();
                    startWebSocketTransfer(receiverId);
                }
            }, 15000);
            
            // Create offer
            peerConnection.createOffer()
                .then(offer => peerConnection.setLocalDescription(offer))
                .then(() => {
                    setTimeout(() => {
                        ws.send(JSON.stringify({
                            type: 'webrtc_offer',
                            receiver_id: receiverId,
                            offer: peerConnection.localDescription,
                            file_info: {
                                name: selectedFile.name,
                                size: selectedFile.size,
                                type: selectedFile.type
                            }
                        }));
                    }, 1000);
                })
                .catch(error => {
                    log('WebRTC error: ' + error.message);
                    startWebSocketTransfer(receiverId);
                });
        }
        
        function handleWebRTCOffer(message) {
            log('Received WebRTC offer');
            pendingIceCandidates = [];
            
            peerConnection = new RTCPeerConnection(rtcConfiguration);
            
            peerConnection.ondatachannel = (event) => {
                dataChannel = event.channel;
                dataChannel.onopen = () => {
                    log('✅ Data channel received and opened');
                    isChannelReady = true;
                };
                
                dataChannel.onmessage = (event) => {
                    handleWebRTCData(event.data);
                };
            };
            
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    ws.send(JSON.stringify({
                        type: 'webrtc_ice_candidate',
                        sender_id: message.sender_id,
                        candidate: event.candidate
                    }));
                }
            };
            
            peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer))
                .then(() => {
                    processPendingIceCandidates();
                    return peerConnection.createAnswer();
                })
                .then(answer => peerConnection.setLocalDescription(answer))
                .then(() => {
                    ws.send(JSON.stringify({
                        type: 'webrtc_answer',
                        sender_id: message.sender_id,
                        answer: peerConnection.localDescription
                    }));
                })
                .catch(error => log('Error: ' + error.message));
        }
        
        function handleWebRTCAnswer(message) {
            if (peerConnection) {
                peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer))
                    .then(() => {
                        log('Answer processed');
                        processPendingIceCandidates();
                    })
                    .catch(error => log('Error: ' + error.message));
            }
        }
        
        function handleWebRTCIceCandidate(message) {
            if (!peerConnection) return;
            
            if (!peerConnection.remoteDescription) {
                pendingIceCandidates.push(message.candidate);
                return;
            }
            
            peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate))
                .catch(error => log('ICE error: ' + error.message));
        }
        
        function processPendingIceCandidates() {
            if (pendingIceCandidates.length > 0) {
                log('Processing ' + pendingIceCandidates.length + ' pending ICE candidates');
                pendingIceCandidates.forEach(candidate => {
                    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                        .catch(error => log('ICE error: ' + error.message));
                });
                pendingIceCandidates = [];
            }
        }
        
        async function sendFileViaWebRTC() {
            if (!isChannelReady || !currentTransfer) return;
            
            const file = currentTransfer.file;
            const chunkSize = 16384; // 16KB chunks
            const chunks = Math.ceil(file.size / chunkSize);
            
            document.getElementById('transferStatus').textContent = 'Sending via WebRTC...';
            
            // Send metadata
            dataChannel.send(JSON.stringify({
                type: 'start',
                name: file.name,
                size: file.size,
                chunks: chunks
            }));
            
            // Send chunks with backpressure
            const MAX_BUFFER = 1024 * 1024; // 1MB
            for (let i = 0; i < chunks; i++) {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                const chunk = file.slice(start, end);
                const arrayBuffer = await chunk.arrayBuffer();
                
                // Backpressure: wait while buffer is high
                while (dataChannel.bufferedAmount > MAX_BUFFER) {
                    await new Promise(r => setTimeout(r, 10));
                }
                
                dataChannel.send(arrayBuffer);
                
                const progress = ((i + 1) / chunks) * 100;
                updateProgress(progress);
                // Small pacing to keep buffer healthy on mobile radios
                if (dataChannel.bufferedAmount > MAX_BUFFER / 2) {
                    await new Promise(r => setTimeout(r, 5));
                }
            }
            
            dataChannel.send(JSON.stringify({ type: 'complete' }));
            showSuccess('Sent');
        }
        
        function startWebSocketTransfer(receiverId) {
            log('Using WebSocket transfer...');
            document.getElementById('transferStatus').textContent = 'Sending via server...';
            
            currentTransfer = {
                file: selectedFile,
                receiverId: receiverId,
                method: 'websocket'
            };
            
            ws.send(JSON.stringify({
                type: 'file_transfer_start',
                receiver_id: receiverId,
                file_info: {
                    name: selectedFile.name,
                    size: selectedFile.size,
                    type: selectedFile.type
                }
            }));
            
            sendFileChunksViaWebSocket();
        }
        
        async function sendFileChunksViaWebSocket() {
            const file = currentTransfer.file;
            const chunkSize = 32768; // 32KB
            const chunks = Math.ceil(file.size / chunkSize);
            
            for (let i = 0; i < chunks; i++) {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                const chunk = file.slice(start, end);
                
                const reader = new FileReader();
                const base64 = await new Promise((resolve) => {
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.readAsDataURL(chunk);
                });
                
                ws.send(JSON.stringify({
                    type: 'file_chunk',
                    receiver_id: currentTransfer.receiverId,
                    chunk_data: base64,
                    chunk_index: i,
                    total_chunks: chunks
                }));
                
                const progress = ((i + 1) / chunks) * 100;
                updateProgress(progress);
                
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            showSuccess('Sent');
        }
        
        let receivedChunks = [];
        let fileMetadata = null;
        
        function handleWebRTCData(data) {
            if (typeof data === 'string') {
                const message = JSON.parse(data);
                if (message.type === 'start') {
                    fileMetadata = message;
                    receivedChunks = [];
                    document.getElementById('transferProgress').style.display = 'block';
                    document.getElementById('transferStatus').textContent = 'Receiving ' + message.name + '...';
                } else if (message.type === 'complete') {
                    reconstructFile();
                }
            } else {
                receivedChunks.push(data);
                const progress = (receivedChunks.length / fileMetadata.chunks) * 100;
                updateProgress(progress);
            }
        }
        
        function handleIncomingTransfer(message) {
            fileMetadata = message.file_info;
            receivedChunks = [];
            document.getElementById('transferProgress').style.display = 'block';
            document.getElementById('transferStatus').textContent = 'Receiving ' + fileMetadata.name + '...';
        }
        
        function handleFileChunk(message) {
            receivedChunks[message.chunk_index] = message.chunk_data;
            const progress = ((message.chunk_index + 1) / message.total_chunks) * 100;
            updateProgress(progress);
            
            if (receivedChunks.filter(c => c).length === message.total_chunks) {
                reconstructWebSocketFile();
            }
        }
        
        function reconstructFile() {
            const blob = new Blob(receivedChunks, { type: fileMetadata.type || 'application/octet-stream' });
            downloadFile(blob, fileMetadata.name);
        }
        
        function reconstructWebSocketFile() {
            const fullBase64 = receivedChunks.join('');
            const byteCharacters = atob(fullBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: fileMetadata.type || 'application/octet-stream' });
            downloadFile(blob, fileMetadata.name);
        }
        
        function downloadFile(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showSuccess('Received');
        }
        
        function updateProgress(progress) {
            document.getElementById('progressFill').style.width = progress + '%';
            document.getElementById('progressPercent').textContent = progress.toFixed(1) + '%';
        }
        
        function showSuccess(action) {
            document.getElementById('transferStatus').textContent = '✅ ' + action + ' Successfully!';
            document.getElementById('transferStatus').style.color = '#155724';
            log('✅ FILE ' + action.toUpperCase() + ' SUCCESSFULLY!');
        }
        
        function cleanupWebRTC() {
            if (dataChannel) {
                dataChannel.close();
                dataChannel = null;
            }
            if (peerConnection) {
                peerConnection.close();
                peerConnection = null;
            }
            isChannelReady = false;
            pendingIceCandidates = [];
        }
        
        // Connect on load
        window.onload = () => connect();
    </script>
</body>
</html>
    """.replace('{version}', version)
    
    response = HTMLResponse(content=html_content)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    return response

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    
    # Send device ID
    await websocket.send_text(json.dumps({
        "type": "device_assigned",
        "device_id": manager.device_ids.get(client_id)
    }))
    
    await manager.broadcast_device_list_update()
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            message_type = message.get("type")
            
            if message_type == "webrtc_offer":
                receiver_id = message.get("receiver_id")
                if receiver_id in manager.active_connections:
                    await manager.send_to_client(receiver_id, json.dumps({
                        "type": "webrtc_offer",
                        "sender_id": client_id,
                        "offer": message.get("offer"),
                        "file_info": message.get("file_info")
                    }))
                    
            elif message_type == "webrtc_answer":
                sender_id = message.get("sender_id")
                if sender_id in manager.active_connections:
                    await manager.send_to_client(sender_id, json.dumps({
                        "type": "webrtc_answer",
                        "receiver_id": client_id,
                        "answer": message.get("answer")
                    }))
                    
            elif message_type == "webrtc_ice_candidate":
                target_id = message.get("receiver_id") or message.get("sender_id")
                if target_id in manager.active_connections:
                    await manager.send_to_client(target_id, json.dumps({
                        "type": "webrtc_ice_candidate",
                        "sender_id": client_id if message.get("receiver_id") else None,
                        "receiver_id": client_id if message.get("sender_id") else None,
                        "candidate": message.get("candidate")
                    }))
                    
            elif message_type == "file_transfer_start":
                receiver_id = message.get("receiver_id")
                if receiver_id in manager.active_connections:
                    await manager.send_to_client(receiver_id, json.dumps({
                        "type": "file_transfer_start",
                        "sender_id": client_id,
                        "file_info": message.get("file_info")
                    }))
                    
            elif message_type == "file_chunk":
                receiver_id = message.get("receiver_id")
                if receiver_id in manager.active_connections:
                    await manager.send_to_client(receiver_id, json.dumps({
                        "type": "file_chunk",
                        "sender_id": client_id,
                        "chunk_data": message.get("chunk_data"),
                        "chunk_index": message.get("chunk_index"),
                        "total_chunks": message.get("total_chunks")
                    }))
                    
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        await manager.broadcast_device_list_update()

if __name__ == "__main__":
    import uvicorn
    import sys
    
    # Allow port to be specified as command line argument
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8003
    
    print("=" * 70)
    print("ShareZidi v3.0 - FINAL VERSION")
    print("=" * 70)
    print(f"Server: http://localhost:{port}")
    print(f"Test Page: http://localhost:{port}/test")
    print("")
    print(f"From Phone: http://[YOUR-COMPUTER-IP]:{port}/test")
    print(f"Example: http://192.168.100.114:{port}/test")
    print("=" * 70)
    print("Features:")
    print("- WebRTC with automatic fallback to WebSocket")
    print("- Proper ICE candidate queuing for mobile support")
    print("- Works on iPhone, Android, and Desktop")
    print("=" * 70)
    print(f"TIP: To use a different port, run: python3 {sys.argv[0]} [PORT]")
    print(f"Example: python3 {sys.argv[0]} 8007")
    print("=" * 70)
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
