from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from content import gallery as gallery_store
from routes import gallery as gallery_routes
from routes import explore as explore_routes
from routes import journal as journal_routes
from routes import search as search_routes
from routes import quiz as quiz_routes

# BASE_DIR is the folder that contains this file.
# Using it means the app works no matter which folder you start it from.
BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Chair on Top")

# Files in the "static" folder are available at /static/...
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

# HTML pages come from the "templates" folder.
templates = Jinja2Templates(directory=BASE_DIR / "templates")

# Gallery pages: /gallery and /gallery/<collection>. Registered exactly once.
app.include_router(gallery_routes.router)

# Journal & Listen: /journal and /journal/<slug>. Registered exactly once.
app.include_router(journal_routes.router)

# Search: /search and the /api/search/... endpoints. Registered exactly once.
app.include_router(search_routes.router)

# Explore: /explore and the /api/explore and /api/related endpoints. Registered exactly once.
app.include_router(explore_routes.router)

# Find My Aesthetic quiz: /quiz. Registered exactly once.
app.include_router(quiz_routes.router)


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    # The homepage style cards show the cover photo of each gallery collection.
    covers = {c["slug"]: c["cover"] for c in gallery_store.get_collections()}
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"phase": 0, "gallery_covers": covers},
    )


@app.get("/health")
def health():
    # A tiny route the page's JavaScript calls to prove the server answers.
    return {"status": "ok", "app": "Chair on Top", "phase": 0}
