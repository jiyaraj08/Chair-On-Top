"""Live check of the search feature against the RUNNING Chair on Top server.

Uses only Python's standard library. Start the app first (see the instructions),
then in a second CMD window, in the app folder, run:

    python check_search_live.py

or, if the app runs on another address:

    python check_search_live.py http://127.0.0.1:8000

It only reads pages (GET). It changes nothing.
"""

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
passed = failed = 0


def get(path, raw=False):
    """Return (status, headers, body). Never raises for HTTP errors."""
    url = BASE + path
    try:
        with urllib.request.urlopen(url, timeout=15) as response:
            body = response.read()
            return response.status, response.headers, body
    except urllib.error.HTTPError as error:
        return error.code, error.headers, error.read()
    except Exception as error:  # server not running, refused, timeout...
        print("\nCould not reach %s: %s" % (url, error))
        print("Is the app running?  Start it with:  python -m uvicorn main:app --reload")
        sys.exit(2)


def jget(path):
    status, headers, body = get(path)
    try:
        return status, json.loads(body.decode("utf-8"))
    except ValueError:
        return status, None


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print("PASS  " + name)
    else:
        failed += 1
        print("FAIL  " + name + ("   -> " + str(detail) if detail else ""))


def q(**params):
    return urllib.parse.urlencode(params)


print("Checking", BASE, "\n")

# ---- the four URLs you asked for ---------------------------------------------------
status, headers, body = get("/search?q=Japandi")
html = body.decode("utf-8", "replace")
check("GET /search?q=Japandi -> 200 HTML", status == 200 and "text/html" in headers.get("Content-Type", ""), status)
check("  page shows 16 photographs with real images", html.count('class="gl-item"') == 16 and "/static/images/designs/japandi/img1.jpg" in html, html.count('class="gl-item"'))
check("  page links each photo into the gallery viewer", "/gallery/japandi?image=img3" in html)

status, data = jget("/api/search/suggestions?q=jap")
check("GET /api/search/suggestions?q=jap -> 200 JSON", status == 200 and data is not None, status)
check("  first suggestion is Japandi (16 photographs)", bool(data) and data["suggestions"][0]["label"] == "Japandi" and data["suggestions"][0]["count"] == 16, data)

status, first = jget("/api/search/results?q=Japandi&limit=5")
check("GET /api/search/results?q=Japandi&limit=5 -> 200", status == 200 and first is not None, status)
check("  total 16, 5 returned, has_more, next_offset 5", bool(first) and first["total"] == 16 and first["count"] == 5 and first["has_more"] is True and first["next_offset"] == 5, first and {k: first[k] for k in ("total", "count", "has_more", "next_offset")})

status, second = jget("/api/search/results?q=Japandi&offset=5&limit=5")
check("GET /api/search/results?q=Japandi&offset=5&limit=5 -> 200", status == 200 and second is not None, status)
check("  5 more results, offset 5, previous_offset 0", bool(second) and second["count"] == 5 and second["offset"] == 5 and second["previous_offset"] == 0, second and {k: second[k] for k in ("count", "offset", "previous_offset")})
ids1 = [r["id"] for r in (first or {}).get("results", [])]
ids2 = [r["id"] for r in (second or {}).get("results", [])]
check("  the two pages do not overlap", ids1 and ids2 and not set(ids1) & set(ids2), (ids1, ids2))

# ---- pagination to the end ---------------------------------------------------------------
_, last = jget("/api/search/results?q=Japandi&offset=15&limit=5")
check("pagination: last page has 1 result and has_more false", bool(last) and last["count"] == 1 and last["has_more"] is False and last["next_offset"] is None, last)
_, beyond = jget("/api/search/results?q=Japandi&offset=16&limit=5")
check("pagination: offset past the end -> 200 with 0 results", bool(beyond) and beyond["count"] == 0 and beyond["total"] == 16, beyond)
_, big = jget("/api/search/results?q=white&limit=500")
check("pagination: limit is capped at 48", bool(big) and big["limit"] == 48, big and big["limit"])

