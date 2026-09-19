#!/usr/bin/env python3
"""Static server for dist/web plus a tiny per-browser model store (stdlib only).

GET/PUT /api/model reads/writes one JSON model per browser. A random id cookie
(`cid`) is issued on first contact and names the file under DATA_DIR. There are
no accounts: clearing cookies or switching browser starts a fresh model.

Usage: server.py [--dir dist/web] [--port 8080]   (env DATA_DIR, default ./data)
"""
import argparse
import json
import os
import re
import secrets
import sys
import tempfile
from functools import partial
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

MAX_BODY = 2 * 1024 * 1024
CID_RE = re.compile(r"^[0-9a-f]{32}$")
DATA_DIR = os.environ.get("DATA_DIR", "data")


class Handler(SimpleHTTPRequestHandler):
    def _cid(self):
        c = SimpleCookie(self.headers.get("Cookie", ""))
        v = c["cid"].value if "cid" in c else ""
        return v if CID_RE.match(v) else None

    def _json(self, code, obj, cid=None, fresh=False):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if fresh:
            secure = "; Secure" if self.headers.get("X-Forwarded-Proto") == "https" else ""
            self.send_header("Set-Cookie", f"cid={cid}; Max-Age=315360000; Path=/; HttpOnly; SameSite=Lax{secure}")
        self.end_headers()
        self.wfile.write(body)

    def _path(self, cid):
        return os.path.join(DATA_DIR, cid + ".json")

    def _is_api(self):
        return self.path.split("?", 1)[0] == "/api/model"

    def do_GET(self):
        if not self._is_api():
            return super().do_GET()
        cid = self._cid()
        fresh = cid is None
        cid = cid or secrets.token_hex(16)
        model = None
        try:
            with open(self._path(cid)) as f:
                model = json.load(f)
        except (OSError, ValueError):
            pass
        self._json(200, {"model": model}, cid, fresh)

    def do_PUT(self):
        if not self._is_api():
            return self.send_error(404)
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n <= 0 or n > MAX_BODY:
                return self._json(413, {"error": "bad size"})
            m = json.loads(self.rfile.read(n))
        except ValueError:
            return self._json(400, {"error": "bad json"})
        if not (isinstance(m, dict) and isinstance(m.get("stages"), list)
                and len(m["stages"]) == 8 and isinstance(m.get("tools"), list)):
            return self._json(400, {"error": "bad model"})
        cid = self._cid()
        fresh = cid is None
        cid = cid or secrets.token_hex(16)
        os.makedirs(DATA_DIR, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=DATA_DIR, suffix=".tmp")
        with os.fdopen(fd, "w") as f:
            json.dump(m, f)
        os.replace(tmp, self._path(cid))
        self._json(200, {"ok": True}, cid, fresh)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="dist/web")
    ap.add_argument("--port", type=int, default=8080)
    a = ap.parse_args()
    h = partial(Handler, directory=a.dir)
    print(f"serving {a.dir} on :{a.port}, models in {DATA_DIR}", file=sys.stderr)
    ThreadingHTTPServer(("", a.port), h).serve_forever()


if __name__ == "__main__":
    main()
