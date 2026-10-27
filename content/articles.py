"""Journal articles for Chair on Top.

HOW TO ADD AN ARTICLE
---------------------
1. Copy any block inside ARTICLES (from the opening { to the closing },).
2. Paste it at the end of the list, before the final ].
3. Change every field. Keep the commas and the quote marks.
4. Save the file. If the server is running with --reload it restarts itself.

FIELDS
------
slug         Web address ending. Lowercase letters, numbers and hyphens only.
             Must be different for every article. Example: "my-new-article"
title        The headline.
description  One or two sentences shown on the cards and under the headline.
category     One of CATEGORY_ORDER below (or add your own name there).
             Only categories that have at least one article are shown.
published    Date as "YYYY-MM-DD".
featured     True for the one big article at the top of the Journal. If you set
             True on more than one, the first one is used.
palette      Three hex colours for the placeholder cover: wall, shape, floor.
cover_image  Optional. Leave as None until you have a real file.
             To use a photo: save it inside static\\images\\journal\\ and write
             "images/journal/yourfile.jpg". Add cover_alt to describe it.
body         The article, as a list of blocks:
               {"type": "p",       "text": "A paragraph."}
               {"type": "h2",      "text": "A section heading"}
               {"type": "ul",      "items": ["Bullet one", "Bullet two"]}
               {"type": "ol",      "items": ["Step one", "Step two"]}
               {"type": "callout", "title": "Tip", "text": "A highlighted note."}

Write plain text only. Anything you type is shown as text, never as HTML.
Do not copy articles from other websites.

If a block has a mistake, that article is skipped and a warning is printed in
the CMD window where the server is running. The rest of the site keeps working.
"""

import logging
import math
import re
from datetime import datetime

logger = logging.getLogger(__name__)

# Order in which categories are listed. A category only appears on the site
# when at least one article uses it.
CATEGORY_ORDER = [
    "Small Spaces",
    "Colour & Materials",
    "Lighting",
    "Furniture",
    "Luxury on a Budget",
    "Room Guides",
    "Architecture & Design",
]

WORDS_PER_MINUTE = 200

