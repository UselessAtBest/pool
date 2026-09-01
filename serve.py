#!/usr/bin/env python3
"""Local static server with SPA fallback.

Plain `python3 -m http.server` 404s if you refresh on a deep link like
/player/jamie-mercer, because it looks for a literal file at that path.
This server does what Netlify/Vercel/GitHub Pages already do in
production (see _redirects / vercel.json / 404.html) - if a path has no
matching file and isn't a request for a static asset, it serves
index.html and lets the app's own router take it from there.

Usage:
    python3 serve.py [port]      (defaults to 8080)
"""
import http.server
import os
import socket
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


def lan_ip():
    """Best-effort guess at this machine's LAN IP (the one your phone would use)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))  # doesn't actually send anything, just picks a route
        return s.getsockname()[0]
    except Exception:
        return None
    finally:
        s.close()


class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        local_path = self.translate_path(self.path.split('?')[0])
        looks_like_asset = '.' in os.path.basename(local_path)
        if not os.path.isfile(local_path) and not looks_like_asset:
            self.path = '/index.html'
        return super().do_GET()


if __name__ == '__main__':
    with http.server.HTTPServer(('', PORT), SPARequestHandler) as httpd:
        print(f'On this machine:     http://localhost:{PORT}')
        ip = lan_ip()
        if ip:
            print(f'On your phone/tablet (same wifi): http://{ip}:{PORT}')
        else:
            print('Could not detect a LAN IP - find yours with `ipconfig` (Windows) or `ifconfig`/`ip addr` (Mac/Linux)')
        print('(Ctrl+C to stop)')
        httpd.serve_forever()
