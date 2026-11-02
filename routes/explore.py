"""Routes for the Explore page and related photographs.

/explore                                  Visual discovery page (no search needed)
/api/explore?offset=..&style=..&sort=..   The feed, one page at a time (JSON)
/api/related/<collection>/<image>         Related photographs for the viewer (JSON)

Everything reads the gallery catalogue through content/discover.py. Nothing here
accepts a file path, and the visitor's text is never used to build one.
Nothing is recorded: no searches, views or clicks are stored.
"""

import re
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from content import discover
from content import search as search_store

BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")

router = APIRouter()

PAGE_SIZE = 24
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
KEY_RE = re.compile(r"^img\d+$")


def filter_params(filters, sort, default_sort):
    """The filter part of an address, e.g. 'style=japandi&sort=collection'."""
    pairs = [("style", s) for s in filters.get("styles", [])]
    for name in ("room", "color", "material"):
        if filters.get(name):
            pairs.append((name, filters[name]))
    if sort and sort != default_sort:
        pairs.append(("sort", sort))
    return urlencode(pairs)


def _text(value):
    """A short, tidy filter value (or None)."""
    if not value:
        return None
    value = " ".join(str(value).split())[:60]
    return value or None


def _json(payload, max_age=60):
    return JSONResponse(content=payload, headers={"Cache-Control": "private, max-age=%d" % max_age})


def _whole_number(value, name, default):
    if value is None or value == "":
        return default
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise search_store.QueryError("invalid_paging", "%s must be a whole number." % name.capitalize())
    if number < 0:
        raise search_store.QueryError("invalid_paging", "%s cannot be negative." % name.capitalize())
    return number


@router.get("/explore", response_class=HTMLResponse)
def explore_page(
    request: Request,
    style: List[str] = Query(default=[]),
    sort: Optional[str] = None,
    room: Optional[str] = None,
    color: Optional[str] = None,
    material: Optional[str] = None,
    offset: Optional[str] = None,
):
    status = 200
    error = ""
    try:
        feed = discover.explore(
            offset=_whole_number(offset, "offset", 0),
            limit=PAGE_SIZE,
            styles=style,
            sort=sort,
            room=_text(room),
            color=_text(color),
            material=_text(material),
        )
    except search_store.QueryError as problem:
        # A stale or edited link: show the plain feed and say what happened.
        status = 400
        error = problem.message
        feed = discover.explore(offset=0, limit=PAGE_SIZE)
    params = filter_params(feed["filters"], feed["sort"], "mixed")
    active = bool(params)
    selected = feed["filters"]["styles"]
    curated = []
    if len(selected) == 1:
        by_slug = {s["slug"]: s for s in feed["facets"]["styles"]}
        curated = [by_slug[s] for s in discover.related_style_slugs(selected[0]) if s in by_slug]
    return templates.TemplateResponse(
        request=request,
        name="explore/index.html",
        context={
            "feed": feed,
            "categories": discover.categories(),
            "params": params,
            "filters_active": active,
            "page_size": PAGE_SIZE,
            "error": error,
            "curated_styles": curated,
            "curated_note": discover.CURATED_NOTE,
        },
        status_code=status,
    )


@router.get("/api/explore")
def api_explore(
    style: List[str] = Query(default=[]),
    sort: Optional[str] = None,
    room: Optional[str] = None,
    color: Optional[str] = None,
    material: Optional[str] = None,
    offset: Optional[str] = None,
    limit: Optional[str] = None,
):
    try:
        feed = discover.explore(
            offset=_whole_number(offset, "offset", 0),
            limit=_whole_number(limit, "limit", PAGE_SIZE) or PAGE_SIZE,
            styles=style,
            sort=sort,
            room=_text(room),
            color=_text(color),
            material=_text(material),
        )
    except search_store.QueryError as problem:
        return JSONResponse(
            status_code=400,
            content={"error": problem.code, "message": problem.message},
            headers={"Cache-Control": "no-store"},
        )
    return _json(search_store.public(feed))


@router.get("/api/related/{slug}/{key}")
def api_related(slug: str, key: str):
    if len(slug) > 80 or not SLUG_RE.match(slug) or not KEY_RE.match(key) or len(key) > 12:
        return JSONResponse(status_code=404, content={"error": "not_found", "message": "That photograph was not found."})
    data = discover.related(slug, key)
    if data is None:
        return JSONResponse(status_code=404, content={"error": "not_found", "message": "That photograph was not found."})
    return _json(data, max_age=300)
