"""
ShareZidi v3.0 - Database Models
SQLAlchemy models for file transfers, users, and sessions
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)
    
    # Relationships
    transfers_sent = relationship("FileTransfer", foreign_keys="FileTransfer.sender_id", back_populates="sender")
    transfers_received = relationship("FileTransfer", foreign_keys="FileTransfer.receiver_id", back_populates="receiver")

class FileTransfer(Base):
    __tablename__ = "file_transfers"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    # File metadata (NOT the actual file data)
    file_name = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String)
    file_hash = Column(String)  # For integrity checking
    
    # Transfer status and progress
    status = Column(String, default="pending")  # pending, active, completed, failed
    progress = Column(Float, default=0.0)
    total_chunks = Column(Integer, default=0)
    chunks_received = Column(Integer, default=0)
    
    # P2P connection info
    sender_device_id = Column(String, nullable=False)
    receiver_device_id = Column(String, nullable=False)
    transfer_method = Column(String, default="websocket")  # websocket, webrtc, direct
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Error handling
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    
    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], back_populates="transfers_sent")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="transfers_received")

class TransferSession(Base):
    __tablename__ = "transfer_sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    session_token = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    last_activity = Column(DateTime, default=datetime.utcnow)
    
    # Session metadata
    ip_address = Column(String)
    user_agent = Column(String)
    device_info = Column(String)

class Device(Base):
    __tablename__ = "devices"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    device_name = Column(String, nullable=False)
    device_type = Column(String)  # mobile, desktop, tablet
    device_id = Column(String, unique=True, index=True, nullable=False)
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime, default=datetime.utcnow)
    
    # Device capabilities for P2P transfer
    supports_webrtc = Column(Boolean, default=False)
    supports_p2p = Column(Boolean, default=False)
    max_chunk_size = Column(Integer, default=1024 * 1024)  # 1MB default
    
    # Network info for P2P connection
    ip_address = Column(String)
    port = Column(Integer)
    local_network = Column(String)  # For LAN discovery
    
    # Relationships
    user = relationship("User")
