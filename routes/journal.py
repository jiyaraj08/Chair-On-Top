"""Routes for the Journal & Listen section.

/journal          The Journal landing page (articles, Design Stories, Listening Room)
/journal/<slug>   One article. Unknown or invalid slugs return a real 404.

The content itself lives in the content/ folder, so you can add articles,
videos and podcasts without touching this file.
"""

import re
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from content import articles as article_store
from content import media as media_store

BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")

router = APIRouter()

# Only plain slugs are accepted, so odd input never reaches the lookup.
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _not_found(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="journal/not_found.html",
        context={"current_nav": "journal"},
        status_code=404,
    )


@router.get("/journal", response_class=HTMLResponse)
def journal_home(request: Request):
    articles = article_store.get_articles()
    featured = article_store.get_featured()
    others = [a for a in articles if featured is None or a["slug"] != featured["slug"]]
    return templates.TemplateResponse(
        request=request,
        name="journal/index.html",
        context={
            "current_nav": "journal",
            "featured": featured,
            "articles": others,
            "article_count": len(articles),
            "article_categories": article_store.get_categories(articles),
            "videos": media_store.get_videos(),
            "video_categories": media_store.get_video_categories(),
            "podcasts": media_store.get_podcasts(),
            "podcast_categories": media_store.get_podcast_categories(),
        },
    )


@router.get("/journal/{slug}", response_class=HTMLResponse)
def journal_article(request: Request, slug: str):
    if len(slug) > 100 or not SLUG_PATTERN.match(slug):
        return _not_found(request)
    article = article_store.get_article(slug)
    if article is None:
        return _not_found(request)
    return templates.TemplateResponse(
        request=request,
        name="journal/article.html",
        context={
            "current_nav": "journal",
            "article": article,
            "related": article_store.get_related(article),
        },
    )
