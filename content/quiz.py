"""Find My Aesthetic quiz: ALL quiz content and scoring rules live in this file.

HOW IT WORKS
------------
* The quiz has 12 questions with 4 answers each.
* Every answer gives points to up to three of the eight styles:
      3 points = the style this answer is mainly about
      2 points = a close relative
      1 point  = a loose relative
  (see opt() below). The browser (static/js/quiz.js) adds the points up.
* The style with the most points is the main result, the next is the second.
  Ties are settled the same way every time (see TIE-BREAKS below).
* No randomness, no AI service, nothing is sent anywhere.

HOW TO CHANGE THE SCORING
-------------------------
Edit the opt(...) lines in QUESTIONS. The page checks every image id against the
real gallery, so a typo can never show a broken picture: an unknown id is logged
and that answer simply shows a plain panel instead.

FAIRNESS (kept true by the way the answers are written)
-------------------------------------------------------
Each style is the 3-point choice in exactly 6 answers, the 2-point choice in 6
and the 1-point choice in 6. The most a style can earn differs a little (25 to
28). The results page draws every score bar on one common scale (the highest maximum, 28).
Run `python -m content.quiz` to print this check.

TIE-BREAKS (in this order)
--------------------------
1. More total points wins.
2. If level, the style that was the 3-point choice in more of the chosen answers.
3. If still level, the style that comes first in STYLE_ORDER below.
"""

import logging

from content import gallery as gallery_store

logger = logging.getLogger(__name__)

# The eight styles, in tie-break order. These are the real gallery collection slugs.
STYLE_ORDER = [
    "japandi",
    "mid-century-modern",
    "scandinavian",
    "minimalism",
    "industrial",
    "indian-deco",
    "bohemian",
    "transitional",
]

# Bump this when questions change, so an old saved quiz in a visitor's browser is
# discarded instead of being mixed with new questions.
QUIZ_VERSION = "1"


def opt(title, text, weights, image=None, swatches=None):
    """One answer. weights = (3-point style, 2-point style, 1-point style)."""
    first, second, third = weights
    return {
        "title": title,
        "text": text,
        "weights": {first: 3, second: 2, third: 1},
        "image": image,  # a gallery image id such as "japandi/img4", or None
        "swatches": swatches or [],
    }


J, M, S, N, I, D, B, T = STYLE_ORDER

