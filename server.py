#!/usr/bin/env python3
import http.server, os

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, fmt, *args):
        pass  # silence per-request logs

os.chdir(os.path.dirname(os.path.abspath(__file__)))
print('Serving at http://localhost:8934')
http.server.HTTPServer(('', 8934), NoCacheHandler).serve_forever()