ARTICLES = [
    {
        "slug": "make-a-small-living-room-feel-spacious",
        "title": "How to Make a Small Living Room Feel More Spacious",
        "description": "Practical changes that open up a compact living room without knocking down a wall or buying everything new.",
        "category": "Small Spaces",
        "published": "2026-10-26",
        "featured": True,
        "palette": ["#e9e5dd", "#7c7770", "#c9bfae"],
        "cover_image": None,
        "body": [
            {"type": "p", "text": "A small living room rarely needs more floor area. It usually needs clearer sightlines, better light and fewer things competing for attention. The steps below run from free to modest spend, so you can stop as soon as the room feels right."},
            {"type": "h2", "text": "Clear the surfaces first"},
            {"type": "p", "text": "Stand in the doorway and notice where your eye lands. Stray cables, stacked magazines and a crowded coffee table all make a room feel smaller, because the eye has nowhere calm to rest. Give each surface one job: a lamp and a plant on the side table, a single tray on the coffee table. Anything else moves to storage or leaves the room."},
            {"type": "h2", "text": "Protect the walking path"},
            {"type": "p", "text": "As a common rule of thumb, leave about 60 cm (two feet) for walkways. Place the largest piece first, usually the sofa, then arrange everything else so there is a clear line from the door to the window. If a chair or table interrupts that line, try it in another corner before you decide the room is too small."},
            {"type": "h2", "text": "Choose furniture that shows some floor"},
            {"type": "p", "text": "Pieces on visible legs let light and sight pass underneath, so the floor seems to continue. A slim-armed sofa and one armchair often seat as many people as a bulky three-seater, with less visual weight. Check the scale of everything against the room: one generous piece and two small ones usually look calmer than five medium ones."},
            {"type": "h2", "text": "Let light and colour do quiet work"},
            {"type": "p", "text": "Light, warm wall colours reflect more daylight and soften corners. Painting the walls and the largest furniture in close shades blurs the edges, which also helps. Hang curtains high and wide, a little above and beyond the window frame, so the window looks larger, and choose a fabric that lets daylight through."},
            {"type": "callout", "title": "Mirror tip", "text": "Place a mirror beside or opposite a window so it reflects daylight and a calm view. Avoid facing it at a cluttered corner, because it will double the clutter."},
            {"type": "h2", "text": "Use vertical space and pieces with two jobs"},
            {"type": "ul", "items": [
                "A tall, narrow bookshelf instead of a wide, low cabinet.",
                "Wall-hung shelves above a desk or sofa.",
                "A storage ottoman that works as a seat, a table and a hiding place for blankets.",
                "Nesting tables you can pull out for guests.",
                "A slim console behind the sofa for keys, a lamp and a tray.",
            ]},
            {"type": "h2", "text": "A one-evening checklist"},
            {"type": "ol", "items": [
                "Clear every surface, then put back only what you use or love.",
                "Trace the path from the door to the window and remove anything that blocks it.",
                "Swap or remove the one piece that feels too big.",
                "Raise the curtain rod to just below the ceiling, or well above the window frame.",
                "Add a mirror or a lamp where the room feels darkest.",
            ]},
            {"type": "p", "text": "Live with the changes for a week before you buy anything new. Often the room only needed space to breathe."},
        ],
    },
    {
        "slug": "practical-guide-to-warm-neutral-colour-palettes",
        "title": "A Practical Guide to Warm Neutral Colour Palettes",
        "description": "How to build a calm palette of ivory, sand and clay that feels rich instead of flat.",
        "category": "Colour & Materials",
        "published": "2026-10-26",
        "featured": False,
        "palette": ["#ddd0bc", "#b5603a", "#7a5538"],
        "cover_image": None,
        "body": [
            {"type": "p", "text": "Warm neutrals are the backbone of many calm homes: ivory, sand, oatmeal, clay and soft taupe. They are easy to live with, but a palette that is all beige can look flat or oddly mismatched. The difference usually comes down to undertone, texture and one dark anchor."},
            {"type": "h2", "text": "Start with undertones"},
            {"type": "p", "text": "Every neutral leans slightly warm (yellow, red or orange) or cool (blue, green or grey). Warm neutrals are not just beige: they include creamy whites, pale sand, caramel and brown. Problems appear when warm and cool neutrals meet, for example a yellow-leaning cream wall next to a blue-grey sofa. Hold paint samples next to your floor first, because flooring is the hardest thing to change and it sets the undertone for everything else."},
            {"type": "h2", "text": "Use a simple proportion"},
            {"type": "p", "text": "A familiar rule of thumb is 60-30-10: roughly sixty percent of the room in a main colour such as the walls and a large rug, thirty percent in a second colour such as the sofa and curtains, and ten percent in accents such as cushions, art and a vase. It is a guide, not a law. Its real value is that it stops every colour from competing for equal attention."},
            {"type": "h2", "text": "Add texture, not more colour"},
            {"type": "p", "text": "When colours are quiet, texture supplies the interest. Mix a nubby linen with smooth ceramic, a woven rug with a polished wooden table, a wool throw with a cotton cushion. Three or four different textures in the same palette will feel richer than three or four different colours."},
            {"type": "h2", "text": "Give the palette one dark anchor"},
            {"type": "p", "text": "A single deep tone stops warm neutrals from floating away. Charcoal, deep olive or dark walnut all work. Use it in small, repeated doses: a thin picture frame, a lamp base, a side table. Repeating the anchor in at least two places makes it look planned."},
            {"type": "callout", "title": "Test before you commit", "text": "Paint a large sample on two different walls and look at it in the morning, in the afternoon and under your evening lights. A colour that looks creamy at noon can turn yellow or grey after dark."},
            {"type": "h2", "text": "A sample palette to adapt"},
            {"type": "ul", "items": [
                "Walls: warm ivory.",
                "Sofa and curtains: sand or oatmeal linen.",
                "Rug: a lighter or darker version of the same family.",
                "Accent: muted olive or clay in cushions and a vase.",
                "Anchor: dark walnut or charcoal in frames, lamp bases and one table.",
                "Metals: brass or bronze for warmth, repeated in no more than two places.",
            ]},
            {"type": "h2", "text": "Common mistakes"},
            {"type": "ol", "items": [
                "Mixing a warm white wall with a cool white ceiling or trim without testing them side by side.",
                "Choosing every item in the same beige, with no variation in tone.",
                "Skipping the dark anchor, which leaves the room looking washed out.",
                "Picking colours from a small card and never testing a larger sample.",
            ]},
            {"type": "p", "text": "Start with one change, such as repainting a single wall or swapping the cushions, and let the palette grow from there."},
        ],
    },
    {
        "slug": "lighting-layers-that-make-a-room-feel-finished",
        "title": "Lighting Layers That Make a Room Feel Finished",
        "description": "Ambient, task and accent light, and how to combine them at different heights for a room that feels complete.",
        "category": "Lighting",
        "published": "2026-10-26",
        "featured": False,
        "palette": ["#2f2b27", "#e8cf9c", "#1e1b18"],
        "cover_image": None,
        "body": [
            {"type": "p", "text": "If a room looks flat even though the furniture is right, the lighting is often the missing piece. A single ceiling light throws the same flat light everywhere. Rooms that feel finished usually combine several layers of light at different heights."},
            {"type": "h2", "text": "The three layers"},
            {"type": "ul", "items": [
                "Ambient: the general light that lets you see the whole room, such as a ceiling fixture, wall lights or an uplight.",
                "Task: focused light for doing something, such as a reading lamp, a desk lamp or a strip under a cabinet.",
                "Accent: soft light that adds depth, such as a small lamp on a shelf, a picture light or a lamp that washes a wall.",
            ]},
            {"type": "p", "text": "You do not need all three in every room, but most living rooms and bedrooms benefit from at least two."},
            {"type": "h2", "text": "Aim for light at different heights"},
            {"type": "p", "text": "Try to have light at floor level, table level and above eye level. A floor lamp beside the sofa, a table lamp on a console and a ceiling or wall light together make a room feel layered. If every light source is on the ceiling, shadows fall in the same direction and faces and objects look flat."},
            {"type": "h2", "text": "Keep the bulbs consistent"},
            {"type": "p", "text": "Bulb colour is described in kelvins. As a common rule of thumb, warm white (around 2700K to 3000K) suits living rooms and bedrooms, while a slightly cooler white suits kitchens, desks and bathrooms. The most important thing is consistency within a room: mixing warm and cool bulbs makes a space look patchy. Buy bulbs in the same colour temperature and check the label before you buy."},
            {"type": "callout", "title": "Dimmers change everything", "text": "A dimmer or a dimmable smart bulb lets one room serve for morning tasks and evening relaxation. If you cannot rewire, dimmable bulbs in table lamps, or a plug-in dimmer, are an easy alternative."},
            {"type": "h2", "text": "Choose shades and positions carefully"},
            {"type": "p", "text": "A fabric shade softens and spreads light, while a bare bulb creates glare. Position reading lamps so the bottom of the shade is near eye level when you are seated, which keeps the bulb out of your eyes. Place lamps in a loose triangle around a seating area, rather than all against one wall."},
            {"type": "h2", "text": "A budget-friendly order of work"},
            {"type": "ol", "items": [
                "Replace harsh or mismatched bulbs with a consistent warm white.",
                "Add one lamp at table height where the room feels darkest.",
                "Add a floor lamp in a corner to lift the shadows.",
                "Add one accent light, such as a small lamp on a shelf.",
                "Only then consider changing the main ceiling fixture.",
            ]},
            {"type": "p", "text": "Test the room in the evening, switching lamps on one by one. Stop when it feels comfortable, not when every corner is bright."},
        ],
    },
    {
        "slug": "premium-looking-interior-on-a-realistic-budget",
        "title": "Creating a Premium-Looking Interior on a Realistic Budget",
        "description": "Where spending shows, where it does not, and a sensible order for improving a room in stages.",
        "category": "Luxury on a Budget",
        "published": "2026-10-26",
        "featured": False,
        "palette": ["#f1eee8", "#b88b4a", "#d8bf98"],
        "cover_image": None,
        "body": [
            {"type": "p", "text": "A room looks expensive when it looks calm, consistent and cared for, not when every item has a high price. Much of the premium look comes from decisions that cost little: restraint, matching finishes and good lighting. The rest is knowing where spending actually shows."},
            {"type": "h2", "text": "Spend where you touch, sit and sleep"},
            {"type": "p", "text": "Your hands and body notice quality in a few places: the sofa you sit on, the mattress you sleep on, the handles you pull and the curtains you brush past. If your budget is limited, put more of it there, and save on things you only look at, such as decorative objects."},
            {"type": "h2", "text": "Edit before you buy"},
            {"type": "p", "text": "A room with fewer, larger pieces usually looks more expensive than a room with many small ones. Clear what you do not need, then notice what is genuinely missing. Often the answer is less, not more."},
            {"type": "h2", "text": "Make finishes agree"},
            {"type": "ul", "items": [
                "Choose one or two metals and repeat them in lamps, handles and frames.",
                "Repeat the same wood tone in two or three places.",
                "Use matching frames for art, with simple mats around the pictures.",
                "Keep your palette to a few related colours.",
            ]},
            {"type": "callout", "title": "Cheap upgrades with a big effect", "text": "New handles on old cabinets, a fresh coat of paint, full-length curtains hung high, and consistent warm bulbs all change how a room feels without replacing any furniture."},
            {"type": "h2", "text": "Buy in stages"},
            {"type": "p", "text": "You do not have to finish a room in a weekend. Start with the things that affect the whole room: paint, lighting and curtains. Add the main seating next. Leave accessories for last, because by then you will know what the room needs. Secondhand and refurbished furniture can be a good source of solid pieces, especially in wood, if you check the construction and are willing to clean or refinish it."},
            {"type": "h2", "text": "What to be careful with"},
            {"type": "ul", "items": [
                "Imitations that try to copy a very expensive material often look thin up close. Honest, simple materials usually look better.",
                "Matching furniture sets can feel flat. Mix two or three pieces that share a tone.",
                "Large decorative items bought only because they were discounted.",
            ]},
            {"type": "h2", "text": "A sensible order of spending"},
            {"type": "ol", "items": [
                "Declutter, clean and repaint if needed.",
                "Fix the lighting.",
                "Hang proper curtains.",
                "Buy or refresh the main seating.",
                "Add art, plants and small accessories.",
            ]},
            {"type": "p", "text": "Costs vary a lot by city, brand and materials, so set your own numbers for each step before you start. Chair on Top's budget planner is planned to help with this. For now, the figures on the homepage are only an illustration."},
        ],
    },
    {
        "slug": "planning-a-bedroom-for-better-rest",
        "title": "Planning a Bedroom That Feels Calm and Easy to Rest In",
        "description": "A layout, lighting and textile guide for a bedroom that is easy to use and easy to leave alone.",
        "category": "Room Guides",
        "published": "2026-10-26",
        "featured": False,
        "palette": ["#ece1cd", "#5e6444", "#a9b5bd"],
        "cover_image": None,
        "body": [
            {"type": "p", "text": "A bedroom works best when it is easy to use and easy to leave alone: a clear path, soft light and a bed that is the obvious centre of the room. This guide is about comfort and layout. It is not medical advice."},
            {"type": "h2", "text": "Place the bed first"},
            {"type": "p", "text": "Put the bed on the wall that gives the clearest view from the door, ideally against a solid wall rather than under a window. Leave a comfortable path on both sides if the room allows it, and avoid pushing the bed into a corner unless the room is very small. Matching bedside tables or lamps on both sides make the bed look balanced and give each person a place for a glass and a book."},
            {"type": "h2", "text": "Layer soft light"},
            {"type": "p", "text": "Choose warm, dimmable light. Bedside lamps give the main evening glow, an overhead light can stay for cleaning and dressing, and a small accent lamp can add warmth in a corner. Consider curtains with a lining, or a second layer, if street light or early sun bothers you."},
            {"type": "h2", "text": "Keep colours calm"},
            {"type": "p", "text": "Soft, low-contrast colours make a bedroom feel quiet: warm whites, sand, muted olive or clay. If you want a stronger colour, use it on the wall behind the bed or on the bedding, not everywhere."},
            {"type": "h2", "text": "Layer the textiles"},
            {"type": "ul", "items": [
                "A smooth sheet with a textured cover or quilt.",
                "One or two cushions in a related colour, not a big pile.",
                "A throw folded at the foot of the bed.",
                "A rug that extends past the sides of the bed, so your feet land on something soft.",
                "Curtains in a natural fabric that fall to the floor.",
            ]},
            {"type": "h2", "text": "Hide what you can"},
            {"type": "p", "text": "Storage is what lets a bedroom stay calm. Use under-bed boxes, closed cabinets and hooks behind the door. Keep the surfaces beside the bed to a lamp, a book and a glass, and keep work items and chargers somewhere else if you can."},
            {"type": "callout", "title": "A simple test", "text": "Lie on the bed and look at the ceiling, the wall opposite and the door. If anything you see makes the room feel busy, such as piles of clothes or bright indicator lights, move it or cover it."},
            {"type": "h2", "text": "A weekend plan"},
            {"type": "ol", "items": [
                "Day one, morning: clear the floor and surfaces, and wash the bedding.",
                "Day one, afternoon: reposition the bed and bedside tables.",
                "Day two, morning: replace harsh bulbs and add dimmable lamps.",
                "Day two, afternoon: add one layer of texture, then stop.",
            ]},
        ],
    },
]