QUESTIONS = [
    {
        "id": "atmosphere",
        "heading": "What kind of atmosphere would you love to come home to?",
        "support": "Imagine the moment you close the front door behind you.",
        "options": [
            opt("A quiet sanctuary", "Soft, still and uncluttered, a place to breathe out.", (J, I, N), "japandi/img4"),
            opt("Bright and welcoming", "Light-filled and easy the moment you walk in.", (S, J, N), "scandinavian/img14"),
            opt("Rich and full of warmth", "Textured, colourful and made for gathering.", (D, M, T), "indian-deco/img4"),
            opt("Raw and full of character", "Open, urban and honest about how it is built.", (I, N, B), "industrial/img13"),
        ],
    },
    {
        "id": "palette",
        "heading": "Which colour palette attracts you the most?",
        "support": "Go with your first instinct.",
        "options": [
            opt("Chalk, stone and charcoal", "Quiet neutrals with one dark accent.", (N, S, J), "minimalism/img9", ["#ede9e1", "#bdb5a8", "#2b2a28"]),
            opt("Mustard, teal and walnut", "Warm woods with confident retro colour.", (M, S, D), "mid-century-modern/img7", ["#c9962e", "#2f6e6b", "#6b4226"]),
            opt("Plum, terracotta and saffron", "Jewel tones layered without rules.", (B, T, I), "bohemian/img12", ["#6b2d5c", "#c4623f", "#e3a72f"]),
            opt("Deep green, oxblood and brass", "Classic colours with a modern edge.", (T, B, D), "transitional/img6", ["#2e4a3b", "#6a1f2b", "#b08d57"]),
        ],
    },
    {
        "id": "living-room",
        "heading": "Which living room would you choose?",
        "support": "Pick the room you would happily spend every evening in.",
        "options": [
            opt("Low, clean and calm", "A few soft, sculptural pieces in a pared-back room.", (N, I, S), "minimalism/img12"),
            opt("Retro, sociable and expressive", "A statement sofa, graphic art and warm light.", (M, J, B), "mid-century-modern/img2"),
            opt("Leather, steel and big art", "A confident, grown-up loft feel.", (I, B, J), "industrial/img7"),
            opt("Cushions, plants and pattern", "A collected corner you could curl up in for hours.", (B, T, I), "bohemian/img10"),
        ],
    },
    {
        "id": "furniture",
        "heading": "What type of furniture do you prefer?",
        "support": "Think about the pieces you would invest in.",
        "options": [
            opt("Low, handcrafted and natural", "Solid wood and simple forms made with care.", (J, I, N), "japandi/img11"),
            opt("Light, practical and comfortable", "Easy pieces in simple wood and woven textures.", (S, D, N), "scandinavian/img2"),
            opt("A mix of old and new", "An antique cabinet beside a modern sofa.", (T, M, D), "transitional/img7"),
            opt("Carved, handmade and woven", "Carved wood and cane with a hand-finished look.", (D, T, B), "indian-deco/img8"),
        ],
    },
    {
        "id": "materials",
        "heading": "Which material combination feels most appealing?",
        "support": "Imagine touching these surfaces every day.",
        "options": [
            opt("Timber, linen and paper", "Soft, natural and gently worn.", (J, M, S), "japandi/img13"),
            opt("Plaster, wood and ceramic", "Matte textures with nothing shiny to distract.", (N, I, J), "minimalism/img2"),
            opt("Concrete, leather and metal", "Tough surfaces that look better with age.", (I, J, M), "industrial/img11"),
            opt("Carved wood, cane and rich fabric", "Warm, tactile and full of craft.", (D, S, B), "indian-deco/img13"),
        ],
    },
    {
        "id": "decoration",
        "heading": "How much decoration do you like?",
        "support": "Be honest about how much you enjoy having things on display.",
        "options": [
            opt("Almost none", "Empty surfaces and room to breathe.", (N, S, I), "minimalism/img1"),
            opt("A few chosen things", "A plant, a lamp and one thing you love.", (S, T, M), "scandinavian/img15"),
            opt("Curated and considered", "Art, books and objects arranged with intent.", (T, S, D), "transitional/img9"),
            opt("Layered, collected and abundant", "Every wall and shelf tells a story.", (B, D, I), "bohemian/img7"),
        ],
    },
    {
        "id": "lighting",
        "heading": "Which lighting would you prefer?",
        "support": "Evenings are when a room really shows its character.",
        "options": [
            opt("Soft paper lanterns", "Diffused, gentle light with no harsh edges.", (J, N, S), "japandi/img3"),
            opt("Sculptural globe lamps", "Pendants and lamps that are objects in themselves.", (M, T, S), "mid-century-modern/img14"),
            opt("Ornate, decorative fittings", "Carved and metalwork lanterns that cast patterned light.", (D, B, T), "indian-deco/img1"),
            opt("Exposed bulbs and bold fixtures", "Light that looks as if it belongs in a workshop.", (I, B, N), "industrial/img9"),
        ],
    },
    {
        "id": "bedroom",
        "heading": "What kind of bedroom would help you relax?",
        "support": "Think about the last thing you see at night.",
        "options": [
            opt("Light and uncomplicated", "A simple wood bed, soft linen and plenty of air.", (S, J, T), "scandinavian/img12"),
            opt("Warm wood and soft green", "Timber walls, a low bed and a calm mood.", (M, S, D), "mid-century-modern/img15"),
            opt("Cosy, colourful and layered", "Throws, cushions and patterns all around.", (B, D, I), "bohemian/img6"),
            opt("Characterful and elegant", "A statement headboard with art close by.", (T, M, B), "transitional/img3"),
        ],
    },
    {
        "id": "architecture",
        "heading": "Which architectural detail catches your attention?",
        "support": "The details you notice first say a lot.",
        "options": [
            opt("Latticed screens and filtered light", "Sliding screens and low, quiet geometry.", (J, N, S), "japandi/img14"),
            opt("Carved screens and decorative openings", "Intricate pattern and rich, layered detail.", (D, B, M), "indian-deco/img9"),
            opt("Steel-framed glass and open space", "Big windows and honest structure.", (I, N, B), "industrial/img3"),
            opt("Tall painted doors and patterned floors", "Period details with a fresh colour.", (T, M, D), "transitional/img13"),
        ],
    },
    {
        "id": "personality",
        "heading": "How would you describe your personality?",
        "support": "Choose the one a close friend would pick.",
        "options": [
            opt("Easygoing and practical", "You like things simple, bright and comfortable.", (S, T, M)),
            opt("Focused and disciplined", "You prefer clarity, order and less noise.", (N, M, J)),
            opt("Free-spirited and sociable", "You collect people, stories and souvenirs.", (B, I, T)),
            opt("Creative and nostalgic", "You love good design with a bit of history.", (M, J, S)),
        ],
    },
    {
        "id": "dining",
        "heading": "Which dining space would you choose?",
        "support": "Picture a long dinner with people you like.",
        "options": [
            opt("A long, quiet, sculptural table", "Simple lines and soft pendant light.", (N, I, J), "minimalism/img3"),
            opt("A big table in an open loft", "Part dining room, part studio.", (I, N, J), "industrial/img12"),
            opt("Round table, bold walls, playful floor", "Colour, art and a chequerboard floor.", (T, D, M), "transitional/img5"),
            opt("Bright and homely", "A simple table set for family and friends.", (S, D, N), "scandinavian/img6"),
        ],
    },
    {
        "id": "priority",
        "heading": "Imagine you are designing your dream home. What matters most?",
        "support": "If you could only protect one thing, which would it be?",
        "options": [
            opt("Calm and craftsmanship", "Every material feels natural and well made.", (J, N, I)),
            opt("Timeless design", "Iconic pieces that look better every decade.", (M, J, T)),
            opt("Heritage and warmth", "A home that feels rooted and welcoming to guests.", (D, B, M)),
            opt("Personal expression", "A home that looks like nobody else's.", (B, D, T)),
        ],
    },
]

