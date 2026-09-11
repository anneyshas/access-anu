"""Offline server. Python 3 standard library only; binds only to your computer."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser

class Handler(SimpleHTTPRequestHandler):
    extensions_map = dict(SimpleHTTPRequestHandler.extensions_map, **{
        '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css',
    })
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=0, help='0 automatically chooses a free port')
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent / 'dist'
    if not (root / 'index.html').is_file():
        raise SystemExit('Extract the entire ZIP before running this launcher.')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(root)))
    url = 'http://127.0.0.1:{}/'.format(server.server_port)
    print('Access ANU: ' + url, flush=True)
    print('Keep this window open. Press Ctrl+C to stop. Internet is not required.', flush=True)
    if not args.no_browser:
        threading.Timer(0.3, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
