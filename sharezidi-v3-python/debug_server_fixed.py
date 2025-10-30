#!/usr/bin/env python3
"""
Fixed WebSocket server with proper WebRTC data channel handling
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
    title="ShareZidi v3.0 - Fixed Server",
    description="Fixed server with proper WebRTC data channel handling",
    version="3.0.1",
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
        "message": "ShareZidi v3.0 - Fixed Server",
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
async def test_page():
    """Test page with fixed WebRTC implementation"""
    import time
    version = f"{int(time.time())}-{random.randint(1000, 9999)}"
    build_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>ShareZidi v3.0 - Fixed WebRTC [Build: {version}]</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .status {{ padding: 10px; margin: 10px 0; border-radius: 5px; }}
        .connected {{ background-color: #d4edda; color: #155724; }}
        .disconnected {{ background-color: #f8d7da; color: #721c24; }}
        #messages {{ border: 1px solid #ccc; height: 300px; width: 1200px; overflow-y: scroll; padding: 10px; }}
        button {{ padding: 10px 15px; margin: 5px; cursor: pointer; }}
        input {{ padding: 5px; margin: 5px; }}
        .progress-bar {{ background: #e0e0e0; border-radius: 4px; height: 20px; margin: 5px 0; }}
        .progress-fill {{ background: #4CAF50; height: 100%; border-radius: 4px; transition: width 0.3s; }}
    </style>
</head>
<body>
    <h1>ShareZidi v3.0 - Fixed WebRTC Implementation</h1>
    <div id="status" class="status disconnected">Connecting...</div>
    <div id="deviceId" style="margin: 10px 0; padding: 8px; background: #e8f4fd; border-radius: 4px; font-weight: bold; display: none;">
        ID: <span id="deviceIdValue">Loading...</span>
    </div>
    
    <div>
        <button onclick="sendPing()">Send Ping</button>
        <button onclick="getStats()">Get Stats</button>
        <button onclick="clearMessages()">Clear Messages</button>
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
            <strong>Status:</strong> <span id="transferStatus">Idle</span>
        </div>
        <div style="margin: 10px 0;">
            <strong>Sender Progress:</strong>
            <div class="progress-bar">
                <div id="senderProgress" class="progress-fill" style="width: 0%;"></div>
            </div>
            <span id="senderPercent">0%</span>
        </div>
        <div style="margin: 10px 0;">
            <strong>Receiver Progress:</strong>
            <div class="progress-bar" style="background: #e0e0e0;">
                <div id="receiverProgress" style="background: #2196F3; height: 100%; border-radius: 4px; width: 0%; transition: width 0.3s;"></div>
            </div>
            <span id="receiverPercent">0%</span>
        </div>
    </div>
    
    <div id="messages">
        <div style="background: #d4edda; padding: 15px; margin: 10px 0; border-radius: 8px;">
            <strong>✅ Fixed Version Loaded!</strong><br>
            Build: {version}<br>
            Time: {build_timestamp}<br>
            <span style="color: #155724; font-weight: bold;">WebRTC data channel handling has been fixed!</span>
        </div>
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
        let pendingChunks = [];
        let isChannelReady = false;
        
        // WebRTC configuration
        const rtcConfiguration = {{
            iceServers: [
                {{ urls: 'stun:stun.l.google.com:19302' }},
                {{ urls: 'stun:stun1.l.google.com:19302' }},
                {{ 
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }}
            ],
            iceCandidatePoolSize: 10
        }};
        
        function log(message) {{
            const messagesDiv = document.getElementById('messages');
            const timestamp = new Date().toLocaleTimeString();
            messagesDiv.innerHTML += `<div><strong>[${{timestamp}}]</strong> ${{message}}</div>`;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            console.log(`[${{timestamp}}] ${{message}}`);
        }}
        
        function connect() {{
            if (ws && ws.readyState === WebSocket.OPEN) {{
                log('Already connected');
                return;
            }}
            
            log(`Connecting to WebSocket as ${{clientId}}...`);
            ws = new WebSocket(`ws://localhost:8003/ws/${{clientId}}?device_type=desktop&supports_webrtc=true`);
            
            ws.onopen = function(event) {{
                document.getElementById('status').textContent = 'Connected!';
                document.getElementById('status').className = 'status connected';
                log('WebSocket connected successfully!');
                startHeartbeat();
            }};
            
            ws.onmessage = function(event) {{
                const message = JSON.parse(event.data);
                log(`Received: ${{JSON.stringify(message).substring(0, 100)}}...`);
                
                if (message.type === 'device_assigned') {{
                    myDeviceId = message.device_id;
                    document.getElementById('deviceIdValue').textContent = myDeviceId;
                    document.getElementById('deviceId').style.display = 'block';
                    log(`Assigned device ID: ${{myDeviceId}}`);
                }} else if (message.type === 'devices_updated') {{
                    connectedClients = message.other_clients || [];
                    updateReceiverSelect(message.other_devices || message.devices);
                }} else if (message.type === 'get_stats') {{
                    ws.send(JSON.stringify({{ type: 'get_stats' }}));
                }} else if (message.type === 'webrtc_offer') {{
                    handleWebRTCOffer(message);
                }} else if (message.type === 'webrtc_answer') {{
                    handleWebRTCAnswer(message);
                }} else if (message.type === 'webrtc_ice_candidate') {{
                    handleWebRTCIceCandidate(message);
                }}
            }};
            
            ws.onclose = function(event) {{
                document.getElementById('status').textContent = 'Disconnected';
                document.getElementById('status').className = 'status disconnected';
                log(`WebSocket closed: Code=${{event.code}}`);
                stopHeartbeat();
                setTimeout(() => connect(), 2000);
            }};
            
            ws.onerror = function(error) {{
                log(`WebSocket error: ${{error}}`);
            }};
        }}
        
        function sendPing() {{
            if (ws && ws.readyState === WebSocket.OPEN) {{
                ws.send(JSON.stringify({{ type: 'ping', timestamp: new Date().toISOString() }}));
                log('Sent ping');
            }}
        }}
        
        function getStats() {{
            if (ws && ws.readyState === WebSocket.OPEN) {{
                ws.send(JSON.stringify({{ type: 'get_stats' }}));
                log('Requested stats');
            }}
        }}
        
        function clearMessages() {{
            document.getElementById('messages').innerHTML = '';
        }}
        
        function selectFile() {{
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            if (file) {{
                selectedFile = file;
                document.getElementById('fileName').textContent = file.name;
                document.getElementById('fileSize').textContent = formatFileSize(file.size);
                document.getElementById('fileType').textContent = file.type || 'Unknown';
                document.getElementById('fileInfo').style.display = 'block';
                document.getElementById('transferBtn').disabled = false;
                log(`File selected: ${{file.name}} (${{formatFileSize(file.size)}})`);
            }}
        }}
        
        function formatFileSize(bytes) {{
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }}
        
        function updateReceiverSelect(devices = {{}}) {{
            const select = document.getElementById('receiverSelect');
            select.innerHTML = '<option value="">Select Receiver...</option>';
            
            const otherClients = connectedClients.filter(id => id !== clientId);
            
            if (otherClients.length === 0) {{
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No other devices connected';
                option.disabled = true;
                select.appendChild(option);
            }} else {{
                otherClients.forEach(clientIdToAdd => {{
                    const deviceId = devices[clientIdToAdd] || clientIdToAdd;
                    const option = document.createElement('option');
                    option.value = clientIdToAdd;
                    option.textContent = `${{deviceId}} (${{clientIdToAdd}})`;
                    select.appendChild(option);
                }});
            }}
        }}
        
        function startTransfer() {{
            const receiverId = document.getElementById('receiverSelect').value;
            if (!receiverId || !selectedFile) {{
                alert('Please select a file and receiver');
                return;
            }}
            
            document.getElementById('transferProgress').style.display = 'block';
            document.getElementById('transferStatus').textContent = 'Initializing WebRTC...';
            
            // Always use WebRTC for file transfers
            startWebRTCTransfer(receiverId);
        }}
        
        function startWebRTCTransfer(receiverId) {{
            log('Starting WebRTC transfer setup...');
            
            currentTransfer = {{
                file: selectedFile,
                receiverId: receiverId,
                chunkSize: 16 * 1024, // 16KB chunks
                totalChunks: Math.ceil(selectedFile.size / (16 * 1024)),
                sentChunks: 0
            }};
            
            // Create peer connection
            peerConnection = new RTCPeerConnection(rtcConfiguration);
            
            // Create data channel with proper options
            dataChannel = peerConnection.createDataChannel('fileTransfer', {{
                ordered: true,
                maxPacketLifeTime: 3000
            }});
            
            setupDataChannelHandlers(true); // true = sender
            
            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {{
                if (event.candidate) {{
                    ws.send(JSON.stringify({{
                        type: 'webrtc_ice_candidate',
                        receiver_id: receiverId,
                        candidate: event.candidate
                    }}));
                }}
            }};
            
            // Handle connection state
            peerConnection.onconnectionstatechange = () => {{
                const state = peerConnection.connectionState;
                log(`WebRTC connection state: ${{state}}`);
                document.getElementById('transferStatus').textContent = `WebRTC: ${{state}}`;
                
                if (state === 'failed' || state === 'disconnected' || state === 'closed') {{
                    cleanupWebRTC();
                    alert('WebRTC connection failed');
                }}
            }};
            
            // Create and send offer
            peerConnection.createOffer()
                .then(offer => peerConnection.setLocalDescription(offer))
                .then(() => {{
                    setTimeout(() => {{
                        ws.send(JSON.stringify({{
                            type: 'webrtc_offer',
                            receiver_id: receiverId,
                            offer: peerConnection.localDescription,
                            file_info: {{
                                name: selectedFile.name,
                                size: selectedFile.size,
                                type: selectedFile.type
                            }}
                        }}));
                        log('WebRTC offer sent');
                    }}, 1000); // Wait for ICE gathering
                }})
                .catch(error => {{
                    log(`Error creating offer: ${{error.message}}`);
                    cleanupWebRTC();
                }});
        }}
        
        function setupDataChannelHandlers(isSender) {{
            dataChannel.onopen = () => {{
                log('✅ Data channel opened successfully!');
                isChannelReady = true;
                document.getElementById('transferStatus').textContent = 'Data channel ready!';
                
                if (isSender && currentTransfer && currentTransfer.file) {{
                    // Start sending file after a short delay to ensure stability
                    setTimeout(() => {{
                        log('Starting file transmission...');
                        sendFileViaWebRTC();
                    }}, 500);
                }}
            }};
            
            dataChannel.onclose = () => {{
                log('Data channel closed');
                isChannelReady = false;
            }};
            
            dataChannel.onerror = (error) => {{
                log(`❌ Data channel error: ${{error.type || 'Unknown'}}`);
                isChannelReady = false;
            }};
            
            if (!isSender) {{
                dataChannel.onmessage = (event) => {{
                    handleIncomingData(event.data);
                }};
            }}
        }}
        
        async function sendFileViaWebRTC() {{
            if (!isChannelReady) {{
                log('⚠️ Data channel not ready, waiting...');
                setTimeout(() => sendFileViaWebRTC(), 500);
                return;
            }}
            
            if (!currentTransfer || !currentTransfer.file) {{
                log('No transfer to send');
                return;
            }}
            
            const file = currentTransfer.file;
            const chunkSize = currentTransfer.chunkSize;
            const totalChunks = currentTransfer.totalChunks;
            
            log(`📤 Sending file: ${{file.name}} (${{totalChunks}} chunks)`);
            document.getElementById('transferStatus').textContent = 'Sending file...';
            
            try {{
                // Send metadata first
                const metadata = JSON.stringify({{
                    type: 'file_metadata',
                    name: file.name,
                    size: file.size,
                    totalChunks: totalChunks
                }});
                
                if (dataChannel.readyState === 'open') {{
                    dataChannel.send(metadata);
                    log('Metadata sent');
                }} else {{
                    log(`❌ Cannot send metadata - channel state: ${{dataChannel.readyState}}`);
                    return;
                }}
                
                // Send chunks with proper throttling
                for (let i = 0; i < totalChunks; i++) {{
                    // Check channel state before each chunk
                    if (dataChannel.readyState !== 'open') {{
                        log(`❌ Channel closed at chunk ${{i}}`);
                        break;
                    }}
                    
                    // Wait if buffer is too full
                    while (dataChannel.bufferedAmount > 65536) {{ // 64KB buffer limit
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }}
                    
                    const start = i * chunkSize;
                    const end = Math.min(start + chunkSize, file.size);
                    const chunk = file.slice(start, end);
                    const arrayBuffer = await chunk.arrayBuffer();
                    
                    // Create chunk with header
                    const header = new ArrayBuffer(8);
                    const headerView = new DataView(header);
                    headerView.setUint32(0, i, true); // chunk index
                    headerView.setUint32(4, arrayBuffer.byteLength, true); // chunk size
                    
                    // Combine header and data
                    const message = new ArrayBuffer(8 + arrayBuffer.byteLength);
                    new Uint8Array(message, 0, 8).set(new Uint8Array(header));
                    new Uint8Array(message, 8).set(new Uint8Array(arrayBuffer));
                    
                    dataChannel.send(message);
                    currentTransfer.sentChunks++;
                    
                    // Update progress
                    const progress = (currentTransfer.sentChunks / totalChunks) * 100;
                    document.getElementById('senderProgress').style.width = progress + '%';
                    document.getElementById('senderPercent').textContent = progress.toFixed(1) + '%';
                    
                    if (i % 10 === 0) {{
                        log(`Progress: ${{progress.toFixed(1)}}% (${{i + 1}}/${{totalChunks}} chunks)`);
                    }}
                    
                    // Small delay between chunks
                    await new Promise(resolve => setTimeout(resolve, 5));
                }}
                
                // Send completion signal
                if (dataChannel.readyState === 'open') {{
                    dataChannel.send(JSON.stringify({{ type: 'transfer_complete' }}));
                    log('✅ Transfer complete!');
                    document.getElementById('transferStatus').textContent = 'Transfer complete!';
                }}
                
            }} catch (error) {{
                log(`❌ Transfer error: ${{error.message}}`);
                document.getElementById('transferStatus').textContent = `Error: ${{error.message}}`;
            }}
        }}
        
        function handleIncomingData(data) {{
            // Handle incoming file chunks (receiver side)
            if (typeof data === 'string') {{
                const message = JSON.parse(data);
                if (message.type === 'file_metadata') {{
                    log(`Receiving file: ${{message.name}}`);
                    currentTransfer = {{
                        fileInfo: message,
                        chunks: [],
                        receivedChunks: 0
                    }};
                }} else if (message.type === 'transfer_complete') {{
                    reconstructFile();
                }}
            }} else {{
                // Binary data (file chunk)
                if (currentTransfer) {{
                    const view = new DataView(data);
                    const chunkIndex = view.getUint32(0, true);
                    const chunkSize = view.getUint32(4, true);
                    const chunkData = new Uint8Array(data, 8, chunkSize);
                    
                    currentTransfer.chunks[chunkIndex] = chunkData;
                    currentTransfer.receivedChunks++;
                    
                    const progress = (currentTransfer.receivedChunks / currentTransfer.fileInfo.totalChunks) * 100;
                    document.getElementById('receiverProgress').style.width = progress + '%';
                    document.getElementById('receiverPercent').textContent = progress.toFixed(1) + '%';
                }}
            }}
        }}
        
        function reconstructFile() {{
            if (!currentTransfer || !currentTransfer.chunks) return;
            
            // Combine chunks
            const chunks = currentTransfer.chunks;
            let totalSize = 0;
            chunks.forEach(chunk => {{ if (chunk) totalSize += chunk.length; }});
            
            const combinedArray = new Uint8Array(totalSize);
            let offset = 0;
            chunks.forEach(chunk => {{
                if (chunk) {{
                    combinedArray.set(chunk, offset);
                    offset += chunk.length;
                }}
            }});
            
            // Create and download file
            const blob = new Blob([combinedArray], {{ type: currentTransfer.fileInfo.type || 'application/octet-stream' }});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = currentTransfer.fileInfo.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            log(`✅ File received: ${{currentTransfer.fileInfo.name}}`);
            document.getElementById('transferStatus').textContent = 'File received!';
        }}
        
        function handleWebRTCOffer(message) {{
            const senderId = message.sender_id;
            const offer = message.offer;
            const fileInfo = message.file_info;
            
            log(`Received WebRTC offer from ${{senderId}}`);
            document.getElementById('transferProgress').style.display = 'block';
            document.getElementById('transferStatus').textContent = 'Accepting connection...';
            
            // Create peer connection as receiver
            peerConnection = new RTCPeerConnection(rtcConfiguration);
            
            // Handle incoming data channel
            peerConnection.ondatachannel = (event) => {{
                dataChannel = event.channel;
                setupDataChannelHandlers(false); // false = receiver
                log('Incoming data channel received');
            }};
            
            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {{
                if (event.candidate) {{
                    ws.send(JSON.stringify({{
                        type: 'webrtc_ice_candidate',
                        sender_id: senderId,
                        candidate: event.candidate
                    }}));
                }}
            }};
            
            // Set remote description and create answer
            peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
                .then(() => peerConnection.createAnswer())
                .then(answer => peerConnection.setLocalDescription(answer))
                .then(() => {{
                    setTimeout(() => {{
                        ws.send(JSON.stringify({{
                            type: 'webrtc_answer',
                            sender_id: senderId,
                            answer: peerConnection.localDescription
                        }}));
                        log('WebRTC answer sent');
                    }}, 1000);
                }})
                .catch(error => {{
                    log(`Error handling offer: ${{error.message}}`);
                    cleanupWebRTC();
                }});
        }}
        
        function handleWebRTCAnswer(message) {{
            if (!peerConnection) return;
            
            peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer))
                .then(() => log('WebRTC answer processed'))
                .catch(error => log(`Error setting answer: ${{error.message}}`));
        }}
        
        function handleWebRTCIceCandidate(message) {{
            if (!peerConnection) return;
            
            peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate))
                .catch(error => log(`Error adding ICE candidate: ${{error.message}}`));
        }}
        
        function cleanupWebRTC() {{
            isChannelReady = false;
            if (dataChannel) {{
                dataChannel.close();
                dataChannel = null;
            }}
            if (peerConnection) {{
                peerConnection.close();
                peerConnection = null;
            }}
            pendingChunks = [];
        }}
        
        // Heartbeat
        let heartbeatInterval;
        
        function startHeartbeat() {{
            heartbeatInterval = setInterval(() => {{
                if (ws && ws.readyState === WebSocket.OPEN) {{
                    ws.send(JSON.stringify({{ type: 'ping' }}));
                }}
            }}, 10000);
        }}
        
        function stopHeartbeat() {{
            if (heartbeatInterval) {{
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
            }}
        }}
        
        // Auto-connect on load
        window.onload = function() {{
            log('Page loaded - Fixed WebRTC version');
            connect();
        }};
    </script>
</body>
</html>
    """
    
    response = HTMLResponse(content=html_content)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    return response

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
    
    # Broadcast device list update to all clients
    await manager.broadcast_device_list_update()
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            message_type = message.get("type")
            
            logger.info(f"Received {message_type} from {client_id}")
            
            if message_type == "ping":
                # Respond to ping
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "timestamp": message.get("timestamp"),
                    "server_time": datetime.now().isoformat()
                }))
            
            elif message_type == "get_stats":
                await websocket.send_text(json.dumps({
                    "type": "stats",
                    "total_connections": len(manager.active_connections),
                    "clients": list(manager.active_connections.keys()),
                    "devices": {cid: manager.device_ids.get(cid, "Unknown") 
                              for cid in manager.active_connections.keys()}
                }))
            
            # WebRTC Signaling
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
            
            elif message_type == "webrtc_ice_candidate":
                # Forward to receiver or sender
                receiver_id = message.get("receiver_id")
                sender_id = message.get("sender_id")
                candidate = message.get("candidate")
                
                target_id = receiver_id or sender_id
                if target_id and target_id in manager.active_connections:
                    await manager.send_to_client(target_id, json.dumps({
                        "type": "webrtc_ice_candidate",
                        "sender_id": client_id if receiver_id else None,
                        "receiver_id": client_id if sender_id else None,
                        "candidate": candidate
                    }))
                    logger.info(f"Forwarded ICE candidate from {client_id} to {target_id}")
    
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        await manager.broadcast_device_list_update()
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        manager.disconnect(client_id)
        await manager.broadcast_device_list_update()

if __name__ == "__main__":
    import uvicorn
    print("=" * 70)
    print("ShareZidi v3.0 - Fixed WebRTC Server")
    print("=" * 70)
    print("WebSocket will run on port 8003")
    print("Test Page: http://localhost:8003/test")
    print("Stats: http://localhost:8003/stats")
    print("=" * 70)
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8003,
        log_level="info",
        ws_ping_interval=20,
        ws_ping_timeout=10,
        timeout_keep_alive=75
    )

