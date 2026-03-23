#!/usr/bin/env python3
"""
Simple HTTP server for testing Routy
Usage: python simple_server.py [port] [name]
"""

import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

class SimpleHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        name = getattr(self.server, 'app_name', 'Unknown')

        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

        html = f'''
        <!DOCTYPE html>
        <html>
        <head>
            <title>{name}</title>
            <style>
                body {{
                    font-family: system-ui, -apple-system, sans-serif;
                    max-width: 600px;
                    margin: 100px auto;
                    padding: 20px;
                    text-align: center;
                }}
                h1 {{ color: #333; }}
                .path {{
                    background: #f0f0f0;
                    padding: 10px;
                    border-radius: 5px;
                    font-family: monospace;
                }}
            </style>
        </head>
        <body>
            <h1>🎯 {name}</h1>
            <p>This is a test website running on port {self.server.server_port}</p>
            <div class="path">
                Path: {self.path}
            </div>
            <p><small>Served by simple_server.py</small></p>
        </body>
        </html>
        '''

        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        # Custom log format
        print(f"[{self.server.app_name}] {args[0]}")

def run(port=8080, name="Test App"):
    server = HTTPServer(('localhost', port), SimpleHandler)
    server.app_name = name
    print(f"Starting {name} on port {port}")
    print(f"Visit: http://localhost:{port}")
    print("Press Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print(f"\nStopping {name}")
        server.shutdown()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    name = sys.argv[2] if len(sys.argv) > 2 else "Test App"
    run(port, name)
