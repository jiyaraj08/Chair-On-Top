"""Shop links for the collection pages ("Shop This Style" and "Complete Your Space").

ALL the shopping links live in this one file. The templates only display what
is listed here (templates/partials/_shop.html), so to add, remove or change a
link you edit this file and nothing else.

HOW TO ADD OR CHANGE A LINK
---------------------------
Find the collection slug in SHOP_LINKS (for example "japandi") and add or edit
one block:

    {
        "category": "Japandi Furniture",   # the name shown on the card
        "store": "amazon",                  # amazon, flipkart or ikea (see STORES)
        "url": "https://www.amazon.in/s?k=...",
        "image": "japandi/img7",            # a gallery photograph: <slug>/img<N>
    },

The "image" is only a style-inspiration photograph from the gallery. If it is
missing the collection's cover photograph is used instead.

WHAT THIS FILE DELIBERATELY DOES NOT HAVE
-----------------------------------------
No product names, prices, ratings or availability. Those belong to the stores
and change all the time, so the cards only link out to the store's own page.
"""

import logging
from urllib.parse import urlparse

from content import gallery as gallery_store

logger = logging.getLogger(__name__)

# Store keys -> the label shown on the card, and the web hosts allowed for it.
STORES = {
    "amazon": {"label": "Amazon", "hosts": ("www.amazon.in", "amazon.in")},
    "flipkart": {"label": "Flipkart", "hosts": ("dl.flipkart.com", "www.flipkart.com", "flipkart.com")},
    "ikea": {"label": "IKEA", "hosts": ("www.ikea.com",)},
}

# ---------------------------------------------------------------------------
# Section wording
# ---------------------------------------------------------------------------
STYLE_SECTION = {
    "kicker": "{style} furniture",
    "title": "Shop This Style",
    "lead": "Ready to bring the look home? These links open the stores' own pages "
            "for {style} furniture and ideas.",
}

COMPLETE_SECTION = {
    "kicker": "Finishing touches",
    "title": "Complete Your Space",
    "lead": "Rugs and statement furniture that finish a room, whichever style you choose.",
}

DISCLOSURE = (
    "Links open the retailer's website in a new tab. Chair on Top does not show "
    "prices or product details; availability and pricing are set by each store."
)

# ---------------------------------------------------------------------------
# Links per collection (keys are the collection slugs from content/gallery.py)
# ---------------------------------------------------------------------------
SHOP_LINKS = {
    "japandi": [
        {
            "category": "Japandi Furniture",
            "store": "amazon",
            "url": "https://www.amazon.in/s?k=japandi+furniture&crid=2R3W3MZF3JDYO&sprefix=japandi+furniture%2Caps%2C371&ref=nb_sb_noss_1",
            "image": "japandi/img7",
        },
    ],
    "mid-century-modern": [
        {
            "category": "Mid-Century Furniture, Selection 1",
            "store": "flipkart",
            "url": "https://dl.flipkart.com/s/pH3bteuuuN",
            "image": "mid-century-modern/img2",
        },
        {
            "category": "Mid-Century Furniture, Selection 2",
            "store": "flipkart",
            "url": "https://dl.flipkart.com/s/3rE1CzNNNN",
            "image": "mid-century-modern/img9",
        },
    ],
    "minimalism": [
        {
            "category": "Minimalist Furniture",
            "store": "amazon",
            "url": "https://www.amazon.in/s?k=minimalism+furniture&crid=X8HNSP0YKPPW&sprefix=minimalist+furniture%2Caps%2C359&ref=nb_sb_noss_1",
            "image": "minimalism/img3",
        },
        {
            "category": "Minimalism Search",
            "store": "ikea",
            "url": "https://www.ikea.com/in/en/search/?q=minimalism",
            "image": "minimalism/img10",
        },
    ],
    "scandinavian": [
        {
            "category": "Scandinavian Furniture",
            "store": "amazon",
            "url": "https://www.amazon.in/s?k=scandinavian+furniture&crid=1B7ISU4P5JI20&sprefix=scandinavian+furniture%2Caps%2C842&ref=nb_sb_noss_1",
            "image": "scandinavian/img3",
        },
        {
            "category": "Scandinavian Style Ideas",
            "store": "ikea",
            "url": "https://www.ikea.com/in/en/ideas/styles/scandinavian/",
            "image": "scandinavian/img10",
        },
    ],
    "industrial": [
        {
            "category": "Industrial Furniture",
            "store": "amazon",
            "url": "https://www.amazon.in/s?k=industrial+furniture&crid=14M3XC05BR2B4&sprefix=industrial+furniture%2Caps%2C349&ref=nb_sb_noss_1",
            "image": "industrial/img2",
        },
        {
            "category": "Modern Style Ideas",
            "store": "ikea",
            "url": "https://www.ikea.com/in/en/ideas/styles/modern/",
            "image": "industrial/img7",
        },
        {
            "category": "Industrial Search",
            "store": "ikea",
            "url": "https://www.ikea.com/in/en/search/?q=industrial",
            "image": "industrial/img12",
        },
    ],
    "indian-deco": [
        {
            "category": "Traditional Furniture",
            "store": "amazon",
            "url": "https://www.amazon.in/s?k=traditional+furniture&crid=27I3VY0OXX44M&sprefix=traditional+furniture%2Caps%2C1047&ref=nb_sb_noss_2",
            "image": "indian-deco/img2",
        },
        {
            "category": "Indian Décor Search",
            "store": "ikea",
            "url": "https://www.ikea.com/in/en/search/?q=indian%20decor&page=2",
            "image": "indian-deco/img9",
        },
    ],
    "bohemian": [
        {
            "category": "Bohemian Furniture",
            "store": "amazon",
            "url": "https://www.amazon.in/s?k=bohemian+furniture&crid=3TMQBMHIKNM0W&sprefix=bohemian+furniture%2Caps%2C441&ref=nb_sb_noss_1",
            "image": "bohemian/img6",
        },
    ],
    "transitional": [
        {
            "category": "European Furniture",
            "store": "amazon",
            "url": "https://www.amazon.in/s?k=european+furniture&crid=294OYEJOVH46V&sprefix=european+fur%2Caps%2C1052&ref=nb_sb_ss_mvt-t11-ranker_1_12",
            "image": "transitional/img6",
        },
        {
            "category": "Dining Room Inspiration",
            "store": "ikea",
            "url": "https://www.ikea.com/in/en/rooms/dining/gallery/a-dining-room-in-a-small-modern-studio-apartment-with-a-cool-urban-vibe-pub74fa0fb0/",
            "image": "transitional/img5",
        },
    ],
}