# ---- invalid queries -----------------------------------------------------------------------
for path, code in (
    ("/api/search/results", "missing_query"),
    ("/api/search/results?q=", "empty_query"),
    ("/api/search/results?q=%20%20", "empty_query"),
    ("/api/search/results?" + q(q="x" * 81), "query_too_long"),
    ("/api/search/results?q=%3F%3F%3F", "no_searchable_text"),
    ("/api/search/results?q=Japandi&offset=-1", "invalid_paging"),
    ("/api/search/results?q=Japandi&offset=abc", "invalid_paging"),
    ("/api/search/results?q=Japandi&limit=-5", "invalid_paging"),
    ("/api/search/suggestions?" + q(q="x" * 81), "query_too_long"),
):
    status, data = jget(path)
    check("invalid: %s -> 400 %s" % (path[:52], code), status == 400 and bool(data) and data.get("error") == code and bool(data.get("message")), (status, data))
status, headers, body = get("/search?" + q(q="x" * 200))
check("invalid on the page: 200 characters -> friendly 400 page", status == 400 and b"too long" in body, status)
status, headers, body = get("/search?q=%3F%3F%3F")
check("invalid on the page: punctuation only -> friendly 400 page", status == 400 and b"letters or numbers" in body, status)
status, headers, body = get("/search")
check("no query: 200 discovery page with curated suggestions", status == 200 and b"Search the gallery" in body and b"not live trends" in body, status)

# ---- zero-result searches --------------------------------------------------------------------
status, data = jget("/api/search/results?q=marble")
check("zero results (API): 200, total 0, plain-language notice", status == 200 and bool(data) and data["total"] == 0 and bool(data["notice"]), (status, data))
status, headers, body = get("/search?q=marble")
check("zero results (page): 200 empty state with suggestions", status == 200 and b"Nothing in the catalogue matches" in body and b"sr-chips" in body, status)
status, data = jget("/api/search/results?" + q(q="Japandi living room"))
check("unsupported word: Japandi results + honest notice about rooms", status == 200 and bool(data) and data["total"] == 16 and "tagged by room" in data["notice"], data and data["notice"])

# ---- safety -------------------------------------------------------------------------------------
status, headers, body = get("/search?" + q(q="<script>alert(1)</script>"))
text = body.decode("utf-8", "replace")
check("safety: <script> in the query is escaped on the page", status == 200 and "<script>alert(1)</script>" not in text and "&lt;script&gt;" in text, status)
status, data = jget("/api/search/results?" + q(q="../../etc/passwd"))
check("safety: a path-like query returns no files or paths", status == 200 and bool(data) and data["results"] == [], data)
status, headers, body = get("/search?" + q(q='"><img src=x onerror=alert(1)>'))
check("safety: attribute-breaking query is escaped", b"<img src=x" not in body, status)

# ---- every photograph URL really exists on disk -----------------------------------------------------
missing = []
total = 0
for style in ("Japandi", "Mid-Century Modern", "Scandinavian", "Minimalism"):
    _, data = jget("/api/search/results?" + q(q=style, limit=48))
    for item in (data or {}).get("results", []):
        total += 1
        status, headers, body = get(item["url"])
        if status != 200 or "image" not in headers.get("Content-Type", "") or not body:
            missing.append((item["id"], status))
check("all 64 result image URLs load as real images (%d checked)" % total, total == 64 and not missing, missing[:5] or total)

# ---- the rest of the site still answers ------------------------------------------------------------------
for path in ("/", "/health", "/gallery", "/gallery/japandi", "/gallery/mid-century-modern", "/gallery/scandinavian", "/gallery/minimalism", "/saved", "/moodboards", "/moodboards/board?id=bnothere1", "/static/css/theme.css", "/static/js/actions.js", "/static/js/workspace.js"):
    status, headers, body = get(path)
    check("existing route %s -> 200" % path, status == 200, status)
status, headers, body = get("/gallery/nope")
check("existing route /gallery/nope -> 404", status == 404, status)
status, headers, body = get("/journal")
print("INFO  /journal -> %s  (200 means the Journal router is registered; 404 means main.py does not include it)" % status)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
