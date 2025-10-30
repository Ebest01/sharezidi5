"""
ShareZidi v3.0 - Advanced WebRTC P2P File Transfer
Ultimate streaming with aiortc, progress tracking, and seamless UX
"""

import asyncio
import json
import base64
import hashlib
import logging
from typing import Dict, Optional, Callable, Any
from dataclasses import dataclass
from enum import Enum
import time
import os

# WebRTC imports
try:
    from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate
    from aiortc.contrib.signaling import TcpSocketSignaling
    from aiortc.rtcrtpsender import RTCRtpSender
    from aiortc.mediastreams import MediaStreamTrack
    WEBRTC_AVAILABLE = True
except ImportError:
    WEBRTC_AVAILABLE = False
    logging.warning("aiortc not available. Install with: pip install aiortc")

logger = logging.getLogger(__name__)

class TransferState(str, Enum):
    INITIALIZING = "initializing"
    CONNECTING = "connecting"
    NEGOTIATING = "negotiating"
    CONNECTED = "connected"
    TRANSFERRING = "transferring"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class FileInfo:
    name: str
    size: int
    type: str
    hash: str
    total_chunks: int
    chunk_size: int = 64 * 1024  # 64KB default

@dataclass
class TransferProgress:
    transfer_id: str
    bytes_transferred: int
    total_bytes: int
    chunks_sent: int
    total_chunks: int
    speed: float  # bytes per second
    eta: float    # estimated time remaining
    percentage: float

