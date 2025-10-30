"""
Simple HTTP server for testing
"""

import http.server
import socketserver
import webbrowser
import threading
import time

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            html = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>ShareZidi v3.0 - Python Server</title>
            </head>
            <body>
                <h1>ShareZidi v3.0 - Python Server Running!</h1>
                <p>Server is working correctly</p>
                <p>Ready for P2P file transfer development</p>
                <p>Next: Add WebRTC and FastAPI</p>
            </body>
            </html>
            """
            self.wfile.write(html.encode())
        else:
            super().do_GET()

def run_server():
    PORT = 8000
    Handler = MyHTTPRequestHandler
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"ShareZidi v3.0 Python Server running on port {PORT}")
        print(f"Open http://localhost:{PORT} in your browser")
        print("=" * 50)
        httpd.serve_forever()

if __name__ == "__main__":
    run_server()
