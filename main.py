from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# BASE_DIR is the folder that contains this file.
# Using it means the app works no matter which folder you start it from.
BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Chair on Top")

# Files in the "static" folder are available at /static/...
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

# HTML pages come from the "templates" folder.
templates = Jinja2Templates(directory=BASE_DIR / "templates")


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"phase": 0},
    )


@app.get("/health")
def health():
    # A tiny route the page's JavaScript calls to prove the server answers.
    return {"status": "ok", "app": "Chair on Top", "phase": 0}