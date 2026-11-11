"""Route for the Find My Aesthetic quiz.

/quiz    The 12-question style quiz and its personalised result.

All questions, scoring rules and result copy live in content/quiz.py. The page
shows only real gallery photographs: content/quiz.py checks every image id
against the gallery catalogue before the page is built.
"""

from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from content import quiz as quiz_store

BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")

router = APIRouter()


@lru_cache(maxsize=1)
def _data():
    return quiz_store.build()


@router.get("/quiz", response_class=HTMLResponse)
def quiz_page(request: Request):
    data = _data()
    return templates.TemplateResponse(
        request=request,
        name="quiz/index.html",
        context={
            "quiz": quiz_store.public_json(data),
            "galleries": data["galleries"],
            "current_nav": "quiz",
        },
    )
