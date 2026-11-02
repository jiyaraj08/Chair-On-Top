"""Verified metadata that search can use.

TWO LEVELS
----------
1. STYLE_META: facts about each of the six styles (Japandi, Mid-Century Modern,
   Scandinavian, Minimalism, Industrial, Indian Deco). Search treats them as true
   for every photograph in that style's collection. They are copied from the style cards on the
   homepage (templates/index.html): the colour names, the materials and the
   short descriptions.

   PLEASE CONFIRM: the Mid-Century Modern card text and the Minimalism
   collection description were written while the homepage and gallery were
   being updated, so they are worth a quick read.

   Industrial and Indian Deco have NO colour or material facts on purpose:
   nobody has checked those photographs yet. Their entries hold only the
   names a visitor may type (aliases) and one short collection-level line.
   Colour and material searches therefore do not match these two collections
   until real, checked facts are added.

2. IMAGE_META: facts about ONE photograph. It is EMPTY on purpose. Nothing here
   may be guessed. When each photograph has been looked at and checked, add an
   entry, for example:

       IMAGE_META = {
           "japandi/img3": {
               "title": "Low sofa beside a paper lantern",
               "room": "living room",
               "colors": ["beige", "brown"],
               "materials": ["wood", "linen"],
               "tags": ["low furniture"],
               "description": "One short, accurate sentence.",
               "added": "2026-09-14",
           },
       }

   Every field is optional. A missing field simply means "no data": search then
   does not match on it and never pretends otherwise. Room, colour, material and
   tag matching, the title ranking and the "Newest/Oldest" sort all switch on by
   themselves as entries appear. Nothing else needs rebuilding.

   The image id is the same id the gallery, Saved Images and Moodboards use:
   "<collection-slug>/img<number>".
"""

import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 1. STYLE-LEVEL FACTS (keyed by collection slug, as in content/gallery.py)
#    "aliases" are other ways a visitor may type the style. They are for
#    understanding the query only; they are not claims about the photographs.
# ---------------------------------------------------------------------------
STYLE_META = {
    "japandi": {
        "aliases": ["japandi"],
        "mood": "Quiet warmth: Japanese simplicity with Scandinavian comfort.",
        "summary": (
            "Japandi mixes the calm order of Japanese design with the cosiness of Nordic homes. "
            "Expect low furniture, natural wood and earthy, muted colours."
        ),
        "materials": "Oak and ash wood, paper lanterns, wool, clay",
        "colors": ["Warm sand", "Muted olive", "Natural oak", "Soft cream"],
    },
    "mid-century-modern": {
        "aliases": ["mid century modern", "mid century", "midcentury", "mcm"],
        "mood": "Warm woods, sculptural lines and confident, timeless shapes.",
        "summary": (
            "Mid-Century Modern rooms pair warm wood with clean geometry and curved, sculptural furniture. "
            "A few bold accent colours keep the calm look lively."
        ),
        "materials": "Teak and walnut, leather, wool, brass",
        "colors": ["Warm cream", "Burnt orange", "Teak", "Mustard glow"],
    },
    "scandinavian": {
        "aliases": ["scandinavian", "scandi", "nordic"],
        "mood": "Bright, soft and practical, made for cosy daily life.",
        "summary": (
            "Scandinavian rooms use pale colours and natural light to feel open and welcoming. "
            "Furniture is simple, comfortable and built for everyday use."
        ),
        "materials": "Pale wood, wool, cotton, soft white paint",
        "colors": ["Snow white", "Soft blue-grey", "Birch", "Candle cream"],
    },
    "minimalism": {
        "aliases": ["minimalism", "minimalist", "minimal", "minimalistic"],
        "mood": "Calm, clear and uncluttered. Every object earns its place.",
        "summary": (
            "Minimalism relies on open space, simple shapes and a few well-chosen pieces. "
            "The result feels quiet and is easy to keep tidy."
        ),
        "materials": "Matte paint, light wood, linen, simple metal",
        "colors": ["Soft white", "Stone grey", "Pale oak", "Warm white"],
    },
    "industrial": {
        "aliases": ["industrial"],
        "mood": "Raw, utilitarian interiors with the honest character of working buildings.",
    },
    "indian-deco": {
        "aliases": ["indian deco", "indian decor", "indian"],
        "mood": "Interiors shaped by Indian decorative traditions and design sensibility.",
    },
}

# ---------------------------------------------------------------------------
# 2. PHOTOGRAPH-LEVEL FACTS (empty until each photograph has been checked)
# ---------------------------------------------------------------------------
IMAGE_META = {}

# Fields an entry may contain. Anything else is reported at start-up.
ALLOWED_FIELDS = {"title", "room", "colors", "materials", "tags", "description", "added"}
LIST_FIELDS = {"colors", "materials", "tags"}

# ---------------------------------------------------------------------------
# 3. CURATED SEARCHES shown when the search box is empty.
#    These are hand-picked by Chair on Top. They are NOT live trends, and
#    nothing here counts how often anything is searched.
#    Every term below must match real data (it is checked when the tests run).
# ---------------------------------------------------------------------------
CURATED_SEARCHES = [
    {"label": "Japandi", "kind": "style"},
    {"label": "Mid-Century Modern", "kind": "style"},
    {"label": "Scandinavian", "kind": "style"},
    {"label": "Minimalism", "kind": "style"},
    {"label": "Industrial", "kind": "style"},
    {"label": "Indian Deco", "kind": "style"},
    {"label": "Wood", "kind": "material"},
    {"label": "Wool", "kind": "material"},
    {"label": "White", "kind": "colour"},
    {"label": "Cream", "kind": "colour"},
]


def get_image_meta(image_id):
    """The checked facts for one photograph, or an empty dict."""
    entry = IMAGE_META.get(image_id)
    return entry if isinstance(entry, dict) else {}


def problems(known_image_ids):
    """List anything wrong with IMAGE_META (unknown id, unknown field, bad type)."""
    found = []
    known = set(known_image_ids)
    for image_id, entry in IMAGE_META.items():
        if image_id not in known:
            found.append("%s: no such image in the gallery" % image_id)
            continue
        if not isinstance(entry, dict):
            found.append("%s: entry must be a dict" % image_id)
            continue
        for field, value in entry.items():
            if field not in ALLOWED_FIELDS:
                found.append("%s: unknown field %r" % (image_id, field))
            elif field in LIST_FIELDS and not (isinstance(value, list) and all(isinstance(v, str) for v in value)):
                found.append("%s: %s must be a list of text" % (image_id, field))
            elif field not in LIST_FIELDS and not isinstance(value, str):
                found.append("%s: %s must be text" % (image_id, field))
    return found
