"""
ShareZidi v3.0 - True P2P File Transfer
WebRTC-based direct device-to-device streaming
"""

import asyncio
import json
import base64
from typing import Dict, Optional, Callable
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)

class TransferMethod(str, Enum):
    WEBSOCKET = "websocket"  # Through server (current)
    WEBRTC = "webrtc"        # Direct P2P
    DIRECT = "direct"        # Direct TCP/UDP

@dataclass
class TransferConfig:
    method: TransferMethod = TransferMethod.WEBRTC
    chunk_size: int = 64 * 1024  # 64KB chunks
    max_retries: int = 3
    timeout: int = 30
    enable_encryption: bool = True

class P2PTransferManager:
    """Manages P2P file transfers with multiple connection methods"""
    
    def __init__(self):
        self.active_transfers: Dict[str, Dict] = {}
        self.webrtc_connections: Dict[str, any] = {}
        self.direct_connections: Dict[str, any] = {}
    
    async def initiate_transfer(
        self, 
        transfer_id: str,
        sender_device: str,
        receiver_device: str,
        file_info: Dict,
        config: TransferConfig
    ) -> bool:
        """Initiate P2P transfer with best available method"""
        
        # Try WebRTC first (best for P2P)
        if config.method == TransferMethod.WEBRTC:
            return await self._setup_webrtc_transfer(
                transfer_id, sender_device, receiver_device, file_info, config
            )
        
        # Fallback to WebSocket through server
        elif config.method == TransferMethod.WEBSOCKET:
            return await self._setup_websocket_transfer(
                transfer_id, sender_device, receiver_device, file_info, config
            )
        
        # Direct connection (TCP/UDP)
        elif config.method == TransferMethod.DIRECT:
            return await self._setup_direct_transfer(
                transfer_id, sender_device, receiver_device, file_info, config
            )
        
        return False
    
    async def _setup_webrtc_transfer(
        self, transfer_id: str, sender: str, receiver: str, 
        file_info: Dict, config: TransferConfig
    ) -> bool:
        """Setup WebRTC P2P connection for direct streaming"""
        try:
            # Create WebRTC peer connection
            # This would integrate with a WebRTC library like aiortc
            logger.info(f"Setting up WebRTC P2P transfer {transfer_id}")
            
            # WebRTC setup would go here:
            # 1. Create peer connection
            # 2. Exchange ICE candidates
            # 3. Establish data channel
            # 4. Start streaming chunks directly
            
            self.active_transfers[transfer_id] = {
                "method": "webrtc",
                "sender": sender,
                "receiver": receiver,
                "file_info": file_info,
                "status": "connecting",
                "progress": 0
            }
            
            return True
            
        except Exception as e:
            logger.error(f"WebRTC setup failed: {e}")
            return False
    
    async def _setup_websocket_transfer(
        self, transfer_id: str, sender: str, receiver: str,
        file_info: Dict, config: TransferConfig
    ) -> bool:
        """Setup WebSocket transfer through server (fallback)"""
        logger.info(f"Setting up WebSocket transfer {transfer_id}")
        
        self.active_transfers[transfer_id] = {
            "method": "websocket",
            "sender": sender,
            "receiver": receiver,
            "file_info": file_info,
            "status": "active",
            "progress": 0
        }
        
        return True
    
    async def _setup_direct_transfer(
        self, transfer_id: str, sender: str, receiver: str,
        file_info: Dict, config: TransferConfig
    ) -> bool:
        """Setup direct TCP/UDP connection"""
        logger.info(f"Setting up direct transfer {transfer_id}")
        
        # Direct connection setup would go here:
        # 1. Get receiver's IP address
        # 2. Establish direct TCP connection
        # 3. Start streaming chunks
        
        self.active_transfers[transfer_id] = {
            "method": "direct",
            "sender": sender,
            "receiver": receiver,
            "file_info": file_info,
            "status": "connecting",
            "progress": 0
        }
        
        return True
    
    async def stream_chunk(
        self, 
        transfer_id: str, 
        chunk_data: bytes, 
        chunk_index: int,
        progress_callback: Optional[Callable] = None
    ) -> bool:
        """Stream a chunk through the active transfer"""
        
        if transfer_id not in self.active_transfers:
            return False
        
        transfer = self.active_transfers[transfer_id]
        method = transfer["method"]
        
        try:
            if method == "webrtc":
                # Stream directly via WebRTC data channel
                await self._stream_webrtc_chunk(transfer_id, chunk_data, chunk_index)
            
            elif method == "websocket":
                # Forward through server WebSocket
                await self._stream_websocket_chunk(transfer_id, chunk_data, chunk_index)
            
            elif method == "direct":
                # Stream via direct TCP connection
                await self._stream_direct_chunk(transfer_id, chunk_data, chunk_index)
            
            # Update progress
            if progress_callback:
                progress = (chunk_index + 1) / transfer["file_info"]["total_chunks"] * 100
                await progress_callback(transfer_id, progress)
            
            return True
            
        except Exception as e:
            logger.error(f"Chunk streaming failed: {e}")
            return False
    
    async def _stream_webrtc_chunk(self, transfer_id: str, chunk_data: bytes, chunk_index: int):
        """Stream chunk via WebRTC (direct P2P)"""
        # WebRTC data channel streaming
        # This would send chunk directly to receiver device
        logger.debug(f"WebRTC streaming chunk {chunk_index} for {transfer_id}")
    
    async def _stream_websocket_chunk(self, transfer_id: str, chunk_data: bytes, chunk_index: int):
        """Stream chunk via WebSocket (through server)"""
        # Forward chunk through server WebSocket
        logger.debug(f"WebSocket streaming chunk {chunk_index} for {transfer_id}")
    
    async def _stream_direct_chunk(self, transfer_id: str, chunk_data: bytes, chunk_index: int):
        """Stream chunk via direct connection"""
        # Direct TCP streaming
        logger.debug(f"Direct streaming chunk {chunk_index} for {transfer_id}")
    
    async def complete_transfer(self, transfer_id: str) -> bool:
        """Complete the transfer and cleanup"""
        if transfer_id in self.active_transfers:
            self.active_transfers[transfer_id]["status"] = "completed"
            self.active_transfers[transfer_id]["progress"] = 100
            
            # Cleanup connections
            method = self.active_transfers[transfer_id]["method"]
            if method == "webrtc" and transfer_id in self.webrtc_connections:
                del self.webrtc_connections[transfer_id]
            elif method == "direct" and transfer_id in self.direct_connections:
                del self.direct_connections[transfer_id]
            
            logger.info(f"Transfer {transfer_id} completed")
            return True
        
        return False

# Global P2P manager
p2p_manager = P2PTransferManager()

async def get_best_transfer_method(sender_device: str, receiver_device: str) -> TransferMethod:
    """Determine the best transfer method based on device capabilities"""
    
    # Check device capabilities (would query database)
    # For now, return WebRTC as preferred method
    return TransferMethod.WEBRTC

async def initiate_p2p_transfer(
    transfer_id: str,
    sender_device: str,
    receiver_device: str,
    file_info: Dict
) -> bool:
    """Initiate P2P transfer with optimal method"""
    
    # Determine best method
    method = await get_best_transfer_method(sender_device, receiver_device)
    
    # Create transfer config
    config = TransferConfig(
        method=method,
        chunk_size=64 * 1024,  # 64KB chunks for smooth streaming
        max_retries=3,
        timeout=30,
        enable_encryption=True
    )
    
    # Initiate transfer
    return await p2p_manager.initiate_transfer(
        transfer_id, sender_device, receiver_device, file_info, config
    )
