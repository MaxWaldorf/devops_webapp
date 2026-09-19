#!/usr/bin/env python3
"""Build both deliverables from the single source tree in src/.

  dist/web/                                  static site (what the container serves)
  dist/standalone/devops-lifecycle.html      one self-contained file, works from file://
                                             (local use only; never part of the hosted package)

The standalone is a mechanical inlining of src/index.html (every local
<script src>, the stylesheet <link> and url() becomes inline / a data: URI). Nothing else differs, so
the two cannot drift. Both carry the same build id (a hash of all of src/),
and `build.py --check` verifies that.
"""
import base64, hashlib, mimetypes, re, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, DIST = ROOT / "src", ROOT / "dist"
WEB, STANDALONE = DIST / "web", DIST / "standalone" / "devops-lifecycle.html"
ID_RE = re.compile(r'<meta name="build-id" content="([0-9a-f]{12})">')
mimetypes.add_type("font/woff2", ".woff2")


def build_id():
    h = hashlib.sha256()
    for f in sorted(p for p in SRC.rglob("*") if p.is_file()):
        h.update(f.relative_to(SRC).as_posix().encode())
        h.update(f.read_bytes())
    return h.hexdigest()[:12]


def stamp(html, bid):
    # The build id also busts the browser cache for the stylesheet on the hosted site.
    html = html.replace('href="styles.css"', f'href="styles.css?v={bid}"')
    return html.replace("<head>", f'<head>\n<meta name="build-id" content="{bid}">', 1)


def inline(html):
    def script(m):
        body = (SRC / m.group(1)).read_text(encoding="utf8")
        return "<script>" + body.replace("</script", "<\\/script") + "</script>"

    def url(m):
        f = SRC / m.group(1)
        mime = mimetypes.guess_type(f.name)[0]
        return f'url("data:{mime};base64,{base64.b64encode(f.read_bytes()).decode()}")'

    def style(m):
        return "<style>" + (SRC / m.group(1)).read_text(encoding="utf8") + "</style>"

    html = re.sub(r'<link rel="stylesheet" href="(styles\.css)(?:\?v=[0-9a-f]+)?">', style, html)
    html = re.sub(r'<script src="((?:vendor)/[^"]+)"></script>', script, html)
    return re.sub(r'url\("((?:fonts)/[^"]+)"\)', url, html)


def build():
    bid = build_id()
    html = stamp((SRC / "index.html").read_text(encoding="utf8"), bid)
    shutil.rmtree(DIST, ignore_errors=True)
    shutil.copytree(SRC, WEB)
    (WEB / "index.html").write_text(html, encoding="utf8")
    STANDALONE.parent.mkdir(parents=True)
    STANDALONE.write_text(inline(html), encoding="utf8")
    print(f"build {bid}: {WEB} + {STANDALONE} ({STANDALONE.stat().st_size // 1024} KiB)")


def check():
    ids = {}
    for name, p in {"web": WEB / "index.html", "standalone": STANDALONE}.items():
        m = ID_RE.search(p.read_text(encoding="utf8"))
        ids[name] = m and m.group(1)
    ids["source"] = build_id()
    left = re.findall(r'(?:src|url\()=?"?((?:vendor|fonts)/[^"\)]+)', STANDALONE.read_text(encoding="utf8"))
    left += re.findall(r'<link[^>]*stylesheet[^>]*>', STANDALONE.read_text(encoding="utf8"))
    if len(set(ids.values())) != 1 or left:
        sys.exit(f"OUT OF SYNC: {ids} unresolved refs in standalone: {left}")
    leaked = [f.name for f in WEB.rglob("*") if f.name == STANDALONE.name]
    if leaked:
        sys.exit(f"standalone must not be in the web package: {leaked}")
    print(f"in sync @ {ids['source']}")


if __name__ == "__main__":
    check() if "--check" in sys.argv else build()
