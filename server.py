#!/usr/bin/env python3
"""
JARVIS Unified Spatial Vision & Barehands HUD Server
Combines:
  - 3D Model Playground & Hand Telemetry Engine (Vision.Core)
  - Hand-Tracked Glass Cards & Notes Vault Interface (Barehands)
  - Multi-Orb Notes & Media Airlock System
  - AI Assistant Face Ring & Command Dispatcher Channel (/cmd, /state)
"""

import json
import time
import urllib.parse
import os
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = Path(__file__).resolve().parent

def load_config():
    cfg = {"name": "JARVIS", "port": 8080, "orbs": []}
    for cfg_name in ["jarvis.json", "barehands.json"]:
        p = HERE / cfg_name
        if p.is_file():
            try:
                cfg.update(json.loads(p.read_text()))
                break
            except Exception:
                pass
    if not cfg.get("orbs"):
        cfg["orbs"] = [
            {"title": "Notes", "path": "sample-notes", "kind": "notes"},
            {"title": "Props", "path": "media", "kind": "media"},
        ]
    for orb in cfg["orbs"]:
        orb["path"] = str(Path(str(orb.get("path", ""))).expanduser())
    return cfg

CONFIG = load_config()

def orb_root(i):
    """Resolve a notes orb's jail root, or None."""
    try:
        orb = CONFIG["orbs"][int(i)]
        assert orb.get("kind") == "notes"
        p = Path(orb["path"])
        if not p.is_absolute():
            p = HERE / p
        return p.resolve()
    except Exception:
        return None