# Pictures shown on the intro screen (real gallery images).
INTRO_IMAGES = ["japandi/img4", "bohemian/img10", "industrial/img12"]

# The result for each style. "hero" and "gallery" are real gallery image ids from
# that style's own collection. "traits" describe the STYLE in general; they are not
# claims about individual photographs.
PROFILES = {
    J: {
        "title": "The Calm Craftsperson",
        "summary": "You look for calm first and beauty second, and you trust natural materials to deliver both. Your ideal home is quiet and low to the ground, with warm wood, soft light and only objects that were made with care.",
        "traits": [
            ["Mood", "Serene, grounded and unhurried"],
            ["Palette", "Warm neutrals, muted earth tones and deep wood"],
            ["Materials", "Timber, paper, linen, ceramic"],
            ["Furniture", "Low, simple, well-made pieces"],
            ["Lighting", "Soft, diffused and warm"],
        ],
        "hero": "japandi/img4",
        "gallery": ["japandi/img3", "japandi/img5", "japandi/img9", "japandi/img11", "japandi/img13", "japandi/img14"],
    },
    M: {
        "title": "The Design Nostalgic",
        "summary": "You love a room with a story and a point of view. Warm wood, sculptural shapes and confident colour appeal to you, and you would rather own a few pieces with real personality than a lot of anonymous ones.",
        "traits": [
            ["Mood", "Warm, sociable and quietly playful"],
            ["Palette", "Walnut, mustard, teal and olive"],
            ["Materials", "Wood, glass, cane, tile"],
            ["Furniture", "Sculptural, graphic, long-lasting pieces"],
            ["Lighting", "Statement lamps and globe pendants"],
        ],
        "hero": "mid-century-modern/img11",
        "gallery": ["mid-century-modern/img2", "mid-century-modern/img7", "mid-century-modern/img10", "mid-century-modern/img12", "mid-century-modern/img14", "mid-century-modern/img15"],
    },
    S: {
        "title": "The Easy Optimist",
        "summary": "You want a home that feels light, useful and kind to live in. Comfort matters more to you than show, and you are happiest where daylight, simple wood and soft textures make everyday life feel easy.",
        "traits": [
            ["Mood", "Bright, relaxed and welcoming"],
            ["Palette", "Whites, soft neutrals and pale wood"],
            ["Materials", "Light wood, wool, linen, rattan"],
            ["Furniture", "Practical, comfortable, understated"],
            ["Lighting", "Natural daylight and warm lamps"],
        ],
        "hero": "scandinavian/img14",
        "gallery": ["scandinavian/img2", "scandinavian/img3", "scandinavian/img6", "scandinavian/img12", "scandinavian/img15", "scandinavian/img16"],
    },
    N: {
        "title": "The Quiet Editor",
        "summary": "You edit instinctively. You notice what a room does not need and you let space do the talking. Your ideal home is ordered and restful, with a small number of beautiful things, each one given room to breathe.",
        "traits": [
            ["Mood", "Calm, focused and uncluttered"],
            ["Palette", "Soft whites, stone, charcoal and one accent"],
            ["Materials", "Plaster, wood, stone, matte finishes"],
            ["Furniture", "Clean lines and very few pieces"],
            ["Lighting", "Soft, deliberate and often low"],
        ],
        "hero": "minimalism/img5",
        "gallery": ["minimalism/img3", "minimalism/img4", "minimalism/img7", "minimalism/img11", "minimalism/img12", "minimalism/img16"],
    },
    I: {
        "title": "The Urban Original",
        "summary": "You like things that are honest and a little unpolished. Exposed structure, strong materials and big windows appeal to you, and you prefer a home with attitude to one that tries too hard to be perfect.",
        "traits": [
            ["Mood", "Bold, open and full of character"],
            ["Palette", "Concrete grey, black, leather brown and rust"],
            ["Materials", "Concrete, steel, brick, worn leather"],
            ["Furniture", "Sturdy, practical, often vintage"],
            ["Lighting", "Exposed bulbs and statement fixtures"],
        ],
        "hero": "industrial/img12",
        "gallery": ["industrial/img3", "industrial/img5", "industrial/img7", "industrial/img11", "industrial/img13", "industrial/img15"],
    },
    D: {
        "title": "The Heritage Host",
        "summary": "You believe a home should feel rooted and generous. Craft, colour and pattern matter to you, and you enjoy rooms that welcome people in with carved wood, rich fabric and the warmth of things that have a past.",
        "traits": [
            ["Mood", "Warm, welcoming and richly layered"],
            ["Palette", "Deep reds, saffron, indigo and green"],
            ["Materials", "Carved wood, cane, brass, patterned tile"],
            ["Furniture", "Handcrafted, heirloom-style pieces"],
            ["Lighting", "Decorative lanterns and warm lamps"],
        ],
        "hero": "indian-deco/img4",
        "gallery": ["indian-deco/img1", "indian-deco/img7", "indian-deco/img9", "indian-deco/img11", "indian-deco/img13", "indian-deco/img16"],
    },
    B: {
        "title": "The Free-Spirited Collector",
        "summary": "You decorate with feeling, not rules. Your ideal home is layered with textiles, plants and objects gathered over time, and it feels personal, relaxed and a little bit different from anyone else's.",
        "traits": [
            ["Mood", "Relaxed, eclectic and personal"],
            ["Palette", "Jewel tones, earth colours and bold pattern"],
            ["Materials", "Woven textiles, rugs, wood, plants"],
            ["Furniture", "Mixed, collected and comfortable"],
            ["Lighting", "Lamps, lanterns and candlelight"],
        ],
        "hero": "bohemian/img10",
        "gallery": ["bohemian/img4", "bohemian/img6", "bohemian/img7", "bohemian/img8", "bohemian/img12", "bohemian/img16"],
    },
    T: {
        "title": "The Balanced Curator",
        "summary": "You like the best of both worlds. Classic shapes and modern ease, old pieces beside new ones, colour with restraint. Your ideal home feels polished but lived-in, and it keeps its charm as trends change.",
        "traits": [
            ["Mood", "Elegant, balanced and comfortable"],
            ["Palette", "Deep greens, warm neutrals, oxblood and brass"],
            ["Materials", "Wood, brass, stone, patterned tile"],
            ["Furniture", "A blend of traditional and contemporary"],
            ["Lighting", "Layered: chandeliers, sconces and lamps"],
        ],
        "hero": "transitional/img5",
        "gallery": ["transitional/img6", "transitional/img7", "transitional/img9", "transitional/img11", "transitional/img13", "transitional/img15"],
    },
}


