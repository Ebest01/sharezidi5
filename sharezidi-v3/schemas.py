"""
ShareZidi v3.0 - Pydantic Schemas
Data validation and serialization schemas
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class TransferStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class DeviceType(str, Enum):
    MOBILE = "mobile"
    DESKTOP = "desktop"
    TABLET = "tablet"

# User schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# File transfer schemas
class FileInfo(BaseModel):
    name: str
    size: int
    type: str
    hash: Optional[str] = None
    total_chunks: int

class FileChunkData(BaseModel):
    transfer_id: str
    chunk_index: int
    chunk_data: str  # Base64 encoded
    chunk_size: int
    total_chunks: int

class FileTransferCreate(BaseModel):
    receiver_id: str
    file_info: FileInfo

class FileTransferResponse(BaseModel):
    id: str
    sender_id: str
    receiver_id: str
    file_name: str
    file_size: int
    file_type: str
    status: TransferStatus
    progress: float
    total_chunks: int
    chunks_received: int
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True

# WebSocket message schemas
class WebSocketMessage(BaseModel):
    type: str
    data: Optional[Dict[str, Any]] = None

class PingMessage(WebSocketMessage):
    type: str = "ping"
    timestamp: int

class PongMessage(WebSocketMessage):
    type: str = "pong"
    timestamp: int

class FileTransferStartMessage(WebSocketMessage):
    type: str = "file_transfer_start"
    file_info: FileInfo
    receiver_id: str

class FileChunkMessage(WebSocketMessage):
    type: str = "file_chunk"
    transfer_id: str
    chunk_data: str
    chunk_index: int
    total_chunks: int

class ChunkAckMessage(WebSocketMessage):
    type: str = "chunk_ack"
    transfer_id: str
    chunk_index: int
    received_progress: float

class ProgressUpdateMessage(WebSocketMessage):
    type: str = "progress_update"
    transfer_id: str
    progress: float
    chunk_index: int

class TransferCompleteMessage(WebSocketMessage):
    type: str = "transfer_complete"
    transfer_id: str

class ErrorMessage(WebSocketMessage):
    type: str = "error"
    message: str
    code: Optional[str] = None

# Device schemas
class DeviceInfo(BaseModel):
    device_name: str
    device_type: DeviceType
    device_id: str
    is_online: bool = False
    supports_webrtc: bool = False
    supports_p2p: bool = False
    max_chunk_size: int = 1024 * 1024

class DeviceResponse(DeviceInfo):
    id: str
    user_id: str
    last_seen: datetime
    
    class Config:
        from_attributes = True

# API response schemas
class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

class TransferStats(BaseModel):
    total_transfers: int
    completed_transfers: int
    failed_transfers: int
    total_data_transferred: int
    average_transfer_speed: float
