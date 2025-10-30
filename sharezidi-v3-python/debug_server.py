#!/usr/bin/env python3
"""
Debug server to test WebSocket broadcasting
"""
import json
import logging
import random
import string
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse, Response, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Middleware to disable caching for all responses
class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Only add no-cache headers to HTML responses (not WebSocket upgrades)
        if "text/html" in response.headers.get("content-type", ""):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0, private"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "Thu, 01 Jan 1970 00:00:00 GMT"
        return response

def generate_device_id():
    """Generate a device ID in format: [0-9{3}]-[A-Z{5}]"""
    numbers = ''.join(random.choices('0123456789', k=3))
    letters = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=5))
    return f"{numbers}-{letters}"

app = FastAPI(
    title="ShareZidi v3.0 - Debug Server",
    description="Debug server for testing WebSocket broadcasting",
    version="3.0.0",
)

# Add no-cache middleware
app.add_middleware(NoCacheMiddleware)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.client_info: Dict[str, Dict] = {}
        self.device_ids: Dict[str, str] = {}  # Maps client_id to device_id
    
    async def connect(self, websocket: WebSocket, client_id: str, client_info: Dict = None):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.client_info[client_id] = client_info or {}
        
        # Generate and assign device ID
        device_id = generate_device_id()
        self.device_ids[client_id] = device_id
        
        logger.info(f"Client {client_id} connected with device ID {device_id}. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.client_info:
            del self.client_info[client_id]
        if client_id in self.device_ids:
            device_id = self.device_ids[client_id]
            del self.device_ids[client_id]
            logger.info(f"Client {client_id} (device {device_id}) disconnected. Total connections: {len(self.active_connections)}")
        else:
            logger.info(f"Client {client_id} disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_to_client(self, client_id: str, message: str):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_text(message)
                return True
            except Exception as e:
                logger.error(f"Failed to send message to {client_id}: {e}")
                # Remove disconnected client
                if client_id in self.active_connections:
                    del self.active_connections[client_id]
                if client_id in self.device_ids:
                    del self.device_ids[client_id]
                return False
        return False
    
    async def broadcast_to_others(self, sender_id: str, message: Dict):
        """Broadcast message to all clients except sender"""
        message_str = json.dumps(message)
        other_clients = [cid for cid in self.active_connections.keys() if cid != sender_id]
        logger.info(f"Broadcasting from {sender_id} to {len(other_clients)} other clients: {message}")
        
        for client_id in other_clients:
            try:
                await self.active_connections[client_id].send_text(message_str)
                logger.info(f"Successfully sent message to {client_id}")
            except Exception as e:
                logger.error(f"Failed to broadcast to {client_id}: {e}")

    async def broadcast_device_list_update(self):
        """Broadcast updated device list to all connected clients"""
        all_devices = {cid: self.device_ids.get(cid, "Unknown") for cid in self.active_connections.keys()}
        
        for client_id in list(self.active_connections.keys()):
            try:
                # For each client, send list excluding itself
                other_clients = [cid for cid in self.active_connections.keys() if cid != client_id]
                other_devices = {cid: self.device_ids.get(cid, "Unknown") for cid in other_clients}
                
                await self.active_connections[client_id].send_text(json.dumps({
                    "type": "devices_updated",
                    "total_connections": len(self.active_connections),
                    "clients": list(self.active_connections.keys()),
                    "devices": all_devices,
                    "other_clients": other_clients,
                    "other_devices": other_devices
                }))
                logger.info(f"Sent device list update to {client_id}")
            except Exception as e:
                logger.error(f"Failed to send device list update to {client_id}: {e}")

manager = ConnectionManager()

@app.get("/")
async def root():
    return {
        "message": "ShareZidi v3.0 - Debug Server",
        "status": "running",
        "connections": len(manager.active_connections)
    }

@app.get("/stats")
async def get_stats():
    return {
        "connections": {
            "total": len(manager.active_connections),
            "clients": list(manager.active_connections.keys()),
            "devices": {client_id: manager.device_ids.get(client_id, "Unknown") for client_id in manager.active_connections.keys()}
        }
    }

@app.get("/test", response_class=HTMLResponse)
async def test_page(request: Request):
    """Test page for WebSocket broadcasting - /test endpoint"""
    # Redirect to add cache-busting query parameter if not present
    query_params = dict(request.query_params)
    if 'v' not in query_params:
        import time
        version = f"{int(time.time())}-{random.randint(1000, 9999)}"
        return RedirectResponse(url=f"/test?v={version}", status_code=307)
    return await test2_page()

@app.get("/test55", response_class=HTMLResponse)
async def test55_page():
    """NEW endpoint - Test page with full cache-busting - Use this to bypass all browser cache"""
    # Just call test2_page directly - it's the same implementation
    return await test2_page()

@app.get("/test2", response_class=HTMLResponse)
async def test2_page():
    """Test page for WebSocket broadcasting"""
    try:
        from fastapi.responses import Response
        import time
        import random
        # Add version parameter to HTML to force cache refresh - use timestamp + random for uniqueness
        version = f"{int(time.time())}-{random.randint(1000, 9999)}"
        build_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        # Use format() instead of % to avoid issues with JavaScript template literals
        html_content = ("""
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <meta http-equiv="X-Build-Version" content="{1}">
    <title>ShareZidi v3.0 - Debug Test [Build: {1}] - FRESH PAGE</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .connected { background-color: #d4edda; color: #155724; }
        .disconnected { background-color: #f8d7da; color: #721c24; }
        #messages { border: 1px solid #ccc; height: 300px; width: 1200px; overflow-y: scroll; padding: 10px; }
        button { padding: 10px 15px; margin: 5px; cursor: pointer; }
        input { padding: 5px; margin: 5px; }
    </style>
</head>
<body>
    <h1>ShareZidi v3.0 - Debug Test</h1>
    <div id="status" class="disconnected">Connecting...</div>
    <div id="deviceId" style="margin: 10px 0; padding: 8px; background: #e8f4fd; border-radius: 4px; font-weight: bold; display: none;">
        ID: <span id="deviceIdValue">Loading...</span>
    </div>
    
    <div>
        <button onclick="sendPing()">Send Ping</button>
        <button onclick="broadcastMessage()">Broadcast to All</button>
        <button onclick="getStats()">Get Stats</button>
        <button onclick="clearMessages()">Clear Messages</button>
    </div>
    
    <div style="margin: 10px 0;">
        <input type="text" id="messageInput" placeholder="Enter message to broadcast" style="width: 300px;">
        <button onclick="sendCustomMessage()">Send Custom Message</button>
    </div>
    
    <div style="margin: 20px 0; padding: 15px; border: 2px dashed #ccc; border-radius: 8px;">
        <h3>File Transfer Test</h3>
        <div style="margin: 10px 0;">
            <input type="file" id="fileInput" style="margin: 5px;">
            <button onclick="selectFile()">Select File</button>
        </div>
        <div id="fileInfo" style="margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 4px; display: none;">
            <strong>Selected File:</strong> <span id="fileName"></span><br>
            <strong>Size:</strong> <span id="fileSize"></span><br>
            <strong>Type:</strong> <span id="fileType"></span>
        </div>
        <div style="margin: 10px 0;">
            <select id="receiverSelect" style="padding: 5px; margin: 5px;">
                <option value="">Select Receiver...</option>
            </select>
            <button onclick="startTransfer()" id="transferBtn" disabled>Start Transfer</button>
        </div>
    </div>
    
    <div id="transferProgress" style="margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; display: none;">
        <h3>Transfer Progress</h3>
        <div style="margin: 10px 0;">
            <strong>Sender Progress:</strong>
            <div style="background: #e0e0e0; border-radius: 4px; height: 20px; margin: 5px 0;">
                <div id="senderProgress" style="background: #4CAF50; height: 100%; border-radius: 4px; width: 0%; transition: width 0.3s;"></div>
            </div>
            <span id="senderPercent">0%</span>
        </div>
        <div style="margin: 10px 0;">
            <strong>Receiver Progress:</strong>
            <div style="background: #e0e0e0; border-radius: 4px; height: 20px; margin: 5px 0;">
                <div id="receiverProgress" style="background: #2196F3; height: 100%; border-radius: 4px; width: 0%; transition: width 0.3s;"></div>
            </div>
            <span id="receiverPercent">0%</span>
        </div>
        <div id="transferStatus" style="margin: 10px 0; font-weight: bold;"></div>
        <div id="transferMethod" style="margin: 10px 0; font-size: 0.9em; color: #666; display: none;">
            <strong>Transfer Method:</strong> <span id="transferMethodValue">-</span>
        </div>
    </div>
    
    <div id="messages">
        <!-- IMMEDIATE VISIBLE MESSAGE ON PAGE LOAD -->
        <div style="background: #ff6b6b; color: white; padding: 20px; margin: 10px 0; border-radius: 8px; font-size: 1.2em; font-weight: bold; text-align: center; border: 3px solid #c92a2a;">
            <div style="font-size: 2em; margin-bottom: 10px;">⚠️ OLD CACHED VERSION DETECTED ⚠️</div>
            <div>If you see this RED box, your browser is showing OLD cached content!</div>
            <div style="margin-top: 10px; font-size: 0.9em;">Press Ctrl+Shift+R (or Cmd+Shift+R on Mac) to hard refresh</div>
        </div>
        <!-- ========== NEW VERSION LOADED - Build {1} ========== -->
        <div style="background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); padding: 30px; margin: 20px 0; border: 5px solid #28a745; border-radius: 12px; box-shadow: 0 6px 12px rgba(0,0,0,0.3); text-align: center; position: relative; z-index: 1000;">
            <div style="font-size: 3em; margin-bottom: 15px; animation: pulse 2s infinite;">🚀</div>
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0; border: 2px solid #28a745;">
                <h1 style="color: #155724; font-size: 2.5em; margin: 10px 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">✅ NEW VERSION LOADED! Build {1}</h1>
                <h2 style="color: #155724; font-size: 1.8em; margin: 10px 0;">🔄 Testing WebRTC - Page Refreshed Successfully!</h2>
            </div>
            <hr style="border: 2px solid #28a745; margin: 20px 0;">
            <div style="font-size: 1.3em; line-height: 1.8;">
                <strong>WebRTC support:</strong> <span id="webrtcStatus" style="color: #666; font-weight: bold;">Checking...</span><br>
                <strong>Version:</strong> v3.0 with WebRTC Data Channels for Large Files (500MB-2GB)<br>
                <strong>Build ID:</strong> <span style="font-weight: bold; color: #dc3545; font-size: 1.2em;">{1}</span><br>
                <strong>Build Date:</strong> <span id="buildDate" style="font-weight: bold;">{2}</span><br>
            </div>
            <hr style="border: 2px solid #28a745; margin: 20px 0;">
            <p style="font-size: 1.1em; color: #155724; font-weight: bold;">✨ If you see this HUGE green box, the new code is loaded! ✨</p>
        </div>
        <style>
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
        </style>
    </div>
    
    <script>
        const clientId = 'debug-client-' + Math.random().toString(36).substr(2, 9);
        let ws = null;
        let selectedFile = null;
        let connectedClients = [];
        let currentTransfer = null;
        let myDeviceId = null;
        
        // WebRTC variables
        let peerConnection = null;
        let dataChannel = null;
        let webrtcTransferMode = false;
        let pendingOffer = null;
        
        // WebRTC configuration - using multiple STUN servers and public TURN servers for better connectivity
        const rtcConfiguration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                // Public TURN servers (free tier - may have rate limits)
                { 
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ],
            iceCandidatePoolSize: 10
        };
        
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
                // Start heartbeat to keep connection alive
                startHeartbeat();
                // Device list will be automatically updated via devices_updated message
            };
            
            ws.onmessage = function(event) {
                const message = JSON.parse(event.data);
                log(`Received: ${JSON.stringify(message)}`);
                
                // Handle different message types
                if (message.type === 'stats') {
                    connectedClients = message.clients.filter(id => id !== clientId);
                    updateReceiverSelect(message.devices);
                } else if (message.type === 'devices_updated') {
                    // Automatically update device list when devices connect/disconnect
                    connectedClients = message.other_clients || message.clients.filter(id => id !== clientId);
                    updateReceiverSelect(message.other_devices || message.devices);
                    if (message.other_clients && message.other_clients.length > 0) {
                        log(`Device list updated: ${message.other_clients.length} other device(s) available`);
                    } else {
                        log('No other devices connected');
                    }
                } else if (message.type === 'device_assigned') {
                    myDeviceId = message.device_id;
                    document.getElementById('deviceIdValue').textContent = myDeviceId;
                    document.getElementById('deviceId').style.display = 'block';
                    log(`Assigned device ID: ${myDeviceId}`);
                    // Device list will be automatically updated via devices_updated message
                } else if (message.type === 'incoming_transfer') {
                    handleIncomingTransfer(message);
                } else if (message.type === 'file_chunk') {
                    handleFileChunk(message);
                } else if (message.type === 'transfer_progress') {
                    updateSenderProgress(message);
                } else if (message.type === 'chunk_ack') {
                    // Update receiver progress when sender receives acknowledgment
                    if (currentTransfer && currentTransfer.file && !currentTransfer.fileInfo) {
                        // We are the sender - track acknowledged chunks
                        if (currentTransfer.acknowledgedChunks !== undefined) {
                            currentTransfer.acknowledgedChunks++;
                            const progress = (currentTransfer.acknowledgedChunks / currentTransfer.totalChunks) * 100;
                            updateReceiverProgress({progress: progress});
                        }
                    }
                } else if (message.type === 'transfer_complete') {
                    handleTransferComplete(message);
                } else if (message.type === 'webrtc_offer') {
                    handleWebRTCOffer(message);
                } else if (message.type === 'webrtc_answer') {
                    handleWebRTCAnswer(message);
                } else if (message.type === 'webrtc_ice_candidate') {
                    handleWebRTCIceCandidate(message);
                } else if (message.type === 'webrtc_connection_status') {
                    handleWebRTCConnectionStatus(message);
                }
            };
            
            ws.onclose = function(event) {
                document.getElementById('status').textContent = 'Disconnected';
                document.getElementById('status').className = 'status disconnected';
                
                if (event.code === 1011) {
                    log(`WebSocket closed due to timeout (Code=${event.code}). Attempting to reconnect...`);
                } else {
                    log(`WebSocket closed: Code=${event.code}, Reason=${event.reason || 'Unknown'}`);
                }
                
                // Stop heartbeat when disconnected
                stopHeartbeat();
                
                // Attempt to reconnect after a short delay (unless it was a normal closure)
                if (event.code !== 1000 && event.code !== 1001) {
                    setTimeout(() => {
                        log('Attempting to reconnect...');
                        connect();
                    }, 2000); // Wait 2 seconds before reconnecting
                }
            };
            
            ws.onerror = function(error) {
                log(`WebSocket error: ${error}`);
            };
        }
        
        function sendPing() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
                log('Sent ping');
            } else {
                log('WebSocket not connected');
            }
        }
        
        function broadcastMessage() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ 
                    type: 'broadcast', 
                    content: 'Hello from ' + clientId + '!'
                }));
                log('Broadcasted message to all clients');
            } else {
                log('WebSocket not connected');
            }
        }
        
        function sendCustomMessage() {
            const messageInput = document.getElementById('messageInput');
            const message = messageInput.value;
            if (message && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ 
                    type: 'broadcast', 
                    content: message
                }));
                log('Sent custom message: ' + message);
                messageInput.value = '';
            } else if (!message) {
                log('Please enter a message');
            } else {
                log('WebSocket not connected');
            }
        }
        
        function getStats() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'get_stats' }));
                log('Requested stats');
            } else {
                log('WebSocket not connected');
            }
        }
        
        function clearMessages() {
            document.getElementById('messages').innerHTML = '';
        }
        
        // File transfer functions
        function selectFile() {
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            if (file) {
                selectedFile = file;
                document.getElementById('fileName').textContent = file.name;
                document.getElementById('fileSize').textContent = formatFileSize(file.size);
                document.getElementById('fileType').textContent = file.type || 'Unknown';
                document.getElementById('fileInfo').style.display = 'block';
                document.getElementById('transferBtn').disabled = false;
                log(`File selected: ${file.name} (${formatFileSize(file.size)})`);
            }
        }
        
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        function updateReceiverSelect(devices = {}) {
            const select = document.getElementById('receiverSelect');
            select.innerHTML = '<option value="">Select Receiver...</option>';
            
            // Filter out our own client ID - the server should already do this, but double-check
            const otherClients = connectedClients.filter(id => id !== clientId);
            
            if (otherClients.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No other devices connected';
                option.disabled = true;
                select.appendChild(option);
            } else {
                otherClients.forEach(clientIdToAdd => {
                    const deviceId = devices[clientIdToAdd] || clientIdToAdd;
                    const option = document.createElement('option');
                    option.value = clientIdToAdd;
                    option.textContent = `${deviceId} (${clientIdToAdd})`;
                select.appendChild(option);
            });
            }
        }
        
        function startTransfer() {
            const receiverId = document.getElementById('receiverSelect').value;
            if (!receiverId) {
                alert('Please select a receiver');
                return;
            }
            if (!selectedFile) {
                alert('Please select a file');
                return;
            }
            
            // Show progress panel
            document.getElementById('transferProgress').style.display = 'block';
            document.getElementById('transferStatus').textContent = 'Starting transfer...';
            
            // FORCE WebRTC for files > 10MB (reduced threshold for testing)
            // WebSocket is unreliable for large files due to timeouts
            const fileSize = selectedFile.size || 0;
            const useWebRTC = fileSize > 10 * 1024 * 1024; // 10MB threshold - force WebRTC for anything larger
            
            // Check WebRTC support
            if (!window.RTCPeerConnection) {
                log('ERROR: WebRTC not supported in this browser. Please use Chrome, Firefox, or Edge.');
                alert('WebRTC is required for large file transfers. Please use a modern browser (Chrome, Firefox, or Edge).');
                return;
            }
            
            if (useWebRTC) {
                console.log(`[WebRTC] Large file detected: ${formatFileSize(fileSize)}`);
                console.log(`[WebRTC] RTCPeerConnection available: ${!!window.RTCPeerConnection}`);
                log(`Large file detected (${formatFileSize(fileSize)}). FORCING WebRTC transfer (required for reliable large transfers)...`);
                document.getElementById('transferMethod').style.display = 'block';
                document.getElementById('transferMethodValue').textContent = 'WebRTC (P2P) - REQUIRED for large files';
                startWebRTCTransfer(receiverId);
            } else {
                log(`Small file (${formatFileSize(fileSize)}). Using WebSocket transfer...`);
                document.getElementById('transferMethod').style.display = 'block';
                document.getElementById('transferMethodValue').textContent = 'WebSocket (Server Relay)';
                startWebSocketTransfer(receiverId);
            }
        }
        
        function startWebSocketTransfer(receiverId) {
            webrtcTransferMode = false;
            const fileSize = selectedFile.size || 0;
            const chunkSize = 64 * 1024; // 64KB chunks
            const totalChunks = fileSize > 0 ? Math.ceil(fileSize / chunkSize) : 1;
            
            currentTransfer = {
                file: selectedFile,
                receiverId: receiverId,
                chunkSize: chunkSize,
                totalChunks: totalChunks,
                sentChunks: 0,
                receivedChunks: 0,
                acknowledgedChunks: 0,
                transferMethod: 'websocket'
            };
            
            // Send transfer start message
            ws.send(JSON.stringify({
                type: 'file_transfer_start',
                file_info: {
                    name: selectedFile.name,
                    size: selectedFile.size,
                    type: selectedFile.type
                },
                receiver_id: receiverId
            }));
            
            log(`Starting WebSocket transfer: ${selectedFile.name} to ${receiverId}`);
            
            // Start sending chunks
            sendFileChunks();
        }
        
        function startWebRTCTransfer(receiverId) {
            webrtcTransferMode = true;
            document.getElementById('transferStatus').textContent = 'Establishing WebRTC connection...';
            
            // Initialize file transfer info
            const fileSize = selectedFile.size || 0;
            const chunkSize = 16 * 1024; // 16KB chunks for WebRTC (smaller to avoid buffer overflow)
            const totalChunks = fileSize > 0 ? Math.ceil(fileSize / chunkSize) : 1;
            
            currentTransfer = {
                file: selectedFile,
                receiverId: receiverId,
                chunkSize: chunkSize,
                totalChunks: totalChunks,
                sentChunks: 0,
                receivedChunks: 0,
                acknowledgedChunks: 0,
                transferMethod: 'webrtc'
            };
            
            // Create peer connection as sender
            peerConnection = new RTCPeerConnection(rtcConfiguration);
            
            // Create data channel with better configuration for large files
            dataChannel = peerConnection.createDataChannel('fileTransfer', {
                ordered: true, // Ensure chunks arrive in order
                maxRetransmits: 0, // Disable retransmits for better performance
                maxRetransmitTime: 0, // No retransmit timeout
                protocol: 'file-transfer' // Custom protocol identifier
            });
            
            setupDataChannelHandlers(dataChannel, true); // true = isSender
            
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
            
            // Handle connection state changes
            peerConnection.onconnectionstatechange = () => {
                const state = peerConnection.connectionState;
                log(`WebRTC connection state: ${state}`);
                
                if (state === 'connected') {
                    document.getElementById('transferStatus').textContent = 'WebRTC connected! Waiting for data channel...';
                    log('WebRTC P2P connection established successfully!');
                    // Don't call sendFileViaWebRTC() here - let the data channel onopen handler do it
                } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                    log(`ERROR: WebRTC connection ${state}. Attempting to reconnect...`);
                    document.getElementById('transferStatus').textContent = `WebRTC ${state}, retrying...`;
                    
                    // Try to reconnect once
                    setTimeout(() => {
                        if (peerConnection && peerConnection.connectionState !== 'connected') {
                            log('WebRTC reconnection failed. This may require manual NAT traversal or TURN servers.');
                            cleanupWebRTC();
                            // Don't fallback to WebSocket for large files - it will timeout
                            document.getElementById('transferStatus').textContent = 'WebRTC connection failed. Please check firewall/NAT settings.';
                        }
                    }, 3000);
                } else if (state === 'connecting') {
                    document.getElementById('transferStatus').textContent = 'Connecting via WebRTC (this may take 10-30 seconds)...';
                }
            };
            
            // Handle ICE connection state
            peerConnection.oniceconnectionstatechange = () => {
                const iceState = peerConnection.iceConnectionState;
                log(`ICE connection state: ${iceState}`);
                
                if (iceState === 'failed') {
                    log('ICE connection failed - attempting ICE restart...');
                    // Try to restart ICE
                    peerConnection.restartIce();
                }
            };
            
            // Monitor ICE gathering
            peerConnection.onicegatheringstatechange = () => {
                const gatheringState = peerConnection.iceGatheringState;
                log(`ICE gathering state: ${gatheringState}`);
                
                if (gatheringState === 'complete' && !pendingOffer) {
                    pendingOffer = true;
                    log('ICE gathering complete!');
                }
            };
            
            // Create and send offer with trickle ICE
            peerConnection.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
            })
                .then(offer => {
                    log('WebRTC offer created');
                    return peerConnection.setLocalDescription(offer);
                })
                .then(() => {
                    log('Local description set, waiting for ICE candidates...');
                    
                    // Wait for initial ICE candidates (at least 2 seconds)
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
                        log('WebRTC offer sent to server for signaling');
                    }, 2000);
                })
                .catch(error => {
                    log(`ERROR creating WebRTC offer: ${error.message}`);
                    log(`Error stack: ${error.stack}`);
                    cleanupWebRTC();
                    alert(`WebRTC setup failed: ${error.message}. Large file transfers require WebRTC to work.`);
                });
        }
        
        function handleIncomingTransfer(message) {
            const fileInfo = message.file_info;
            const senderId = message.sender_id;
            
            log(`Incoming transfer from ${senderId}: ${fileInfo.name}`);
            
            // Show progress panel
            document.getElementById('transferProgress').style.display = 'block';
            document.getElementById('transferStatus').textContent = `Receiving ${fileInfo.name} from ${senderId}...`;
            
            // Validate file size to avoid division by zero
            const fileSize = fileInfo.size || 0;
            const chunkSize = 64 * 1024; // 64KB chunks for WebSocket
            const totalChunks = fileSize > 0 ? Math.ceil(fileSize / chunkSize) : 1;
            
            // Initialize receiver state (WebSocket mode)
            currentTransfer = {
                fileInfo: fileInfo,
                senderId: senderId,
                receivedChunks: 0,
                totalChunks: totalChunks,
                chunks: new Array(totalChunks),
                transferMethod: 'websocket'
            };
        }
        
        // WebRTC Signal Handlers
        function handleWebRTCOffer(message) {
            const senderId = message.sender_id;
            const offer = message.offer;
            const fileInfo = message.file_info;
            
            log(`Received WebRTC offer from ${senderId} for file: ${fileInfo.name}`);
            
            // Show progress panel
            document.getElementById('transferProgress').style.display = 'block';
            document.getElementById('transferStatus').textContent = `Establishing WebRTC connection for ${fileInfo.name}...`;
            
            // Initialize receiver state
            const fileSize = fileInfo.size || 0;
            const chunkSize = 16 * 1024; // 16KB chunks for WebRTC (smaller to avoid buffer overflow)
            const totalChunks = fileSize > 0 ? Math.ceil(fileSize / chunkSize) : 1;
            
            currentTransfer = {
                fileInfo: fileInfo,
                senderId: senderId,
                receivedChunks: 0,
                totalChunks: totalChunks,
                chunks: new Array(totalChunks),
                transferMethod: 'webrtc'
            };
            
            // Create peer connection as receiver
            peerConnection = new RTCPeerConnection(rtcConfiguration);
            
            // Handle incoming data channel
            peerConnection.ondatachannel = (event) => {
                dataChannel = event.channel;
                setupDataChannelHandlers(dataChannel, false); // false = isReceiver
                log('WebRTC data channel opened');
            };
            
            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    ws.send(JSON.stringify({
                        type: 'webrtc_ice_candidate',
                        sender_id: senderId,
                        candidate: event.candidate
                    }));
                }
            };
            
            // Handle connection state
            peerConnection.onconnectionstatechange = () => {
                const state = peerConnection.connectionState;
                log(`WebRTC connection state: ${state}`);
                
                if (state === 'connected') {
                    document.getElementById('transferStatus').textContent = `Receiving ${fileInfo.name} via WebRTC...`;
                } else if (state === 'failed' || state === 'disconnected') {
                    log('WebRTC connection failed');
                    cleanupWebRTC();
                }
            };
            
            // Set remote description and create answer
            log('Processing WebRTC offer from sender...');
            peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
                .then(() => {
                    log('Remote description set, creating answer...');
                    return peerConnection.createAnswer();
                })
                .then(answer => {
                    log('Answer created, setting local description...');
                    return peerConnection.setLocalDescription(answer);
                })
                .then(() => {
                    // Wait a moment for ICE candidates
                    setTimeout(() => {
                        ws.send(JSON.stringify({
                            type: 'webrtc_answer',
                            sender_id: senderId,
                            answer: peerConnection.localDescription
                        }));
                        log('WebRTC answer sent to sender via WebSocket signaling');
                    }, 1000);
                })
                .catch(error => {
                    log(`ERROR handling WebRTC offer: ${error.message}`);
                    log(`Error details: ${error.stack || 'No stack trace'}`);
                    cleanupWebRTC();
                    alert('WebRTC connection failed. The file transfer cannot proceed.');
                });
        }
        
        function handleWebRTCAnswer(message) {
            const receiverId = message.receiver_id;
            const answer = message.answer;
            
            if (!peerConnection) {
                log('Received WebRTC answer but no peer connection exists');
                return;
            }
            
            peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
                .then(() => {
                    log('WebRTC answer processed');
                })
                .catch(error => {
                    log(`Error setting remote description: ${error.message}`);
                });
        }
        
        function handleWebRTCIceCandidate(message) {
            const candidate = message.candidate;
            const senderId = message.sender_id;
            
            if (!peerConnection) {
                log('Received ICE candidate but no peer connection exists');
                return;
            }
            
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                .catch(error => {
                    log(`Error adding ICE candidate: ${error.message}`);
                });
        }
        
        function handleWebRTCConnectionStatus(message) {
            const status = message.status;
            log(`WebRTC connection status from ${message.sender_id}: ${status}`);
        }
        
        function setupDataChannelHandlers(channel, isSender) {
            channel.onopen = () => {
                log('Data channel opened successfully');
                if (isSender && currentTransfer && currentTransfer.file) {
                    log('Starting file transfer via WebRTC data channel...');
                    sendFileViaWebRTC();
                }
            };
            
            channel.onclose = () => {
                log('Data channel closed');
                if (currentTransfer && currentTransfer.transferMethod === 'webrtc') {
                    log('WebRTC transfer interrupted - data channel closed');
                    // Don't attempt to send more chunks
                    currentTransfer.dataChannelClosed = true;
                }
            };
            
            channel.onerror = (error) => {
                log(`Data channel error: ${error.message || 'Unknown error'}`);
                if (currentTransfer && currentTransfer.transferMethod === 'webrtc') {
                    log('WebRTC transfer failed due to data channel error');
                    currentTransfer.dataChannelClosed = true;
                }
            };
            
            if (!isSender) {
                // Receiver: handle incoming data
                channel.onmessage = (event) => {
                    if (typeof event.data === 'string') {
                        // JSON message (metadata)
                        try {
                            const data = JSON.parse(event.data);
                            if (data.type === 'file_metadata') {
                                log(`File metadata: ${data.name}, ${data.size} bytes`);
                            }
                        } catch (e) {
                            log(`Error parsing JSON message: ${e.message}`);
                        }
                    } else {
                        // Binary message (chunk data)
                        handleWebRTCBinaryChunk(event.data);
                    }
                };
            }
        }
        
        async function sendFileViaWebRTC() {
            if (!dataChannel || dataChannel.readyState !== 'open') {
                log('Data channel not ready, waiting...');
                setTimeout(() => sendFileViaWebRTC(), 100);
                return;
            }
            
            if (!currentTransfer || !currentTransfer.file) return;
            
            // Check if data channel was closed due to error
            if (currentTransfer.dataChannelClosed) {
                log('Transfer cancelled - data channel was closed');
                return;
            }
            
            const file = currentTransfer.file;
            const chunkSize = currentTransfer.chunkSize;
            const totalChunks = currentTransfer.totalChunks;
            
            log(`Starting WebRTC transfer: ${file.name} (${totalChunks} chunks, ${formatFileSize(file.size)})`);
            
            try {
                // Send file metadata first (as JSON)
                dataChannel.send(JSON.stringify({
                    type: 'file_metadata',
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    totalChunks: totalChunks
                }));
                log('File metadata sent');
                
                // Send chunks as binary data for efficiency
                for (let i = 0; i < totalChunks; i++) {
                    // Check data channel state before each chunk
                    if (!dataChannel || dataChannel.readyState !== 'open') {
                        log(`Data channel closed during transfer at chunk ${i}`);
                        break;
                    }
                    
                    // Check if transfer was cancelled
                    if (currentTransfer.dataChannelClosed) {
                        log(`Transfer cancelled at chunk ${i}`);
                        break;
                    }
                    
                    const start = i * chunkSize;
                    const end = Math.min(start + chunkSize, file.size);
                    const chunk = file.slice(start, end);
                    
                    // Convert to ArrayBuffer
                    const arrayBuffer = await chunk.arrayBuffer();
                    
                    // Create a message with metadata header + binary data
                    // First 32 bytes: header with chunk index (4 bytes) and total chunks (4 bytes)
                    const header = new ArrayBuffer(32);
                    const headerView = new DataView(header);
                    headerView.setUint32(0, i, true); // chunk_index (little-endian)
                    headerView.setUint32(4, totalChunks, true); // total_chunks
                    headerView.setUint32(8, arrayBuffer.byteLength, true); // chunk_size
                    
                    // Combine header + data
                    const combinedBuffer = new ArrayBuffer(32 + arrayBuffer.byteLength);
                    new Uint8Array(combinedBuffer, 0, 32).set(new Uint8Array(header));
                    new Uint8Array(combinedBuffer, 32).set(new Uint8Array(arrayBuffer));
                    
                    try {
                        // Check buffer state before sending
                        if (dataChannel.bufferedAmount > 1024 * 1024) { // 1MB buffer limit
                            log(`Buffer full (${dataChannel.bufferedAmount} bytes), waiting...`);
                            await new Promise(resolve => setTimeout(resolve, 10));
                        }
                        
                        dataChannel.send(combinedBuffer); // Send as binary
                        currentTransfer.sentChunks++;
                        
                        // Update progress (every 50 chunks or last chunk for better performance)
                        if (i % 50 === 0 || i === totalChunks - 1) {
                            const progress = (currentTransfer.sentChunks / totalChunks) * 100;
                            updateSenderProgress({progress: progress, chunk_index: i});
                            log(`Sent chunk ${i + 1}/${totalChunks} (${progress.toFixed(1)}%) - Buffer: ${dataChannel.bufferedAmount} bytes`);
                        }
                    } catch (e) {
                        log(`Error sending chunk ${i}: ${e.message}`);
                        currentTransfer.dataChannelClosed = true;
                        break;
                    }
                    
                    // Adaptive delay based on buffer state
                    const bufferDelay = Math.min(dataChannel.bufferedAmount / 1024, 10); // Max 10ms delay
                    await new Promise(resolve => setTimeout(resolve, bufferDelay));
                }
                
                // Send completion message (as JSON)
                if (dataChannel && dataChannel.readyState === 'open' && !currentTransfer.dataChannelClosed) {
                    const completionMsg = new ArrayBuffer(32);
                    const completionView = new DataView(completionMsg);
                    completionView.setUint32(0, 0xFFFFFFFF, true); // Special marker for completion
                    dataChannel.send(completionMsg);
                    log('Transfer completion signal sent');
                }
                
                const finalProgress = (currentTransfer.sentChunks / totalChunks) * 100;
                log(`WebRTC transfer complete: ${currentTransfer.sentChunks}/${totalChunks} chunks sent (${finalProgress.toFixed(1)}%)`);
                
            } catch (e) {
                log(`WebRTC transfer failed: ${e.message}`);
                currentTransfer.dataChannelClosed = true;
            }
        }
        
        function handleWebRTCBinaryChunk(buffer) {
            if (!currentTransfer) return;
            
            const view = new DataView(buffer);
            const chunkIndex = view.getUint32(0, true);
            const totalChunks = view.getUint32(4, true);
            const chunkSize = view.getUint32(8, true);
            
            // Check for completion marker
            if (chunkIndex === 0xFFFFFFFF) {
                log('Received transfer complete signal');
                if (currentTransfer.receivedChunks === currentTransfer.totalChunks) {
                    reconstructFile();
                }
                return;
            }
            
            // Extract chunk data (skip 32-byte header)
            const chunkData = new Uint8Array(buffer, 32, chunkSize);
            
            // Store chunk
            if (!currentTransfer.chunks) {
                currentTransfer.chunks = new Array(totalChunks);
            }
            currentTransfer.chunks[chunkIndex] = chunkData;
            currentTransfer.receivedChunks++;
            
            // Update progress (every 10 chunks or last chunk)
            if (chunkIndex % 10 === 0 || chunkIndex === totalChunks - 1) {
                const progress = (currentTransfer.receivedChunks / totalChunks) * 100;
                updateReceiverProgress({progress: progress});
            }
            
            // Check if complete
            if (currentTransfer.receivedChunks === totalChunks) {
                reconstructFile();
            }
        }
        
        function reconstructFile() {
            if (!currentTransfer || !currentTransfer.chunks) return;
            
            const chunks = currentTransfer.chunks;
            const totalSize = currentTransfer.fileInfo.size;
            
            // Combine all chunks
            const combinedArray = new Uint8Array(totalSize);
            let offset = 0;
            
            for (let i = 0; i < chunks.length; i++) {
                if (chunks[i]) {
                    combinedArray.set(chunks[i], offset);
                    offset += chunks[i].length;
                }
            }
            
            // Create blob and trigger download
            const blob = new Blob([combinedArray], { type: currentTransfer.fileInfo.type || 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = currentTransfer.fileInfo.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            log(`File received and downloaded: ${currentTransfer.fileInfo.name}`);
            handleTransferComplete({file_info: currentTransfer.fileInfo});
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
            webrtcTransferMode = false;
        }
        
        function handleFileChunk(message) {
            if (!currentTransfer) return;
            
            const chunkData = message.chunk_data;
            const chunkIndex = message.chunk_index;
            const senderId = message.sender_id;
            
            // Store chunk
            currentTransfer.chunks[chunkIndex] = chunkData;
            currentTransfer.receivedChunks++;
            
            // Update progress
            const progress = (currentTransfer.receivedChunks / currentTransfer.totalChunks) * 100;
            updateReceiverProgress({progress: progress, chunk_index: chunkIndex});
            
            // Send acknowledgment
            ws.send(JSON.stringify({
                type: 'chunk_received',
                sender_id: senderId,
                chunk_index: chunkIndex
            }));
            
            // Check if transfer is complete
            if (currentTransfer.receivedChunks === currentTransfer.totalChunks) {
                handleTransferComplete({file_info: currentTransfer.fileInfo});
            }
        }
        
        function updateSenderProgress(message) {
            if (!currentTransfer) return;
            
            const progress = message.progress;
            document.getElementById('senderProgress').style.width = progress + '%';
            document.getElementById('senderPercent').textContent = progress.toFixed(1) + '%';
            
            if (progress >= 100) {
                document.getElementById('transferStatus').textContent = 'Transfer completed!';
            }
        }
        
        function updateReceiverProgress(message) {
            if (!currentTransfer) return;
            
            // Calculate progress, handling edge cases to avoid NaN
            let progress = message.progress;
            
            // If progress not provided in message, calculate it
            if (progress === undefined || isNaN(progress)) {
                // Check if we're the receiver (have fileInfo, not file)
                if (currentTransfer.fileInfo && currentTransfer.totalChunks && currentTransfer.totalChunks > 0) {
                    // Receiver calculating own progress
                    progress = (currentTransfer.receivedChunks / currentTransfer.totalChunks) * 100;
                } else if (currentTransfer.file && currentTransfer.totalChunks && currentTransfer.totalChunks > 0) {
                    // Sender calculating receiver progress based on acknowledgments
                    const acknowledgedChunks = currentTransfer.acknowledgedChunks || 0;
                    progress = (acknowledgedChunks / currentTransfer.totalChunks) * 100;
                } else {
                    progress = 0;
                }
            }
            
            // Ensure progress is a valid number between 0 and 100
            if (isNaN(progress) || progress < 0) {
                progress = 0;
            } else if (progress > 100) {
                progress = 100;
            }
            
            document.getElementById('receiverProgress').style.width = progress + '%';
            document.getElementById('receiverPercent').textContent = progress.toFixed(1) + '%';
        }
        
        function handleTransferComplete(message) {
            if (!currentTransfer) return;
            
            const fileInfo = message.file_info || currentTransfer.fileInfo;
            const transferMethod = currentTransfer.transferMethod || 'websocket';
            log(`Transfer completed: ${fileInfo.name} (via ${transferMethod})`);
            
            document.getElementById('transferStatus').textContent = `Transfer completed: ${fileInfo.name}`;
            
            // Cleanup WebRTC if used
            if (transferMethod === 'webrtc') {
                cleanupWebRTC();
            }
            
            // Reset transfer state
            currentTransfer = null;
            document.getElementById('transferMethod').style.display = 'none';
        }
        
        async function sendFileChunks() {
            if (!currentTransfer || !currentTransfer.file) return;
            
            const file = currentTransfer.file;
            const chunkSize = currentTransfer.chunkSize;
            const totalChunks = currentTransfer.totalChunks;
            
            for (let i = 0; i < totalChunks; i++) {
                // Check connection state before sending each chunk
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    log('Connection closed during transfer. Stopping chunk transmission.');
                    break;
                }
                
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                const chunk = file.slice(start, end);
                
                // Convert chunk to base64 for transmission
                const chunkData = await fileToBase64(chunk);
                
                try {
                // Send chunk
                ws.send(JSON.stringify({
                    type: 'file_chunk',
                    chunk_data: chunkData,
                    chunk_index: i,
                    total_chunks: totalChunks,
                    receiver_id: currentTransfer.receiverId
                }));
                
                currentTransfer.sentChunks++;
                
                // Update progress
                const progress = (currentTransfer.sentChunks / totalChunks) * 100;
                updateSenderProgress({progress: progress, chunk_index: i});
                } catch (e) {
                    log(`Error sending chunk ${i}: ${e.message}`);
                    break;
                }
                
                // Small delay to prevent overwhelming the connection and allow pings to be processed
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            if (currentTransfer) {
                log(`Transfer complete: ${currentTransfer.sentChunks}/${totalChunks} chunks sent`);
            }
        }
        
        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]); // Remove data:type;base64, prefix
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
        
        // Heartbeat to keep connection alive
        let heartbeatInterval;
        
        function startHeartbeat() {
            // Send ping more frequently to prevent timeout during large transfers
            heartbeatInterval = setInterval(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    try {
                    ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
                    } catch (e) {
                        log(`Failed to send heartbeat: ${e.message}`);
                }
                }
            }, 10000); // Send ping every 10 seconds (reduced from 30s)
        }
        
        function stopHeartbeat() {
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
            }
        }
        
        // IMMEDIATELY log message to messages div on script load (BEFORE window.onload)
        (function() {
            const BUILD_VERSION = '{1}';
            const BUILD_TIMESTAMP = '{2}';
            const timestamp = new Date().toLocaleTimeString();
            
            // ========== CONSOLE LOGS (RUNS FIRST) ==========
            const isTest55 = window.location.pathname.includes('test55');
            const endpointLabel = isTest55 ? '✨ NEW ENDPOINT /test55 - NO CACHE ✨' : '';
            
            console.log('%c' + '='.repeat(80), 'font-size: 14px; font-weight: bold; color: #28a745;');
            console.log('%c🚀 NEW VERSION LOADED! 🚀', 'font-size: 30px; font-weight: bold; color: green; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);');
            if (isTest55) {
                console.log('%c' + endpointLabel, 'font-size: 22px; font-weight: bold; color: #ff6b6b; background: #fff3cd; padding: 10px;');
            }
            console.log('%c✅ Testing WebRTC - Page Refreshed Successfully!', 'font-size: 20px; color: #155724; font-weight: bold;');
            console.log('%c' + '='.repeat(80), 'font-size: 14px; font-weight: bold; color: #28a745;');
            console.log('%c📦 Build Version:', 'font-size: 16px; color: #155724; font-weight: bold;', BUILD_VERSION);
            console.log('%c📅 Build Time:', 'font-size: 16px; color: #155724; font-weight: bold;', BUILD_TIMESTAMP);
            console.log('%c🕐 Page Load Time:', 'font-size: 16px; color: #155724; font-weight: bold;', timestamp);
            console.log('%c🌐 URL:', 'font-size: 16px; color: #155724; font-weight: bold;', window.location.href);
            console.log('%c🔍 User Agent:', 'font-size: 14px; color: #666;', navigator.userAgent);
            
            // Check WebRTC support
            const webrtcSupported = !!window.RTCPeerConnection;
            const webrtcStatusText = webrtcSupported ? '✅ Available' : '❌ Not Available';
            const webrtcStatusColor = webrtcSupported ? '#155724' : '#dc3545';
            console.log('%c🎥 WebRTC Support:', 'font-size: 16px; color: ' + webrtcStatusColor + '; font-weight: bold;', webrtcStatusText);
            
            if (webrtcSupported) {
                console.log('%c   └─ RTCPeerConnection:', 'color: #666;', typeof window.RTCPeerConnection);
                console.log('%c   └─ RTCDataChannel:', 'color: #666;', typeof window.RTCDataChannel);
                console.log('%c   └─ getUserMedia:', 'color: #666;', typeof navigator.mediaDevices?.getUserMedia);
            } else {
                console.warn('%c⚠️ WebRTC is NOT available in this browser!', 'font-size: 14px; color: #dc3545; font-weight: bold;');
                console.warn('   Large file transfers require WebRTC. Please use Chrome, Firefox, or Edge.');
            }
            
            console.log('%c' + '='.repeat(80), 'font-size: 14px; font-weight: bold; color: #28a745;');
            console.log('%c✅ If you see these console logs, the NEW code is loaded!', 'font-size: 14px; color: #155724; font-weight: bold;');
            console.log('%c' + '='.repeat(80), 'font-size: 14px; font-weight: bold; color: #28a745;');
            
            // ========== PAGE UPDATES ==========
            // Update page title
            document.title = `ShareZidi v3.0 - Debug Test [Build: ${BUILD_VERSION}]`;
            console.log('%c📄 Page title updated:', 'color: #666;', document.title);
            
            // Add visible log message to messages div IMMEDIATELY
            const messagesDiv = document.getElementById('messages');
            if (messagesDiv) {
                // Remove the red "old cached version" warning if it exists
                const warningBox = messagesDiv.querySelector('[style*="background: #ff6b6b"]');
                if (warningBox) {
                    warningBox.style.display = 'none';
                    console.log('%c✅ Removed old cache warning box', 'color: #28a745;');
                }
                
                // Add confirmation message at the TOP of messages div
                const confirmMsg = document.createElement('div');
                confirmMsg.style.cssText = 'background: #28a745; color: white; padding: 15px; margin: 10px 0; border-radius: 8px; font-size: 1.1em; font-weight: bold; border: 3px solid #1e7e34;';
                confirmMsg.innerHTML = `✅ <strong>[${timestamp}]</strong> Testing WebRTC - Page refreshed successfully!<br>` +
                    `✅ Build Version: <strong>${BUILD_VERSION}</strong><br>` +
                    `✅ Build Time: <strong>${BUILD_TIMESTAMP}</strong><br>` +
                    `✅ WebRTC Support: <strong id="webrtcCheckMsg">Checking...</strong>`;
                messagesDiv.insertBefore(confirmMsg, messagesDiv.firstChild.nextSibling); // Insert after green box
                console.log('%c✅ Added confirmation message to page', 'color: #28a745;');
                
                // Check WebRTC support immediately
                const webrtcCheckMsg = document.getElementById('webrtcCheckMsg');
                if (webrtcCheckMsg) {
                    if (window.RTCPeerConnection) {
                        webrtcCheckMsg.innerHTML = '<span style="color: #90EE90;">✅ Available</span>';
                        console.log('%c✅ WebRTC status updated in page', 'color: #28a745;');
                    } else {
                        webrtcCheckMsg.innerHTML = '<span style="color: #ff6b6b;">❌ Not Available</span>';
                        console.warn('%c⚠️ WebRTC not available - updated status in page', 'color: #dc3545;');
                    }
                }
            } else {
                console.error('%c❌ Messages div not found!', 'color: #dc3545; font-weight: bold;');
            }
            
            // Update green banner status
            const webrtcStatus = document.getElementById('webrtcStatus');
            if (webrtcStatus) {
                webrtcStatus.innerHTML = window.RTCPeerConnection 
                    ? '<span style="color: green; font-weight: bold; font-size: 1.2em;">✅ Available</span>' 
                    : '<span style="color: red; font-weight: bold; font-size: 1.2em;">❌ Not Available</span>';
                console.log('%c✅ WebRTC status updated in banner', 'color: #28a745;');
            }
            
            const buildDate = document.getElementById('buildDate');
            if (buildDate) {
                buildDate.textContent = BUILD_TIMESTAMP;
                console.log('%c✅ Build date updated in banner', 'color: #28a745;');
            }
            
            console.log('%c✅ Initialization complete!', 'font-size: 14px; color: #28a745; font-weight: bold;');
        })();
        
        // Auto-connect on page load
        window.onload = function() {
            log('Page loaded, attempting to connect...');
            connect();
        };
    </script>
    <!-- Build Version: {1} - Cache buster - Generated at {2} -->
</body>
</html>
    """).replace('{1}', version).replace('{2}', build_timestamp)
        response = HTMLResponse(content=html_content)
        # Add extremely aggressive cache-busting headers
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0, private"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "Thu, 01 Jan 1970 00:00:00 GMT"
        response.headers["Last-Modified"] = datetime.now().strftime("%a, %d %b %Y %H:%M:%S GMT")
        response.headers["ETag"] = f'"{version}"'
        response.headers["X-Build-Version"] = version  # Custom header to track version
        response.headers["X-Build-Time"] = build_timestamp
        # Prevent FastAPI/Starlette from adding default cache headers
        response.headers["Vary"] = "*"
        return response
    except Exception as e:
        import traceback
        error_msg = f"Error generating page: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        return HTMLResponse(
            content=f"<h1>Error</h1><pre>{error_msg}</pre>",
            status_code=500
        )

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    
    # Send device ID to the client
    device_id = manager.device_ids.get(client_id)
    if device_id:
        await websocket.send_text(json.dumps({
            "type": "device_assigned",
            "device_id": device_id
        }))
    
    # Broadcast device list update to all clients (including the new one)
    await manager.broadcast_device_list_update()
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            message_type = message.get("type")
            
            logger.info(f"Received message from {client_id}: {message}")
            
            if message_type == "ping":
                # Respond immediately to keep connection alive
                try:
                    await websocket.send_text(json.dumps({
                        "type": "pong", 
                        "timestamp": message.get("timestamp"),
                        "server_time": datetime.now().isoformat()
                    }))
                except Exception as e:
                    logger.error(f"Failed to send pong to {client_id}: {e}")
                    raise
            
            elif message_type == "broadcast":
                # Broadcast message to all other clients
                await manager.broadcast_to_others(client_id, {
                    "type": "message_from_client",
                    "from_client": client_id,
                    "content": message.get("content", ""),
                    "timestamp": datetime.now().isoformat()
                })
                logger.info(f"Client {client_id} broadcasted message to others")
            
            elif message_type == "get_stats":
                await websocket.send_text(json.dumps({
                    "type": "stats",
                    "total_connections": len(manager.active_connections),
                    "clients": list(manager.active_connections.keys()),
                    "devices": {cid: manager.device_ids.get(cid, "Unknown") for cid in manager.active_connections.keys()}
                }))
            
            elif message_type == "file_transfer_start":
                # Handle file transfer initiation
                file_info = message.get("file_info", {})
                receiver_id = message.get("receiver_id")
                
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
                
                # Notify receiver about incoming transfer
                await manager.send_to_client(receiver_id, json.dumps({
                    "type": "incoming_transfer",
                    "file_info": file_info,
                    "sender_id": client_id,
                    "timestamp": datetime.now().isoformat()
                }))
                
                # Confirm to sender
                await websocket.send_text(json.dumps({
                    "type": "transfer_started",
                    "file_info": file_info,
                    "receiver_id": receiver_id,
                    "status": "pending"
                }))
                
                logger.info(f"File transfer started from {client_id} to {receiver_id}: {file_info.get('name', 'Unknown')}")
            
            elif message_type == "file_chunk":
                # Handle file chunk transfer
                chunk_data = message.get("chunk_data")
                chunk_index = message.get("chunk_index")
                total_chunks = message.get("total_chunks")
                receiver_id = message.get("receiver_id")
                
                if receiver_id and receiver_id in manager.active_connections:
                    # Forward chunk to receiver
                    await manager.send_to_client(receiver_id, json.dumps({
                        "type": "file_chunk",
                        "chunk_data": chunk_data,
                        "chunk_index": chunk_index,
                        "total_chunks": total_chunks,
                        "sender_id": client_id
                    }))
                    
                    # Send progress update to sender
                    progress = ((chunk_index + 1) / total_chunks) * 100
                    await websocket.send_text(json.dumps({
                        "type": "transfer_progress",
                        "progress": progress,
                        "chunk_index": chunk_index,
                        "total_chunks": total_chunks,
                        "status": "sending"
                    }))
                    
                    logger.info(f"Chunk {chunk_index + 1}/{total_chunks} sent from {client_id} to {receiver_id} ({progress:.1f}%)")
            
            elif message_type == "chunk_received":
                # Handle chunk acknowledgment
                sender_id = message.get("sender_id")
                chunk_index = message.get("chunk_index")
                
                if sender_id and sender_id in manager.active_connections:
                    success = await manager.send_to_client(sender_id, json.dumps({
                        "type": "chunk_ack",
                        "chunk_index": chunk_index,
                        "receiver_id": client_id
                    }))
                    
                    if success:
                        logger.info(f"Chunk {chunk_index} acknowledged by {client_id} to {sender_id}")
                    else:
                        logger.warning(f"Failed to send chunk acknowledgment to disconnected sender {sender_id}")
                else:
                    logger.warning(f"Cannot send chunk acknowledgment to disconnected sender {sender_id}")
            
            elif message_type == "transfer_complete":
                # Handle transfer completion
                sender_id = message.get("sender_id")
                file_info = message.get("file_info", {})
                
                if sender_id and sender_id in manager.active_connections:
                    await manager.send_to_client(sender_id, json.dumps({
                        "type": "transfer_complete",
                        "receiver_id": client_id,
                        "file_info": file_info
                    }))
                    
                    logger.info(f"Transfer completed: {file_info.get('name', 'Unknown')} received by {client_id}")
            
            # WebRTC Signaling - ICE Candidate
            elif message_type == "webrtc_ice_candidate":
                receiver_id = message.get("receiver_id")
                candidate = message.get("candidate")
                
                if receiver_id and receiver_id in manager.active_connections:
                    await manager.send_to_client(receiver_id, json.dumps({
                        "type": "webrtc_ice_candidate",
                        "sender_id": client_id,
                        "candidate": candidate
                    }))
                    logger.info(f"Forwarded ICE candidate from {client_id} to {receiver_id}")
            
            # WebRTC Signaling - Offer
            elif message_type == "webrtc_offer":
                receiver_id = message.get("receiver_id")
                offer = message.get("offer")
                file_info = message.get("file_info")
                
                if receiver_id and receiver_id in manager.active_connections:
                    await manager.send_to_client(receiver_id, json.dumps({
                        "type": "webrtc_offer",
                        "sender_id": client_id,
                        "offer": offer,
                        "file_info": file_info
                    }))
                    logger.info(f"Forwarded WebRTC offer from {client_id} to {receiver_id}")
            
            # WebRTC Signaling - Answer
            elif message_type == "webrtc_answer":
                sender_id = message.get("sender_id")
                answer = message.get("answer")
                
                if sender_id and sender_id in manager.active_connections:
                    await manager.send_to_client(sender_id, json.dumps({
                        "type": "webrtc_answer",
                        "receiver_id": client_id,
                        "answer": answer
                    }))
                    logger.info(f"Forwarded WebRTC answer from {client_id} to {sender_id}")
            
            # WebRTC Connection Status
            elif message_type == "webrtc_connection_status":
                receiver_id = message.get("receiver_id")
                status = message.get("status")
                
                if receiver_id and receiver_id in manager.active_connections:
                    await manager.send_to_client(receiver_id, json.dumps({
                        "type": "webrtc_connection_status",
                        "sender_id": client_id,
                        "status": status
                    }))
                    logger.info(f"WebRTC connection status from {client_id} to {receiver_id}: {status}")
    
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        # Broadcast device list update to remaining clients
        await manager.broadcast_device_list_update()
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        manager.disconnect(client_id)
        # Broadcast device list update to remaining clients
        await manager.broadcast_device_list_update()

if __name__ == "__main__":
    import uvicorn
    print("=" * 70)
    print("Starting ShareZidi v3.0 Debug Server")
    print("=" * 70)
    print("WebSocket will run on port 8003")
    print("")
    print("Test Pages:")
    print("   NEW (NO CACHE): http://localhost:8003/test55")
    print("   Test 2:         http://localhost:8003/test2")
    print("   Test (OLD):     http://localhost:8003/test")
    print("")
    print("Stats:             http://localhost:8003/stats")
    print("=" * 70)
    print("Use /test55 to bypass ALL browser cache!")
    print("=" * 70)
    uvicorn.run(
        app, 
        host="127.0.0.1", 
        port=8003, 
        log_level="info",
        ws_ping_interval=20,  # Send WebSocket ping frame every 20 seconds
        ws_ping_timeout=10,   # Timeout after 10 seconds of no pong
        timeout_keep_alive=75  # Keep connections alive for 75 seconds
    )
