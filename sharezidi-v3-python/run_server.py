"""
Run ShareZidi v3.0 server
"""

import uvicorn
from test_server import app

if __name__ == "__main__":
    print("🚀 Starting ShareZidi v3.0 Server...")
    print("📱 Server will be available at: http://127.0.0.1:8000")
    print("📊 API docs: http://127.0.0.1:8000/docs")
    print("🔧 Health check: http://127.0.0.1:8000/health")
    print("=" * 50)
    
    try:
        uvicorn.run(
            app, 
            host="127.0.0.1", 
            port=8000, 
            log_level="info",
            reload=False
        )
    except Exception as e:
        print(f"❌ Server failed to start: {e}")
        print("🔧 Try running: pip install fastapi uvicorn")