# ---------------------------------------------------------------------------
# Everything below prepares the data for the templates. You do not need to
# edit it when adding articles.
# ---------------------------------------------------------------------------

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
IMAGE_RE = re.compile(r"^[A-Za-z0-9_./-]+$")
BLOCK_TYPES = {"p", "h2", "ul", "ol", "callout"}


def slugify(text):
    """Turn 'Colour & Materials' into 'colour-materials'."""
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")


def _is_text(value):
    return isinstance(value, str) and value.strip() != ""


def _check_block(block):
    """Return an error message for a bad block, or None when it is fine."""
    if not isinstance(block, dict) or block.get("type") not in BLOCK_TYPES:
        return "a body block has an unknown or missing type"
    kind = block["type"]
    if kind in ("p", "h2") and not _is_text(block.get("text")):
        return "a '%s' block needs non-empty text" % kind
    if kind in ("ul", "ol"):
        items = block.get("items")
        if not isinstance(items, list) or not items or not all(_is_text(i) for i in items):
            return "a '%s' block needs a non-empty list of text items" % kind
    if kind == "callout" and not (_is_text(block.get("title")) and _is_text(block.get("text"))):
        return "a 'callout' block needs a title and text"
    return None


def _block_words(block):
    parts = []
    for key in ("text", "title"):
        if _is_text(block.get(key)):
            parts.append(block[key])
    if isinstance(block.get("items"), list):
        parts.extend(i for i in block["items"] if _is_text(i))
    return len(" ".join(parts).split())


