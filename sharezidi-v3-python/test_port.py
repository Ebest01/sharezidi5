"""
Test different ports to see which one works
"""

import socket
import sys

def test_port(port):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(('127.0.0.1', port))
        sock.listen(1)
        print(f"Port {port} is available")
        sock.close()
        return True
    except OSError as e:
        print(f"Port {port} is not available: {e}")
        return False

if __name__ == "__main__":
    print("Testing available ports...")
    ports_to_test = [8000, 8001, 8002, 3000, 3001, 5000, 8080]
    
    for port in ports_to_test:
        if test_port(port):
            print(f"Using port {port} for ShareZidi v3.0")
            break
    else:
        print("No available ports found")
