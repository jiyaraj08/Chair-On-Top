"""Routes for the design gallery.

/gallery           Overview with one card per collection
/gallery/<slug>    One collection (for example /gallery/japandi)
/saved             Photographs saved in this browser
/moodboards        The Moodboards studio (boards are kept in this browser)

The collections and their pictures are described in content/gallery.py.
"""

import re
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from content import gallery as gallery_store

BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")

router = APIRouter()

SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _not_found(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="gallery/not_found.html",
        context={},
        status_code=404,
    )


@router.get("/gallery", response_class=HTMLResponse)
def gallery_home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="gallery/index.html",
        context={"collections": gallery_store.get_collections()},
    )


@router.get("/saved", response_class=HTMLResponse)
def saved_page(request: Request):
    # Which photographs are saved lives in the visitor's browser. The server
    # only supplies the list of real photographs; saved.js shows the saved ones.
    return templates.TemplateResponse(
        request=request,
        name="gallery/saved.html",
        context={"collections": gallery_store.get_collections()},
    )


@router.get("/moodboards", response_class=HTMLResponse)
def moodboards_page(request: Request):
    # The moodboards themselves live in the visitor's browser. The server only
    # supplies the list of real gallery photographs they can be built from.
    collections = gallery_store.get_collections()
    catalog = [
        {
            "id": img["id"],
            "slug": c["slug"],
            "collection": c["name"],
            "number": img["number"],
            "path": img["path"],
            "width": img["width"],
            "height": img["height"],
        }
        for c in collections
        for img in c["images"]
    ]
    return templates.TemplateResponse(
        request=request,
        name="moodboards/index.html",
        context={"catalog": catalog},
    )


@router.get("/gallery/{slug}", response_class=HTMLResponse)
def gallery_collection(request: Request, slug: str):
    if len(slug) > 80 or not SLUG_PATTERN.match(slug):
        return _not_found(request)
    collection = gallery_store.get_collection(slug)
    if collection is None:
        return _not_found(request)
    others = [c for c in gallery_store.get_collections() if c["slug"] != slug]
    return templates.TemplateResponse(
        request=request,
        name="gallery/collection.html",
        context={"collection": collection, "others": others},
    )
