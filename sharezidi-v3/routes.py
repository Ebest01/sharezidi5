"""
ShareZidi v3.0 - API Routes
REST API endpoints for file transfer operations
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from database import get_db
from models import User, FileTransfer, Device, TransferSession
from schemas import (
    UserCreate, UserLogin, UserResponse, 
    FileTransferCreate, FileTransferResponse,
    DeviceInfo, DeviceResponse, APIResponse,
    TransferStats
)
from auth import get_current_user, get_password_hash, verify_password, create_access_token

router = APIRouter()

# Authentication routes
@router.post("/auth/register", response_model=APIResponse)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.email == user_data.email) | (User.username == user_data.username)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or username already exists"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return APIResponse(
        success=True,
        message="User registered successfully",
        data={"user_id": user.id}
    )

@router.post("/auth/login", response_model=APIResponse)
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """Login user and return access token"""
    # Find user
    user = db.query(User).filter(User.email == login_data.email).first()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Create access token
    access_token = create_access_token(
        data={"sub": user.id, "email": user.email}
    )
    
    return APIResponse(
        success=True,
        message="Login successful",
        data={
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username
            }
        }
    )

@router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get current user information"""
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user

# Device management routes
@router.post("/devices", response_model=DeviceResponse)
async def register_device(
    device_info: DeviceInfo,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Register a new device"""
    # Check if device already exists
    existing_device = db.query(Device).filter(Device.device_id == device_info.device_id).first()
    
    if existing_device:
        # Update existing device
        existing_device.device_name = device_info.device_name
        existing_device.device_type = device_info.device_type
        existing_device.is_online = True
        existing_device.last_seen = datetime.utcnow()
        existing_device.supports_webrtc = device_info.supports_webrtc
        existing_device.supports_p2p = device_info.supports_p2p
        existing_device.max_chunk_size = device_info.max_chunk_size
        
        db.commit()
        db.refresh(existing_device)
        return existing_device
    
    # Create new device
    device = Device(
        user_id=current_user["user_id"],
        device_name=device_info.device_name,
        device_type=device_info.device_type,
        device_id=device_info.device_id,
        is_online=True,
        supports_webrtc=device_info.supports_webrtc,
        supports_p2p=device_info.supports_p2p,
        max_chunk_size=device_info.max_chunk_size
    )
    
    db.add(device)
    db.commit()
    db.refresh(device)
    
    return device

@router.get("/devices", response_model=List[DeviceResponse])
async def get_user_devices(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all devices for current user"""
    devices = db.query(Device).filter(Device.user_id == current_user["user_id"]).all()
    return devices

@router.get("/devices/online", response_model=List[DeviceResponse])
async def get_online_devices(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get online devices for current user"""
    devices = db.query(Device).filter(
        Device.user_id == current_user["user_id"],
        Device.is_online == True
    ).all()
    return devices

# File transfer routes
@router.post("/transfers", response_model=FileTransferResponse)
async def create_transfer(
    transfer_data: FileTransferCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new file transfer"""
    # Verify receiver exists
    receiver = db.query(User).filter(User.id == transfer_data.receiver_id).first()
    if not receiver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receiver not found"
        )
    
    # Create transfer record
    transfer = FileTransfer(
        sender_id=current_user["user_id"],
        receiver_id=transfer_data.receiver_id,
        file_name=transfer_data.file_info.name,
        file_size=transfer_data.file_info.size,
        file_type=transfer_data.file_info.type,
        file_hash=transfer_data.file_info.hash,
        total_chunks=transfer_data.file_info.total_chunks,
        status="pending"
    )
    
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    
    return transfer

@router.get("/transfers", response_model=List[FileTransferResponse])
async def get_user_transfers(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """Get transfers for current user"""
    transfers = db.query(FileTransfer).filter(
        (FileTransfer.sender_id == current_user["user_id"]) |
        (FileTransfer.receiver_id == current_user["user_id"])
    ).offset(offset).limit(limit).all()
    
    return transfers

@router.get("/transfers/{transfer_id}", response_model=FileTransferResponse)
async def get_transfer(
    transfer_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific transfer details"""
    transfer = db.query(FileTransfer).filter(FileTransfer.id == transfer_id).first()
    
    if not transfer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transfer not found"
        )
    
    # Check if user is sender or receiver
    if transfer.sender_id != current_user["user_id"] and transfer.receiver_id != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return transfer

@router.get("/stats", response_model=TransferStats)
async def get_transfer_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transfer statistics for current user"""
    # Get all transfers for user
    transfers = db.query(FileTransfer).filter(
        (FileTransfer.sender_id == current_user["user_id"]) |
        (FileTransfer.receiver_id == current_user["user_id"])
    ).all()
    
    total_transfers = len(transfers)
    completed_transfers = len([t for t in transfers if t.status == "completed"])
    failed_transfers = len([t for t in transfers if t.status == "failed"])
    total_data_transferred = sum(t.file_size for t in transfers if t.status == "completed")
    
    # Calculate average transfer speed (simplified)
    average_speed = 0.0
    if completed_transfers > 0:
        # This would need more sophisticated calculation in a real implementation
        average_speed = total_data_transferred / completed_transfers
    
    return TransferStats(
        total_transfers=total_transfers,
        completed_transfers=completed_transfers,
        failed_transfers=failed_transfers,
        total_data_transferred=total_data_transferred,
        average_transfer_speed=average_speed
    )
