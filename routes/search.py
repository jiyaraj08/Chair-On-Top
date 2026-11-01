"""Routes for search.

/search?q=...                       The search results page
/api/search/suggestions?q=...       Live suggestions (JSON)
/api/search/results?q=...&offset=.. Results, one page at a time (JSON)

All of it reads the gallery catalogue (content/gallery.py) through
content/search.py. Nothing here accepts a file path, and the visitor's text is
never used to build one.
"""

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from content import search as search_store

BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")

router = APIRouter()

PAGE_SIZE = 24


def _error(error, status=400):
    return JSONResponse(
        status_code=status,
        content={"error": error.code, "message": error.message, "max_length": search_store.MAX_QUERY_LENGTH},
        headers={"Cache-Control": "no-store"},
    )


def _json(payload):
    # A minute of private caching keeps typing snappy without going stale.
    return JSONResponse(content=payload, headers={"Cache-Control": "private, max-age=60"})


def _whole_number(value, name, default):
    """Read an optional whole number from the address. Raises QueryError if it is not one."""
    if value is None or value == "":
        return default
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise search_store.QueryError("invalid_paging", "%s must be a whole number." % name.capitalize())
    if number < 0:
        raise search_store.QueryError("invalid_paging", "%s cannot be negative." % name.capitalize())
    return number


@router.get("/search", response_class=HTMLResponse)
def search_page(request: Request, q: Optional[str] = None, offset: Optional[str] = None):
    context = {
        "q": "",
        "state": "discover",
        "error": "",
        "search": None,
        "curated": [],
        "page_size": PAGE_SIZE,
    }
    status = 200
    if q is not None and q.strip():
        try:
            start = _whole_number(offset, "offset", 0)
            response = search_store.search(q, offset=start, limit=PAGE_SIZE)
            context["q"] = response["query"]
            context["search"] = response
            context["state"] = "results" if response["total"] else "empty"
        except search_store.QueryError as error:
            status = 400
            context["state"] = "error"
            context["error"] = error.message
            context["q"] = " ".join(q.split())[: search_store.MAX_QUERY_LENGTH]
    if context["state"] in ("discover", "empty", "error"):
        context["curated"] = search_store.curated()
    return templates.TemplateResponse(
        request=request,
        name="search/index.html",
        context=context,
        status_code=status,
    )


@router.get("/api/search/suggestions")
def api_suggestions(q: Optional[str] = None):
    try:
        return _json(search_store.suggest(q))
    except search_store.QueryError as error:
        return _error(error)


@router.get("/api/search/results")
def api_results(
    q: Optional[str] = None,
    offset: Optional[str] = None,
    limit: Optional[str] = None,
    strict: Optional[str] = None,
):
    try:
        response = search_store.search(
            q,
            offset=_whole_number(offset, "offset", 0),
            limit=_whole_number(limit, "limit", search_store.DEFAULT_LIMIT) or search_store.DEFAULT_LIMIT,
            strict=(strict or "").lower() in ("1", "true", "yes"),
        )
    except search_store.QueryError as error:
        return _error(error)
    return _json(search_store.public(response))