_STATE = b"{}"          # latest scene state: tracker POSTs, render GETs
_CMDS = []              # queued board commands (AI / CLI -> tracker)
_ALLOWED = (
    "add_img", "add_card", "clear", "reset", "hand", "give",
    "yank", "hover", "scroll_note", "widget", "explode", "assemble",
    "present", "say", "select_model", "sketch"
)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(HERE), **k)

    def end_headers(self):
        # Prevent caching for dynamic html pages
        path_clean = self.path.split("?")[0]
        if path_clean.endswith(".html") or path_clean == "/":
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format, *args):
        # Clean logging output
        pass

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        global _STATE
        n = int(self.headers.get("Content-Length", 0) or 0)
        body = self.rfile.read(n) if 0 < n < 524288 else b"{}"

        # 1. State Heartbeat & Command Channel (/state)
        if self.path == "/state":
            _STATE = body
            out = json.dumps(_CMDS[:8]).encode("utf-8")
            del _CMDS[:8]
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)
            return

        # 2. Command Dispatch Channel (/cmd)
        if self.path == "/cmd":
            try:
                cmd = json.loads(body)
                assert cmd.get("a") in _ALLOWED
                if cmd["a"] in ("add_img", "hand", "give", "present") and cmd.get("src"):
                    rel = str(cmd.get("src", "")).lstrip("/")
                    if rel.startswith("media/"):
                        rel = rel[6:]
                    media = (HERE / "media").resolve()
                    target = (media / rel).resolve()
                    if media not in target.parents or not target.is_file():
                        name = Path(rel).name.lower()
                        hits = [
                            p for p in media.rglob("*")
                            if p.is_file() and p.name.lower() == name
                        ] if name else []
                        if len(hits) != 1:
                            raise ValueError("not in the media airlock")
                        target = hits[0]
                    cmd["src"] = "/media/" + target.relative_to(media).as_posix()
                _CMDS.append(cmd)
                self.send_response(204)
            except Exception:
                self.send_response(400)
            self.end_headers()
            return

        # 3. Telemetry Stream Logging (/telemetry)
        if self.path == "/telemetry":
            try:
                log_file = HERE / "logs" / "hand_telemetry.jsonl"
                log_file.parent.mkdir(exist_ok=True)
                with open(log_file, "a", encoding="utf-8") as f:
                    f.write(body.decode("utf-8") + "\n")
                self.send_response(204)
            except Exception:
                self.send_response(500)
            self.end_headers()
            return

        self.send_response(404)
        self.end_headers()

    def do_GET(self):
        # Alias root or /index.html to hand_tracker/index.html if requested
        if self.path in ("/", "/index.html", "/hud", "/hud.html"):
            index_path = HERE / "hand_tracker" / "index.html"
            if index_path.is_file():
                body = index_path.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

        # 1. Config endpoint
        if self.path == "/config":
            self._json({
                "name": CONFIG.get("name", "JARVIS"),
                "orbs": [
                    {"title": o.get("title", "?"), "kind": o.get("kind", "notes")}
                    for o in CONFIG["orbs"]
                ]
            })
            return

        # 2. Notes Orb Folder Tree (/tree)
        if self.path.startswith("/tree"):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            idx = (q.get("orb") or ["0"])[0]
            root = orb_root(idx)
            if root is None or not root.is_dir():
                self._json({"name": "?", "notes": [], "dirs": []}, 404)
                return

            def walk(d):
                out = {"name": d.name, "notes": [], "dirs": []}
                for p in sorted(d.iterdir()):
                    if p.name.startswith("."):
                        continue
                    if p.is_dir():
                        sub = walk(p)
                        if sub["notes"] or sub["dirs"]:
                            out["dirs"].append(sub)
                    elif p.suffix == ".md" and p.name != "CLAUDE.md":
                        out["notes"].append({
                            "title": p.stem,
                            "file": f"{int(idx)}/{p.relative_to(root)}"
                        })
                return out

            try:
                tree = walk(root)
                tree["name"] = CONFIG["orbs"][int(idx)].get("title", tree["name"])
                self._json(tree)
            except Exception:
                self._json({"name": "?", "notes": [], "dirs": []}, 500)
            return

        # 3. Media Airlock Tree (/props)
        if self.path == "/props":
            EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".webm", ".glb", ".gltf"}
            media_root = (HERE / "media").resolve()

            def walkm(d):
                out = {"name": d.name, "items": [], "dirs": []}
                if not d.is_dir():
                    return out
                for p in sorted(d.iterdir()):
                    if p.name.startswith("."):
                        continue
                    if p.is_dir():
                        sub = walkm(p)
                        if sub["items"] or sub["dirs"]:
                            out["dirs"].append(sub)
                    elif p.suffix.lower() in EXTS:
                        out["items"].append(str(p.relative_to(media_root)))
                return out

            try:
                tree = walkm(media_root)
                tree["name"] = "Props"
                self._json(tree)
            except Exception:
                self._json({"name": "Props", "items": [], "dirs": []}, 500)
            return

        # 4. Ring AI Live State Heartbeat (/orb)
        if self.path == "/orb":
            s_dir = HERE / "state"
            out = {"state": "idle", "mood": "cyan", "wave": None}
            try:
                s = (s_dir / "state").read_text().strip().lower()
                if s in ("idle", "listening", "thinking", "speaking"):
                    out["state"] = s
            except Exception:
                pass
            try:
                m = json.loads((s_dir / "mood.json").read_text())
                if time.time() - float(m.get("ts", 0)) < 45.0:
                    out["mood"] = m.get("mood", "cyan")
            except Exception:
                pass
            if out["state"] == "speaking":
                try:
                    w = json.loads((s_dir / "wave.json").read_text())
                    if time.time() - float(w.get("ts", 0)) < 0.6:
                        out["wave"] = w.get("samples", [])[:64]
                except Exception:
                    pass
            self._json(out)
            return

        # 5. Scene State for OBS Render Mirror (/state)
        if self.path == "/state":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(_STATE)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(_STATE)
            return

        # 6. Snapshots List (/snapshots-list)
        if self.path == "/snapshots-list":
            snap_dir = HERE / "snapshots"
            files = [
                p.name for p in sorted(snap_dir.glob("*.jpg"), key=os.path.getmtime, reverse=True)
            ] if snap_dir.is_dir() else []
            self._json({"snapshots": files})
            return

        # 7. Note Reader (/note?f=N/relpath)
        if self.path.startswith("/note?"):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            rel = (q.get("f") or [""])[0]
            idx, _, rel = rel.partition("/")
            root = orb_root(idx)
            if root is None:
                self.send_response(404)
                self.end_headers()
                return
            target = (root / rel).resolve()
            if (root not in target.parents) or target.suffix != ".md" or not target.is_file():
                self.send_response(404)
                self.end_headers()
                return
            body = target.read_text(encoding="utf-8", errors="replace").encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # Fallback to standard static file server
        # Also check hand_tracker/ directory for relative requests (like style.css, app.js)
        req_file = (HERE / self.path.lstrip("/")).resolve()
        if not req_file.exists() and (HERE / "hand_tracker" / self.path.lstrip("/")).exists():
            self.directory = str(HERE / "hand_tracker")
            res = super().do_GET()
            self.directory = str(HERE)
            return res

        return super().do_GET()

if __name__ == "__main__":
    (HERE / "state").mkdir(exist_ok=True)
    (HERE / "logs").mkdir(exist_ok=True)
    (HERE / "snapshots").mkdir(exist_ok=True)
    (HERE / "media").mkdir(exist_ok=True)

    port = int(CONFIG.get("port", 8080))
    print("=" * 65, flush=True)
    print(f"✨ JARVIS Unified Spatial Vision & HUD Server active!", flush=True)
    print(f"  👉 Vision.Core 3D Playground: http://127.0.0.1:{port}/", flush=True)
    print(f"  👉 Barehands Glass Stage:     http://127.0.0.1:{port}/stage.html", flush=True)
    print(f"  👉 OBS Transparent Mirror:    http://127.0.0.1:{port}/stage.html?role=render", flush=True)
    print("=" * 65, flush=True)

    try:
        ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nJARVIS Server shutting down.")
