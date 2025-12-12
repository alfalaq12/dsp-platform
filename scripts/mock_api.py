#!/usr/bin/env python3
"""
Simple Mock REST API Server for DSP Platform Testing
Run: python3 mock_api.py
Endpoints:
  - GET  /api/users      - List users
  - GET  /api/products   - List products (with API key auth)
  - POST /api/search     - Search with body
  - GET  /api/protected  - Bearer token protected endpoint
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json

# Sample data
USERS = [
    {"id": 1, "name": "John Doe", "email": "john@api.com", "status": "active"},
    {"id": 2, "name": "Jane Smith", "email": "jane@api.com", "status": "active"},
    {"id": 3, "name": "Bob Wilson", "email": "bob@api.com", "status": "inactive"},
    {"id": 4, "name": "Alice Brown", "email": "alice@api.com", "status": "active"},
    {"id": 5, "name": "Charlie Davis", "email": "charlie@api.com", "status": "pending"},
]

PRODUCTS = [
    {"sku": "SKU001", "name": "Widget A", "price": 19.99, "category": "widgets"},
    {"sku": "SKU002", "name": "Gadget B", "price": 49.99, "category": "gadgets"},
    {"sku": "SKU003", "name": "Widget C", "price": 29.99, "category": "widgets"},
    {"sku": "SKU004", "name": "Tool D", "price": 99.99, "category": "tools"},
]

# Auth tokens
VALID_API_KEY = "test-api-key-12345"
VALID_BEARER_TOKEN = "my-secret-bearer-token"

class MockAPIHandler(BaseHTTPRequestHandler):
    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _send_error(self, message, status=401):
        self._send_json({"error": message}, status)

    def do_GET(self):
        # Public endpoint - no auth
        if self.path == '/api/users':
            self._send_json(USERS)
            return

        # API Key protected endpoint
        if self.path == '/api/products':
            api_key = self.headers.get('X-API-Key')
            if api_key != VALID_API_KEY:
                self._send_error("Invalid or missing API key")
                return
            self._send_json(PRODUCTS)
            return

        # Bearer token protected endpoint
        if self.path == '/api/protected':
            auth = self.headers.get('Authorization', '')
            if not auth.startswith('Bearer ') or auth[7:] != VALID_BEARER_TOKEN:
                self._send_error("Invalid or missing bearer token")
                return
            self._send_json({
                "message": "Access granted!",
                "data": [
                    {"id": 1, "secret": "data-1"},
                    {"id": 2, "secret": "data-2"},
                ]
            })
            return

        self._send_error("Not found", 404)

    def do_POST(self):
        # POST endpoint with body
        if self.path == '/api/search':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode()
            try:
                query = json.loads(body)
                # Return filtered results based on query
                results = [u for u in USERS if query.get('status', '') in u.get('status', '')]
                self._send_json({"query": query, "results": results, "count": len(results)})
            except json.JSONDecodeError:
                self._send_error("Invalid JSON body", 400)
            return

        self._send_error("Not found", 404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key')
        self.end_headers()

    def log_message(self, format, *args):
        print(f"[API] {args[0]} - {args[1]}")

if __name__ == '__main__':
    PORT = 8080
    server = HTTPServer(('0.0.0.0', PORT), MockAPIHandler)
    print(f"""
🚀 Mock API Server running on port {PORT}

Endpoints:
  GET  http://localhost:{PORT}/api/users      - Public (no auth)
  GET  http://localhost:{PORT}/api/products   - API Key: X-API-Key: {VALID_API_KEY}
  GET  http://localhost:{PORT}/api/protected  - Bearer: {VALID_BEARER_TOKEN}
  POST http://localhost:{PORT}/api/search     - Body: {{"status": "active"}}

Press Ctrl+C to stop.
""")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