def _catalog():
    """{image id: image dict} for every real gallery photograph."""
    out = {}
    for c in gallery_store.get_collections():
        for img in c["images"]:
            out[img["id"]] = img
    return out


def _image(catalog, image_id, where):
    """Public details of a REAL gallery image, or None (and a warning)."""
    if not image_id:
        return None
    img = catalog.get(image_id)
    if img is None:
        logger.warning("Quiz: image %r (%s) is not in the gallery. A plain panel is shown instead.", image_id, where)
        return None
    return {
        "id": img["id"],
        "src": "/static/" + img["path"],
        "width": img["width"],
        "height": img["height"],
        "alt": img["alt"],
        "number": img["number"],
        "key": img["key"],
        "slug": image_id.split("/")[0],
    }


def build():
    """Everything the quiz page needs, checked against the real gallery."""
    catalog = _catalog()
    collections = {c["slug"]: c for c in gallery_store.get_collections()}
    styles = []
    for slug in STYLE_ORDER:
        c = collections.get(slug)
        if c is None:
            logger.warning("Quiz: style %r has no gallery collection and cannot be shown.", slug)
            continue
        styles.append({"slug": slug, "name": c["name"], "description": c["description"], "count": c["count"]})
    available = {s["slug"] for s in styles}

    questions = []
    for q in QUESTIONS:
        options = []
        for index, o in enumerate(q["options"]):
            weights = {k: v for k, v in o["weights"].items() if k in available}
            options.append({
                "title": o["title"],
                "text": o["text"],
                "weights": weights,
                "swatches": o["swatches"],
                "image": _image(catalog, o["image"], "%s option %d" % (q["id"], index + 1)),
            })
        questions.append({"id": q["id"], "heading": q["heading"], "support": q["support"], "options": options})

    profiles = {}
    galleries = {}
    for slug, p in PROFILES.items():
        if slug not in available:
            continue
        coll = collections[slug]
        hero = _image(catalog, p["hero"], slug + " hero") or _image(catalog, coll["images"][0]["id"], slug + " hero fallback")
        tiles = [_image(catalog, i, slug + " gallery") for i in p["gallery"]]
        tiles = [t for t in tiles if t]
        if len(tiles) < 6:  # top up with real images from the same collection
            used = {t["id"] for t in tiles} | {hero["id"] if hero else ""}
            for img in coll["images"]:
                if len(tiles) >= 6:
                    break
                if img["id"] not in used:
                    tiles.append(_image(catalog, img["id"], slug + " gallery top-up"))
        profiles[slug] = {
            "title": p["title"],
            "summary": p["summary"],
            "traits": p["traits"],
            "hero": hero,
            "gallery": [t["id"] for t in tiles],
            "href": "/gallery/" + slug,
        }
        galleries[slug] = {"name": coll["name"], "images": [catalog[t["id"]] for t in tiles]}

    intro = [i for i in (_image(catalog, x, "intro") for x in INTRO_IMAGES) if i]

    return {
        "version": QUIZ_VERSION,
        "order": [s["slug"] for s in styles],
        "styles": styles,
        "questions": questions,
        "profiles": profiles,
        "intro": intro,
        "galleries": galleries,  # server-side only: used to render the result photos
    }


def public_json(data):
    """The part of build() that the browser needs (no server-only fields)."""
    return {k: v for k, v in data.items() if k != "galleries"}


if __name__ == "__main__":  # python -m content.quiz  -> prints the fairness check
    from collections import Counter

    counts = {slug: Counter() for slug in STYLE_ORDER}
    for q in QUESTIONS:
        assert len(q["options"]) == 4, q["id"]
        for o in q["options"]:
            for style, w in o["weights"].items():
                counts[style][w] += 1
    print("%-20s %6s %6s %6s %6s" % ("style", "3-pt", "2-pt", "1-pt", "max"))
    for slug in STYLE_ORDER:
        best = sum(max(o["weights"].get(slug, 0) for o in q["options"]) for q in QUESTIONS)
        print("%-20s %6d %6d %6d %6d" % (slug, counts[slug][3], counts[slug][2], counts[slug][1], best))
