"""
ShareZidi v3.0 - WebRTC Manager for P2P File Transfer
Handles WebRTC signaling and connection management
"""

import json
import logging
import asyncio
from typing import Dict, Any, Optional, Callable
from datetime import datetime

logger = logging.getLogger(__name__)

class WebRTCManager:
    """
    Manages WebRTC connections for P2P file transfer
    Handles signaling, ICE candidates, and connection state
    """
    
    def __init__(self):
        self.active_connections: Dict[str, Dict] = {}
        self.pending_offers: Dict[str, Dict] = {}
        self.pending_answers: Dict[str, Dict] = {}
        self.ice_candidates: Dict[str, list] = {}
        
    async def initiate_connection(self, sender_id: str, receiver_id: str, file_info: Dict) -> str:
        """
        Initiate WebRTC connection between sender and receiver
        Returns connection ID for tracking
        """
        connection_id = f"webrtc_{sender_id}_{receiver_id}_{datetime.now().timestamp()}"
        
        self.active_connections[connection_id] = {
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "file_info": file_info,
            "status": "initiating",
            "created_at": datetime.now().isoformat(),
            "ice_candidates": [],
            "offer": None,
            "answer": None
        }
        
        logger.info(f"WebRTC connection initiated: {connection_id}")
        return connection_id
    
    async def handle_offer(self, connection_id: str, offer: Dict, client_id: str):
        """Handle WebRTC offer from sender"""
        if connection_id not in self.active_connections:
            logger.warning(f"Unknown connection ID: {connection_id}")
            return False
            
        connection = self.active_connections[connection_id]
        
        if connection["sender_id"] != client_id:
            logger.warning(f"Offer from wrong sender for connection: {connection_id}")
            return False
            
        connection["offer"] = offer
        connection["status"] = "offer_received"
        
        logger.info(f"WebRTC offer received for connection: {connection_id}")
        return True
    
    async def handle_answer(self, connection_id: str, answer: Dict, client_id: str):
        """Handle WebRTC answer from receiver"""
        if connection_id not in self.active_connections:
            logger.warning(f"Unknown connection ID: {connection_id}")
            return False
            
        connection = self.active_connections[connection_id]
        
        if connection["receiver_id"] != client_id:
            logger.warning(f"Answer from wrong receiver for connection: {connection_id}")
            return False
            
        connection["answer"] = answer
        connection["status"] = "answer_received"
        
        logger.info(f"WebRTC answer received for connection: {connection_id}")
        return True
    
    async def handle_ice_candidate(self, connection_id: str, candidate: Dict, client_id: str):
        """Handle ICE candidate from either peer"""
        if connection_id not in self.active_connections:
            logger.warning(f"Unknown connection ID: {connection_id}")
            return False
            
        connection = self.active_connections[connection_id]
        
        if client_id not in [connection["sender_id"], connection["receiver_id"]]:
            logger.warning(f"ICE candidate from unknown client: {client_id}")
            return False
            
        connection["ice_candidates"].append({
            "candidate": candidate,
            "from_client": client_id,
            "timestamp": datetime.now().isoformat()
        })
        
        logger.info(f"ICE candidate received for connection: {connection_id} from {client_id}")
        return True
    
    async def get_connection_info(self, connection_id: str) -> Optional[Dict]:
        """Get connection information"""
        return self.active_connections.get(connection_id)
    
    async def update_connection_status(self, connection_id: str, status: str):
        """Update connection status"""
        if connection_id in self.active_connections:
            self.active_connections[connection_id]["status"] = status
            logger.info(f"Connection {connection_id} status updated to: {status}")
    
    async def cleanup_connection(self, connection_id: str):
        """Clean up connection resources"""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
            logger.info(f"Connection {connection_id} cleaned up")
    
    async def get_connections_for_client(self, client_id: str) -> list:
        """Get all connections for a specific client"""
        connections = []
        for conn_id, conn_info in self.active_connections.items():
            if client_id in [conn_info["sender_id"], conn_info["receiver_id"]]:
                connections.append({
                    "connection_id": conn_id,
                    "status": conn_info["status"],
                    "file_info": conn_info["file_info"],
                    "created_at": conn_info["created_at"]
                })
        return connections

