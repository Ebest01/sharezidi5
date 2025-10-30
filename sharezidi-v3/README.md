# ShareZidi v3.0 - Python FastAPI Backend

Revolutionary file transfer application built with Python FastAPI, WebSocket, and real-time progress tracking.

## Features

- **Real-time File Transfer**: WebSocket-based file transfer with chunk-based uploads
- **Progress Tracking**: Live progress updates for both sender and receiver
- **Authentication**: JWT-based secure authentication system
- **Device Management**: Multi-device support with online/offline status
- **Database Integration**: PostgreSQL with SQLAlchemy ORM
- **REST API**: Comprehensive REST API for all operations
- **WebSocket Communication**: Real-time bidirectional communication
- **File Integrity**: Chunk-based transfer with integrity checking
- **Error Handling**: Robust error handling and retry mechanisms

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  FastAPI Backend │    │   PostgreSQL    │
│                 │    │                 │    │   Database      │
│  - File Upload  │◄──►│  - WebSocket    │◄──►│  - Users        │
│  - Progress UI  │    │  - REST API     │    │  - Transfers    │
│  - Real-time    │    │  - Auth System  │    │  - Devices      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Environment Variables

```bash
export SECRET_KEY="your-secret-key-here"
export DATABASE_URL="postgresql://user:password@localhost/sharezidi_v3"
```

### 3. Initialize Database

```bash
python -c "from database import init_db; init_db()"
```

### 4. Run the Server

```bash
python main.py
```

The server will start on `http://localhost:8000`

## API Documentation

Once the server is running, visit:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## WebSocket Endpoints

- **Connection**: `ws://localhost:8000/ws/{client_id}`
- **File Transfer**: Real-time chunk-based file transfer
- **Progress Updates**: Live progress tracking
- **Error Handling**: Comprehensive error reporting

## Project Structure

```
sharezidi-v3/
├── main.py              # FastAPI application entry point
├── models.py            # SQLAlchemy database models
├── schemas.py           # Pydantic data validation schemas
├── routes.py            # REST API routes
├── auth.py              # Authentication system
├── database.py          # Database configuration
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

## Key Components

### 1. WebSocket Handler (`main.py`)
- Real-time file transfer communication
- Chunk-based file upload/download
- Progress tracking and updates
- Error handling and recovery

### 2. Database Models (`models.py`)
- User management
- File transfer tracking
- Device management
- Session management

### 3. Authentication (`auth.py`)
- JWT token-based authentication
- Password hashing with bcrypt
- Secure session management

### 4. API Routes (`routes.py`)
- User registration/login
- Device management
- File transfer operations
- Statistics and analytics

## WebSocket Message Types

### Client → Server
- `ping`: Keep-alive ping
- `file_transfer_start`: Initiate file transfer
- `file_chunk`: Send file chunk data
- `chunk_ack`: Acknowledge chunk receipt
- `transfer_complete`: Mark transfer as complete

### Server → Client
- `pong`: Ping response
- `incoming_transfer`: New incoming transfer
- `file_chunk`: Receive file chunk
- `progress_update`: Progress update
- `transfer_completed`: Transfer completion
- `error`: Error message

## Development

### Running in Development Mode

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "Initial migration"

# Apply migration
alembic upgrade head
```

### Testing

```bash
pytest
```

## Production Deployment

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Environment Variables

```bash
SECRET_KEY=your-production-secret-key
DATABASE_URL=postgresql://user:password@db:5432/sharezidi_v3
REDIS_URL=redis://redis:6379
```

## Performance Features

- **Connection Pooling**: Efficient database connection management
- **Chunk-based Transfer**: Optimized for large files
- **Real-time Updates**: WebSocket-based progress tracking
- **Error Recovery**: Automatic retry mechanisms
- **Device Management**: Multi-device support

## Security Features

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt password hashing
- **Input Validation**: Pydantic data validation
- **CORS Protection**: Configurable CORS settings
- **Rate Limiting**: Built-in rate limiting (configurable)

## Monitoring

- **Health Check**: `/health` endpoint
- **Metrics**: Transfer statistics and analytics
- **Logging**: Comprehensive logging system
- **Error Tracking**: Detailed error reporting

## License

MIT License - see LICENSE file for details.
