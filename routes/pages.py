from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from app.config import settings

BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")

router = APIRouter()


@router.get("/")
def home(request: Request):
    return templates.TemplateResponse(
        request, "home.html", {"app_name": settings.app_name}
    )


@router.get("/health")
def health():
    return {"status": "ok", "env": settings.app_env}