def _prepare(raw):
    """Check one article. Return (prepared_article, None) or (None, message)."""
    if not isinstance(raw, dict):
        return None, "an entry is not a dictionary"

    slug = raw.get("slug")
    if not isinstance(slug, str) or not SLUG_RE.match(slug) or len(slug) > 100:
        return None, "slug %r must use lowercase letters, numbers and hyphens" % (slug,)

    for key in ("title", "description", "category"):
        if not _is_text(raw.get(key)):
            return None, "article %r is missing %s" % (slug, key)

    palette = raw.get("palette")
    if not (isinstance(palette, list) and len(palette) == 3 and all(isinstance(c, str) and HEX_RE.match(c) for c in palette)):
        return None, "article %r needs a palette of three hex colours like #aabbcc" % slug

    body = raw.get("body")
    if not isinstance(body, list) or not body:
        return None, "article %r has an empty body" % slug
    for block in body:
        problem = _check_block(block)
        if problem:
            return None, "article %r: %s" % (slug, problem)

    cover_image = raw.get("cover_image")
    if cover_image is not None:
        if not (isinstance(cover_image, str) and IMAGE_RE.match(cover_image)
                and ".." not in cover_image and not cover_image.startswith("/")):
            return None, "article %r has an unsafe cover_image path" % slug

    try:
        published = datetime.strptime(raw.get("published", ""), "%Y-%m-%d")
    except (TypeError, ValueError):
        return None, "article %r needs published as YYYY-MM-DD" % slug

    # Give every h2 a stable id (used by the 'In this article' list).
    prepared_body = []
    headings = []
    used_ids = set()
    for block in body:
        block = dict(block)
        if block["type"] == "h2":
            base = slugify(block["text"]) or "section"
            heading_id = base
            counter = 2
            while heading_id in used_ids:
                heading_id = "%s-%d" % (base, counter)
                counter += 1
            used_ids.add(heading_id)
            block["id"] = heading_id
            headings.append({"id": heading_id, "text": block["text"]})
        prepared_body.append(block)

    words = sum(_block_words(b) for b in prepared_body)
    minutes = max(1, int(math.ceil(words / float(WORDS_PER_MINUTE))))

    category = raw["category"].strip()
    search_text = " ".join(
        [raw["title"], raw["description"], category] + [h["text"] for h in headings]
    ).lower()

    return {
        "slug": slug,
        "title": raw["title"].strip(),
        "description": raw["description"].strip(),
        "category": category,
        "category_slug": slugify(category),
        "published": raw["published"],
        "date_display": published.strftime("%d %b %Y").lstrip("0"),
        "featured": bool(raw.get("featured")),
        "palette": list(palette),
        "cover_image": cover_image,
        "cover_alt": raw.get("cover_alt", "") if isinstance(raw.get("cover_alt", ""), str) else "",
        "body": prepared_body,
        "headings": headings,
        "words": words,
        "reading_minutes": minutes,
        "search_text": search_text,
    }, None