class P2PTransferManager:
    """
    Manages P2P file transfers with WebRTC support
    Handles file chunking, progress tracking, and transfer optimization
    """
    
    def __init__(self, webrtc_manager: WebRTCManager):
        self.webrtc_manager = webrtc_manager
        self.active_transfers: Dict[str, Dict] = {}
        self.transfer_stats: Dict[str, Dict] = {}
        
    async def start_transfer(self, sender_id: str, receiver_id: str, file_info: Dict) -> str:
        """Start a new P2P file transfer"""
        transfer_id = f"transfer_{sender_id}_{receiver_id}_{datetime.now().timestamp()}"
        
        # Create WebRTC connection
        connection_id = await self.webrtc_manager.initiate_connection(
            sender_id, receiver_id, file_info
        )
        
        # Create transfer record
        self.active_transfers[transfer_id] = {
            "transfer_id": transfer_id,
            "connection_id": connection_id,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "file_info": file_info,
            "status": "pending",
            "progress": 0.0,
            "chunks_sent": 0,
            "chunks_received": 0,
            "total_chunks": file_info.get("total_chunks", 0),
            "started_at": datetime.now().isoformat(),
            "transfer_speed": 0,
            "estimated_time": 0
        }
        
        # Initialize transfer stats
        self.transfer_stats[transfer_id] = {
            "bytes_transferred": 0,
            "chunks_acknowledged": 0,
            "retry_count": 0,
            "network_quality": "unknown",
            "optimal_chunk_size": 64 * 1024,  # 64KB default
            "concurrent_streams": 1
        }
        
        logger.info(f"P2P transfer started: {transfer_id}")
        return transfer_id
    
    async def update_transfer_progress(self, transfer_id: str, progress: float, 
                                     chunks_sent: int = None, chunks_received: int = None):
        """Update transfer progress"""
        if transfer_id in self.active_transfers:
            self.active_transfers[transfer_id]["progress"] = progress
            
            if chunks_sent is not None:
                self.active_transfers[transfer_id]["chunks_sent"] = chunks_sent
            if chunks_received is not None:
                self.active_transfers[transfer_id]["chunks_received"] = chunks_received
                
            logger.info(f"Transfer {transfer_id} progress: {progress}%")
    
    async def complete_transfer(self, transfer_id: str):
        """Mark transfer as completed"""
        if transfer_id in self.active_transfers:
            self.active_transfers[transfer_id]["status"] = "completed"
            self.active_transfers[transfer_id]["progress"] = 100.0
            self.active_transfers[transfer_id]["completed_at"] = datetime.now().isoformat()
            
            logger.info(f"Transfer {transfer_id} completed")
    
    async def get_transfer_info(self, transfer_id: str) -> Optional[Dict]:
        """Get transfer information"""
        return self.active_transfers.get(transfer_id)
    
    async def get_transfers_for_client(self, client_id: str) -> list:
        """Get all transfers for a specific client"""
        transfers = []
        for transfer_id, transfer_info in self.active_transfers.items():
            if client_id in [transfer_info["sender_id"], transfer_info["receiver_id"]]:
                transfers.append(transfer_info)
        return transfers
    
    async def optimize_transfer(self, transfer_id: str, network_conditions: Dict):
        """Optimize transfer based on network conditions"""
        if transfer_id not in self.transfer_stats:
            return
            
        stats = self.transfer_stats[transfer_id]
        
        # Adjust chunk size based on network quality
        if network_conditions.get("latency", 0) < 50:  # Low latency
            stats["optimal_chunk_size"] = min(1024 * 1024, stats["optimal_chunk_size"] * 2)  # Up to 1MB
            stats["concurrent_streams"] = min(4, stats["concurrent_streams"] + 1)
        elif network_conditions.get("latency", 0) > 200:  # High latency
            stats["optimal_chunk_size"] = max(16 * 1024, stats["optimal_chunk_size"] // 2)  # Down to 16KB
            stats["concurrent_streams"] = max(1, stats["concurrent_streams"] - 1)
        
        logger.info(f"Transfer {transfer_id} optimized: chunk_size={stats['optimal_chunk_size']}, streams={stats['concurrent_streams']}")

# Global instances
webrtc_manager = WebRTCManager()
p2p_transfer_manager = P2PTransferManager(webrtc_manager)