# Shown on every collection page, after the style links.
COMPLETE_LINKS = [
    {
        "category": "Carpets & Rugs",
        "store": "amazon",
        "url": "https://www.amazon.in/s?k=carpets&crid=3BIESDT93XR5Z&sprefix=carpets%2Caps%2C665&ref=nb_sb_noss_2",
        "image": "bohemian/img15",
    },
    {
        "category": "European Furniture",
        "store": "amazon",
        "url": "https://www.amazon.in/s?k=european+furniture&crid=294OYEJOVH46V&sprefix=european+fur%2Caps%2C1052&ref=nb_sb_ss_mvt-t11-ranker_1_12",
        "image": "transitional/img7",
    },
]


# ---------------------------------------------------------------------------
# Everything below prepares the data for the template. You do not need to edit it.
# ---------------------------------------------------------------------------
def _image_lookup():
    return {
        img["id"]: img["path"]
        for c in gallery_store.get_collections()
        for img in c["images"]
    }


def _safe_url(store_key, url):
    """Only https links to the store's own hosts are ever shown."""
    store = STORES.get(store_key)
    if not store or not isinstance(url, str):
        return False
    parsed = urlparse(url)
    return parsed.scheme == "https" and parsed.hostname in store["hosts"]


def _prepare(entries, images, fallback_path):
    cards = []
    for entry in entries:
        store_key = entry.get("store")
        if not _safe_url(store_key, entry.get("url")):
            logger.warning("Shop links: %r skipped (unknown store or unsafe link)", entry.get("category"))
            continue
        path = images.get(entry.get("image"))
        if path is None:
            logger.warning("Shop links: image %r not found for %r, using the cover", entry.get("image"), entry.get("category"))
            path = fallback_path
        cards.append({
            "category": entry["category"],
            "store": STORES[store_key]["label"],
            "store_key": store_key,
            "url": entry["url"],
            "image": path,
        })
    return cards


def get_style_section(collection):
    """The "Shop This Style" data for one collection (a dict from content/gallery.py), or None."""
    entries = SHOP_LINKS.get(collection["slug"], [])
    cover = collection.get("cover") or {}
    cards = _prepare(entries, _image_lookup(), cover.get("path"))
    if not cards:
        return None
    return {
        "id": "shop-style",
        "kicker": STYLE_SECTION["kicker"].format(style=collection["name"]),
        "title": STYLE_SECTION["title"],
        "lead": STYLE_SECTION["lead"].format(style=collection["name"]),
        "items": cards,
        "note": DISCLOSURE,
        "band": False,
    }


def get_complete_section(collection):
    """The shared "Complete Your Space" data, or None."""
    cover = collection.get("cover") or {}
    cards = _prepare(COMPLETE_LINKS, _image_lookup(), cover.get("path"))
    if not cards:
        return None
    return {
        "id": "shop-complete",
        "kicker": COMPLETE_SECTION["kicker"],
        "title": COMPLETE_SECTION["title"],
        "lead": COMPLETE_SECTION["lead"],
        "items": cards,
        "note": None,
        "band": True,
    }