def _load():
    prepared = []
    problems = []
    seen = set()
    for raw in ARTICLES:
        article, problem = _prepare(raw)
        if problem is None and article["slug"] in seen:
            problem = "duplicate slug %r" % article["slug"]
        if problem:
            problems.append(problem)
            logger.warning("Journal article skipped: %s", problem)
            continue
        seen.add(article["slug"])
        prepared.append(article)
    return prepared, problems


_PREPARED, PROBLEMS = _load()
_BY_SLUG = {a["slug"]: a for a in _PREPARED}


def get_articles():
    """All valid articles, newest first (ties keep the order written above)."""
    return sorted(_PREPARED, key=lambda a: a["published"], reverse=True)


def get_article(slug):
    return _BY_SLUG.get(slug)


def get_featured():
    articles = get_articles()
    for article in articles:
        if article["featured"]:
            return article
    return articles[0] if articles else None


def get_categories(articles=None):
    """Categories that really have articles, in CATEGORY_ORDER order."""
    articles = _PREPARED if articles is None else articles
    present = {}
    for article in articles:
        present[article["category"]] = article["category_slug"]
    ordered = [c for c in CATEGORY_ORDER if c in present]
    ordered += sorted(c for c in present if c not in CATEGORY_ORDER)
    return [{"name": name, "slug": present[name]} for name in ordered]


def get_related(article, limit=3):
    """Same category first, then the rest, never the article itself."""
    others = [a for a in get_articles() if a["slug"] != article["slug"]]
    same = [a for a in others if a["category"] == article["category"]]
    rest = [a for a in others if a["category"] != article["category"]]
    return (same + rest)[:limit]