class WebRTCDataChannel:
    """WebRTC Data Channel for P2P file transfer"""
    
    def __init__(self, peer_connection: RTCPeerConnection, channel_name: str = "fileTransfer"):
        self.pc = peer_connection
        self.channel_name = channel_name
        self.data_channel = None
        self.is_connected = False
        self.message_queue = asyncio.Queue()
        
    async def setup(self):
        """Setup data channel"""
        try:
            self.data_channel = self.pc.createDataChannel(
                self.channel_name,
                ordered=True,
                maxRetransmits=3
            )
            
            # Set up event handlers
            self.data_channel.on("open", self._on_open)
            self.data_channel.on("close", self._on_close)
            self.data_channel.on("message", self._on_message)
            self.data_channel.on("error", self._on_error)
            
            logger.info(f"Data channel '{self.channel_name}' created")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create data channel: {e}")
            return False
    
    def _on_open(self):
        """Data channel opened"""
        self.is_connected = True
        logger.info("Data channel opened")
    
    def _on_close(self):
        """Data channel closed"""
        self.is_connected = False
        logger.info("Data channel closed")
    
    def _on_message(self, message):
        """Handle incoming message"""
        try:
            if isinstance(message, str):
                data = json.loads(message)
                asyncio.create_task(self.message_queue.put(data))
            else:
                logger.warning("Received non-string message")
        except Exception as e:
            logger.error(f"Error handling message: {e}")
    
    def _on_error(self, error):
        """Handle data channel error"""
        logger.error(f"Data channel error: {error}")
        self.is_connected = False
    
    async def send_message(self, message: Dict[str, Any]) -> bool:
        """Send message through data channel"""
        if not self.is_connected or not self.data_channel:
            return False
        
        try:
            self.data_channel.send(json.dumps(message))
            return True
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            return False
    
    async def receive_message(self, timeout: float = 5.0) -> Optional[Dict[str, Any]]:
        """Receive message from data channel"""
        try:
            return await asyncio.wait_for(self.message_queue.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None

class WebRTCFileTransfer:
    """Advanced WebRTC P2P File Transfer with streaming"""
    
    def __init__(self, transfer_id: str, file_info: FileInfo):
        self.transfer_id = transfer_id
        self.file_info = file_info
        self.pc = None
        self.data_channel = None
        self.state = TransferState.INITIALIZING
        self.progress = TransferProgress(
            transfer_id=transfer_id,
            bytes_transferred=0,
            total_bytes=file_info.size,
            chunks_sent=0,
            total_chunks=file_info.total_chunks,
            speed=0.0,
            eta=0.0,
            percentage=0.0
        )
        self.start_time = None
        self.last_update_time = None
        self.progress_callbacks = []
        
    async def initialize(self) -> bool:
        """Initialize WebRTC connection"""
        if not WEBRTC_AVAILABLE:
            logger.error("WebRTC not available. Install aiortc.")
            return False
        
        try:
            self.pc = RTCPeerConnection()
            self.data_channel = WebRTCDataChannel(self.pc)
            
            # Configure connection
            await self._configure_connection()
            
            self.state = TransferState.CONNECTING
            logger.info(f"WebRTC transfer {self.transfer_id} initialized")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize WebRTC: {e}")
            self.state = TransferState.FAILED
            return False
    
    async def _configure_connection(self):
        """Configure WebRTC connection settings"""
        # Configure ICE servers
        self.pc.addIceServer("stun:stun.l.google.com:19302")
        self.pc.addIceServer("stun:stun1.l.google.com:19302")
        
        # Set up data channel
        await self.data_channel.setup()
        
        # Configure connection state handlers
        self.pc.on("connectionstatechange", self._on_connection_state_change)
        self.pc.on("iceconnectionstatechange", self._on_ice_connection_state_change)
    
    def _on_connection_state_change(self):
        """Handle connection state changes"""
        state = self.pc.connectionState
        logger.info(f"Connection state changed: {state}")
        
        if state == "connected":
            self.state = TransferState.CONNECTED
        elif state == "failed":
            self.state = TransferState.FAILED
    
    def _on_ice_connection_state_change(self):
        """Handle ICE connection state changes"""
        state = self.pc.iceConnectionState
        logger.info(f"ICE connection state changed: {state}")
    
    async def start_transfer(self, file_path: str) -> bool:
        """Start file transfer"""
        if not os.path.exists(file_path):
            logger.error(f"File not found: {file_path}")
            return False
        
        try:
            self.state = TransferState.TRANSFERRING
            self.start_time = time.time()
            self.last_update_time = self.start_time
            
            # Start streaming file chunks
            await self._stream_file(file_path)
            
            self.state = TransferState.COMPLETED
            logger.info(f"Transfer {self.transfer_id} completed")
            return True
            
        except Exception as e:
            logger.error(f"Transfer failed: {e}")
            self.state = TransferState.FAILED
            return False
    
    async def _stream_file(self, file_path: str):
        """Stream file in chunks with progress tracking"""
        chunk_size = self.file_info.chunk_size
        total_chunks = self.file_info.total_chunks
        
        with open(file_path, 'rb') as file:
            for chunk_index in range(total_chunks):
                # Read chunk
                chunk_data = file.read(chunk_size)
                if not chunk_data:
                    break
                
                # Create chunk message
                chunk_message = {
                    "type": "file_chunk",
                    "transfer_id": self.transfer_id,
                    "chunk_index": chunk_index,
                    "chunk_data": base64.b64encode(chunk_data).decode('utf-8'),
                    "chunk_size": len(chunk_data),
                    "total_chunks": total_chunks,
                    "is_last": chunk_index == total_chunks - 1
                }
                
                # Send chunk
                success = await self.data_channel.send_message(chunk_message)
                if not success:
                    logger.error(f"Failed to send chunk {chunk_index}")
                    break
                
                # Update progress
                await self._update_progress(chunk_index + 1, len(chunk_data))
                
                # Small delay to prevent overwhelming the connection
                await asyncio.sleep(0.001)
    
    async def _update_progress(self, chunks_sent: int, bytes_sent: int):
        """Update transfer progress"""
        current_time = time.time()
        
        # Update counters
        self.progress.chunks_sent = chunks_sent
        self.progress.bytes_transferred += bytes_sent
        self.progress.percentage = (self.progress.bytes_transferred / self.progress.total_bytes) * 100
        
        # Calculate speed
        if self.start_time:
            elapsed = current_time - self.start_time
            if elapsed > 0:
                self.progress.speed = self.progress.bytes_transferred / elapsed
                
                # Calculate ETA
                remaining_bytes = self.progress.total_bytes - self.progress.bytes_transferred
                if self.progress.speed > 0:
                    self.progress.eta = remaining_bytes / self.progress.speed
        
        # Notify progress callbacks
        for callback in self.progress_callbacks:
            try:
                await callback(self.progress)
            except Exception as e:
                logger.error(f"Progress callback error: {e}")
        
        self.last_update_time = current_time
    
    def add_progress_callback(self, callback: Callable[[TransferProgress], None]):
        """Add progress callback"""
        self.progress_callbacks.append(callback)
    
    async def receive_file(self, output_path: str) -> bool:
        """Receive file and save to output path"""
        try:
            self.state = TransferState.TRANSFERRING
            self.start_time = time.time()
            
            # Create output directory if needed
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Receive chunks
            received_chunks = {}
            with open(output_path, 'wb') as file:
                while True:
                    message = await self.data_channel.receive_message(timeout=30.0)
                    if not message:
                        break
                    
                    if message.get("type") == "file_chunk":
                        chunk_index = message["chunk_index"]
                        chunk_data = base64.b64decode(message["chunk_data"])
                        is_last = message.get("is_last", False)
                        
                        # Store chunk
                        received_chunks[chunk_index] = chunk_data
                        
                        # Update progress
                        await self._update_progress(
                            len(received_chunks), 
                            len(chunk_data)
                        )
                        
                        # Check if all chunks received
                        if is_last or len(received_chunks) == self.file_info.total_chunks:
                            break
            
            # Write chunks in order
            for i in range(len(received_chunks)):
                if i in received_chunks:
                    file.write(received_chunks[i])
            
            self.state = TransferState.COMPLETED
            logger.info(f"File received: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to receive file: {e}")
            self.state = TransferState.FAILED
            return False
    
    async def close(self):
        """Close WebRTC connection"""
        if self.pc:
            await self.pc.close()
        self.state = TransferState.CANCELLED

class WebRTCTransferManager:
    """Manager for WebRTC P2P transfers"""
    
    def __init__(self):
        self.active_transfers: Dict[str, WebRTCFileTransfer] = {}
        self.ice_servers = [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302"
        ]
    
    async def create_transfer(
        self, 
        transfer_id: str, 
        file_info: FileInfo,
        is_sender: bool = True
    ) -> WebRTCFileTransfer:
        """Create new WebRTC transfer"""
        transfer = WebRTCFileTransfer(transfer_id, file_info)
        await transfer.initialize()
        
        self.active_transfers[transfer_id] = transfer
        logger.info(f"Created WebRTC transfer {transfer_id}")
        
        return transfer
    
    async def get_transfer(self, transfer_id: str) -> Optional[WebRTCFileTransfer]:
        """Get active transfer"""
        return self.active_transfers.get(transfer_id)
    
    async def remove_transfer(self, transfer_id: str):
        """Remove transfer"""
        if transfer_id in self.active_transfers:
            transfer = self.active_transfers[transfer_id]
            await transfer.close()
            del self.active_transfers[transfer_id]
            logger.info(f"Removed transfer {transfer_id}")

# Global WebRTC manager
webrtc_manager = WebRTCTransferManager()

async def create_webrtc_transfer(
    transfer_id: str,
    file_path: str,
    is_sender: bool = True
) -> Optional[WebRTCFileTransfer]:
    """Create WebRTC transfer for file"""
    
    # Get file info
    file_size = os.path.getsize(file_path)
    file_name = os.path.basename(file_path)
    file_type = os.path.splitext(file_name)[1]
    
    # Calculate chunks
    chunk_size = 64 * 1024  # 64KB
    total_chunks = (file_size + chunk_size - 1) // chunk_size
    
    # Create file hash
    file_hash = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b""):
            file_hash.update(chunk)
    
    file_info = FileInfo(
        name=file_name,
        size=file_size,
        type=file_type,
        hash=file_hash.hexdigest(),
        total_chunks=total_chunks,
        chunk_size=chunk_size
    )
    
    # Create transfer
    return await webrtc_manager.create_transfer(transfer_id, file_info, is_sender)
