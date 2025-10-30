"""
ShareZidi v3.0 - Real WebRTC P2P File Transfer
Using aiortc for true peer-to-peer connections
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional, Callable
from datetime import datetime

try:
    from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
    from aiortc.contrib.signaling import object_to_string, object_from_string
    WEBRTC_AVAILABLE = True
except ImportError:
    WEBRTC_AVAILABLE = False
    logging.warning("aiortc not available - WebRTC features disabled")

logger = logging.getLogger(__name__)

class WebRTCTransferHandler:
    """
    Real WebRTC implementation using aiortc
    Handles P2P file transfers with data channels
    """
    
    def __init__(self, on_data_channel_message: Callable, on_connection_state_change: Callable):
        if not WEBRTC_AVAILABLE:
            raise ImportError("aiortc is required for WebRTC functionality")
            
        self.pcs: Dict[str, RTCPeerConnection] = {}
        self.data_channels: Dict[str, Any] = {}
        self.on_data_channel_message = on_data_channel_message
        self.on_connection_state_change = on_connection_state_change
        
        # STUN servers for NAT traversal
        self.ice_servers = [
            RTCIceServer("stun:stun.l.google.com:19302"),
            RTCIceServer("stun:stun1.l.google.com:19302"),
            RTCIceServer("stun:stun2.l.google.com:19302"),
        ]
        
        logger.info("WebRTC Transfer Handler initialized with aiortc")
    
    async def create_peer_connection(self, transfer_id: str, is_initiator: bool) -> RTCPeerConnection:
        """Create a new RTCPeerConnection for file transfer"""
        config = RTCConfiguration(iceServers=self.ice_servers)
        pc = RTCPeerConnection(config)
        self.pcs[transfer_id] = pc
        
        # Connection state change handler
        @pc.on("connectionstatechange")
        async def on_connection_state_change():
            state = pc.connectionState
            logger.info(f"WebRTC connection state for {transfer_id}: {state}")
            await self.on_connection_state_change(transfer_id, state)
            
            if state == "failed":
                logger.error(f"WebRTC connection failed for {transfer_id}")
                # Implement retry logic here
            elif state == "connected":
                logger.info(f"WebRTC connection established for {transfer_id}")
        
        # ICE candidate handler
        @pc.on("icecandidate")
        async def on_ice_candidate(candidate):
            if candidate:
                logger.debug(f"ICE candidate for {transfer_id}: {candidate.sdpMid} {candidate.sdpMLineIndex}")
                # This will be handled by the signaling server
        
        if is_initiator:
            # Create data channel for sending files
            channel = pc.createDataChannel("file-transfer", ordered=True)
            self.data_channels[transfer_id] = channel
            logger.info(f"Created data channel for {transfer_id} (initiator)")
            self._setup_data_channel_events(transfer_id, channel)
        else:
            # Listen for data channel from initiator
            @pc.on("datachannel")
            def on_datachannel(channel):
                logger.info(f"Received data channel for {transfer_id}: {channel.label}")
                self.data_channels[transfer_id] = channel
                self._setup_data_channel_events(transfer_id, channel)
        
        return pc
    
    def _setup_data_channel_events(self, transfer_id: str, channel: Any):
        """Setup data channel event handlers"""
        @channel.on("open")
        def on_open():
            logger.info(f"Data channel for {transfer_id} is open!")
            # Ready to send/receive file data
        
        @channel.on("message")
        async def on_message(message):
            # Handle incoming file chunks
            await self.on_data_channel_message(transfer_id, message)
        
        @channel.on("close")
        def on_close():
            logger.info(f"Data channel for {transfer_id} closed")
        
        @channel.on("error")
        def on_error(error):
            logger.error(f"Data channel error for {transfer_id}: {error}")
    
    async def create_offer(self, transfer_id: str) -> Dict:
        """Create a WebRTC offer"""
        pc = self.pcs.get(transfer_id)
        if not pc:
            raise ValueError(f"No peer connection for transfer_id: {transfer_id}")
        
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        
        # Convert to dict for JSON serialization
        offer_dict = {
            "sdp": pc.localDescription.sdp,
            "type": pc.localDescription.type
        }
        
        logger.info(f"Created WebRTC offer for {transfer_id}")
        return offer_dict
    
    async def handle_offer(self, transfer_id: str, offer_dict: Dict) -> Dict:
        """Handle a received WebRTC offer and create an answer"""
        pc = self.pcs.get(transfer_id)
        if not pc:
            pc = await self.create_peer_connection(transfer_id, is_initiator=False)
        
        # Convert dict back to RTCSessionDescription
        offer = RTCSessionDescription(sdp=offer_dict["sdp"], type=offer_dict["type"])
        await pc.setRemoteDescription(offer)
        
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        
        # Convert to dict for JSON serialization
        answer_dict = {
            "sdp": pc.localDescription.sdp,
            "type": pc.localDescription.type
        }
        
        logger.info(f"Created WebRTC answer for {transfer_id}")
        return answer_dict
    
    async def handle_answer(self, transfer_id: str, answer_dict: Dict):
        """Handle a received WebRTC answer"""
        pc = self.pcs.get(transfer_id)
        if not pc:
            raise ValueError(f"No peer connection for transfer_id: {transfer_id}")
        
        # Convert dict back to RTCSessionDescription
        answer = RTCSessionDescription(sdp=answer_dict["sdp"], type=answer_dict["type"])
        await pc.setRemoteDescription(answer)
        
        logger.info(f"Handled WebRTC answer for {transfer_id}")
    
    async def add_ice_candidate(self, transfer_id: str, candidate_dict: Dict):
        """Add a received ICE candidate to the peer connection"""
        pc = self.pcs.get(transfer_id)
        if not pc:
            logger.warning(f"No peer connection for transfer_id {transfer_id}")
            return
        
        try:
            # Convert dict to RTCIceCandidate
            candidate = RTCIceCandidate(
                candidate=candidate_dict["candidate"],
                sdpMid=candidate_dict["sdpMid"],
                sdpMLineIndex=candidate_dict["sdpMLineIndex"]
            )
            await pc.addIceCandidate(candidate)
            logger.debug(f"Added ICE candidate for {transfer_id}")
        except Exception as e:
            logger.error(f"Error adding ICE candidate for {transfer_id}: {e}")
    
    async def send_data_via_webrtc(self, transfer_id: str, data: bytes) -> bool:
        """Send data over the WebRTC data channel"""
        channel = self.data_channels.get(transfer_id)
        if channel and channel.readyState == "open":
            try:
                channel.send(data)
                return True
            except Exception as e:
                logger.error(f"Error sending data via WebRTC for {transfer_id}: {e}")
                return False
        else:
            logger.warning(f"WebRTC data channel for {transfer_id} not open")
            return False
    
    async def send_file_chunk(self, transfer_id: str, chunk_data: bytes, chunk_index: int, total_chunks: int):
        """Send a file chunk via WebRTC data channel"""
        # Create chunk message
        chunk_message = {
            "type": "file_chunk",
            "chunk_index": chunk_index,
            "total_chunks": total_chunks,
            "data": chunk_data.hex(),  # Convert bytes to hex string for JSON
            "timestamp": datetime.now().isoformat()
        }
        
        # Send as JSON string
        message_json = json.dumps(chunk_message)
        success = await self.send_data_via_webrtc(transfer_id, message_json.encode())
        
        if success:
            logger.debug(f"Sent chunk {chunk_index}/{total_chunks} for {transfer_id}")
        else:
            logger.error(f"Failed to send chunk {chunk_index} for {transfer_id}")
        
        return success
    
    async def close_peer_connection(self, transfer_id: str):
        """Close the RTCPeerConnection"""
        pc = self.pcs.pop(transfer_id, None)
        if pc:
            await pc.close()
            logger.info(f"Closed WebRTC peer connection for {transfer_id}")
        
        self.data_channels.pop(transfer_id, None)
    
    async def get_connection_state(self, transfer_id: str) -> Optional[str]:
        """Get the current connection state"""
        pc = self.pcs.get(transfer_id)
        if pc:
            return pc.connectionState
        return None
    
    async def get_data_channel_state(self, transfer_id: str) -> Optional[str]:
        """Get the current data channel state"""
        channel = self.data_channels.get(transfer_id)
        if channel:
            return channel.readyState
        return None

class WebRTCFileTransfer:
    """
    High-level WebRTC file transfer manager
    Handles file chunking, progress tracking, and optimization
    """
    
    def __init__(self, webrtc_handler: WebRTCTransferHandler):
        self.webrtc_handler = webrtc_handler
        self.active_transfers: Dict[str, Dict] = {}
        self.chunk_size = 64 * 1024  # 64KB default chunk size
        
    async def start_file_transfer(self, transfer_id: str, file_info: Dict, sender_id: str, receiver_id: str):
        """Start a WebRTC file transfer"""
        self.active_transfers[transfer_id] = {
            "file_info": file_info,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "status": "initiating",
            "progress": 0.0,
            "chunks_sent": 0,
            "chunks_received": 0,
            "total_chunks": file_info.get("total_chunks", 0),
            "started_at": datetime.now().isoformat()
        }
        
        logger.info(f"Started WebRTC file transfer: {transfer_id}")
        return transfer_id
    
    async def send_file_chunks(self, transfer_id: str, file_data: bytes):
        """Send file data in chunks via WebRTC"""
        if transfer_id not in self.active_transfers:
            logger.error(f"Unknown transfer ID: {transfer_id}")
            return False
        
        transfer = self.active_transfers[transfer_id]
        total_chunks = transfer["total_chunks"]
        
        for i in range(total_chunks):
            start = i * self.chunk_size
            end = min(start + self.chunk_size, len(file_data))
            chunk_data = file_data[start:end]
            
            success = await self.webrtc_handler.send_file_chunk(
                transfer_id, chunk_data, i, total_chunks
            )
            
            if not success:
                logger.error(f"Failed to send chunk {i} for {transfer_id}")
                return False
            
            # Update progress
            progress = ((i + 1) / total_chunks) * 100
            transfer["progress"] = progress
            transfer["chunks_sent"] = i + 1
            
            logger.debug(f"Sent chunk {i+1}/{total_chunks} for {transfer_id} ({progress:.1f}%)")
        
        logger.info(f"Completed sending file for {transfer_id}")
        return True
    
    async def handle_received_chunk(self, transfer_id: str, chunk_message: Dict):
        """Handle a received file chunk"""
        if transfer_id not in self.active_transfers:
            logger.error(f"Unknown transfer ID: {transfer_id}")
            return
        
        transfer = self.active_transfers[transfer_id]
        chunk_index = chunk_message["chunk_index"]
        total_chunks = chunk_message["total_chunks"]
        chunk_data = bytes.fromhex(chunk_message["data"])
        
        # Update progress
        progress = ((chunk_index + 1) / total_chunks) * 100
        transfer["progress"] = progress
        transfer["chunks_received"] = chunk_index + 1
        
        logger.debug(f"Received chunk {chunk_index + 1}/{total_chunks} for {transfer_id} ({progress:.1f}%)")
        
        # Here you would typically save the chunk to a file
        # For now, we'll just log it
        logger.info(f"Received {len(chunk_data)} bytes for chunk {chunk_index}")

# Global WebRTC handler instance
if WEBRTC_AVAILABLE:
    webrtc_handler = WebRTCTransferHandler(
        on_data_channel_message=lambda tid, msg: logger.info(f"WebRTC data for {tid}: {msg}"),
        on_connection_state_change=lambda tid, state: logger.info(f"WebRTC state for {tid}: {state}")
    )
    webrtc_file_transfer = WebRTCFileTransfer(webrtc_handler)
else:
    webrtc_handler = None
    webrtc_file_transfer = None
    logger.warning("WebRTC functionality disabled - aiortc not available")




