"""Discovery for Chair on Top: the Explore feed and related photographs.

WHAT THIS FILE DOES
-------------------
  explore(...)   A query-free, mixed feed of every photograph (for /explore).
  related(...)   Related photographs for the image viewer.
  categories()   Real shortcuts for the Explore page (styles and hand-picked searches).

It only reads the gallery catalogue (content/gallery.py) and the verified facts
(content/image_meta.py). It never invents a fact about a photograph.

RELATED PHOTOGRAPHS - WHAT IS AND IS NOT CLAIMED
------------------------------------------------
  * "More from <style>": other photographs in the same collection. True by definition.
  * "Related styles": a hand-written list of styles that sit well together
    (RELATED_STYLES below). This is CURATED EDITORIAL GUIDANCE by Chair on Top.
    It is NOT a measurement of how similar two photographs look, and the page
    says so.
  * "Shares checked details": only when a photograph has checked facts in
    IMAGE_META (room, colours, materials, tags). Today IMAGE_META is empty, so
    this group stays empty and is never shown.

FUTURE-READY (NOT IMPLEMENTED ON PURPOSE)
-----------------------------------------
Popular searches, trending collections, search analytics and personalised
recommendations are deliberately NOT built. Nothing here records what visitors
search or view. If they are added later, they must only ever show real recorded
data, and a new, separate module should own that (so this file stays pure
catalogue logic). A clean place to plug in later: explore(), which already
returns a ranked list, and categories(), which already returns display groups.
"""

from content import gallery as gallery_store
from content import image_meta
from content import search as search_store

DEFAULT_LIMIT = 24
MAX_LIMIT = 48
SAME_COLLECTION_COUNT = 8
STYLE_PREVIEW_COUNT = 4
FACT_MATCH_COUNT = 6

# Curated by Chair on Top. Keys and values are collection slugs.
RELATED_STYLES = {
    "japandi": ["scandinavian", "minimalism"],
    "mid-century-modern": ["transitional", "industrial"],
    "scandinavian": ["japandi", "minimalism"],
    "minimalism": ["japandi", "scandinavian"],
    "industrial": ["mid-century-modern", "bohemian"],
    "indian-deco": ["transitional", "bohemian"],
    "bohemian": ["indian-deco", "industrial"],
    "transitional": ["mid-century-modern", "indian-deco"],
}

CURATED_NOTE = (
    "Curated style recommendations by Chair on Top. They suggest styles that "
    "sit well together; they are not a measurement of how similar the photographs look."
)


def related_style_slugs(slug):
    """Curated related collections for a style (only ones that exist)."""
    known = {c["slug"] for c in gallery_store.get_collections()}
    return [s for s in RELATED_STYLES.get(slug, []) if s in known and s != slug]


def _wrap(collection, order, image):
    """The shape search_store.public_result() expects."""
    return {
        "image": image,
        "slug": collection["slug"],
        "style": collection["name"],
        "order": order,
        "score": 0,
        "reasons": [],
    }


def _clean_paging(offset, limit):
    try:
        offset = int(offset)
        limit = int(limit)
    except (TypeError, ValueError):
        raise search_store.QueryError("invalid_paging", "The page position could not be read.")
    if offset < 0 or limit < 1:
        raise search_store.QueryError("invalid_paging", "The page position could not be read.")
    return offset, min(limit, MAX_LIMIT)


# ---------------------------------------------------------------------------
# Explore feed
# ---------------------------------------------------------------------------
def _feed(styles):
    """Every photograph, interleaved across collections (photo 1 of each style,
    then photo 2 of each, ...) so the first screen shows all the styles.
    The order is fixed, so paging with an offset is stable."""
    collections = gallery_store.get_collections()
    wanted = set(styles or [])
    chosen = [(i, c) for i, c in enumerate(collections) if not wanted or c["slug"] in wanted]
    rows = []
    for order, collection in chosen:
        for image in collection["images"]:
            rows.append((image["number"], order, _wrap(collection, order, image)))
    rows.sort(key=lambda row: (row[0], row[1]))
    return [row[2] for row in rows]


def explore(offset=0, limit=DEFAULT_LIMIT, styles=None, sort="mixed",
            room=None, color=None, material=None):
    """One page of the Explore feed. Same JSON shape as a search response."""
    offset, limit = _clean_paging(offset, limit)
    styles = search_store.clean_styles(styles)
    if sort in (None, "", "mixed"):
        sort = "mixed"
    else:
        sort = search_store.clean_sort(sort, default="mixed")

    everything = _feed([])
    facets = search_store.build_facets(everything)
    items = search_store.filter_results(_feed(styles), None, room, color, material)
    if sort == "relevance":
        sort = "mixed"  # no query, so "relevance" is just the mixed order
    if sort != "mixed":
        items = search_store.sort_results(items, sort)

    total = len(items)
    page = items[offset:offset + limit]
    end = offset + len(page)
    sorts = [{"value": "mixed", "label": "Mixed"}] + [
        o for o in search_store.available_sorts() if o["value"] != "relevance"
    ]
    return {
        "query": "",
        "total": total,
        "offset": offset,
        "limit": limit,
        "count": len(page),
        "has_more": end < total,
        "next_offset": end if end < total else None,
        "previous_offset": max(0, offset - limit) if offset > 0 else None,
        "sort": sort,
        "sorts": sorts,
        "filters": {"styles": styles, "room": room or "", "color": color or "", "material": material or ""},
        "unfiltered_total": len(everything),
        "facets": facets,
        "results": [search_store._public(r) for r in page],
        "_raw": page,  # for templates only
    }


def categories():
    """Shortcuts for the Explore page. Everything here is real and clickable."""
    collections = gallery_store.get_collections()
    styles = [
        {
            "slug": c["slug"],
            "name": c["name"],
            "count": c["count"],
            "description": c["description"],
            "cover": c["cover"],
        }
        for c in collections
    ]
    searches = [
        {"label": item["label"], "kind": item["kind"], "url": "/search?q=" + item["label"].replace(" ", "+")}
        for item in image_meta.CURATED_SEARCHES
        if item["kind"] in ("material", "colour")
    ]
    for entry in searches:
        try:
            entry["count"] = search_store.search(entry["label"])["total"]
        except search_store.QueryError:
            entry["count"] = 0
    return {"styles": styles, "searches": [e for e in searches if e["count"]]}


# ---------------------------------------------------------------------------
# Related photographs
# ---------------------------------------------------------------------------
def _find(slug, key):
    collection = gallery_store.get_collection(slug)
    if collection is None:
        return None, None, None
    for order, c in enumerate(gallery_store.get_collections()):
        if c["slug"] == slug:
            break
    for image in collection["images"]:
        if image["key"] == key:
            return collection, order, image
    return None, None, None


def _card(collection, order, image):
    return search_store._public(_wrap(collection, order, image))


def _shared_facts(image):
    """(room, colours, materials, tags) as normalised sets: checked facts only."""
    meta = image.get("meta") or {}
    norm = search_store.normalize
    return (
        {norm(meta["room"])} if isinstance(meta.get("room"), str) else set(),
        {norm(v) for v in meta.get("colors", [])},
        {norm(v) for v in meta.get("materials", [])},
        {norm(v) for v in meta.get("tags", [])},
    )


def related(slug, key):
    """Related photographs for one photograph, or None if it does not exist."""
    collection, order, image = _find(slug, key)
    if image is None:
        return None
    collections = gallery_store.get_collections()

    # 1. More from the same collection: the photographs that follow this one,
    #    wrapping round, so every photograph gets a different list.
    images = collection["images"]
    start = images.index(image)
    around = [images[(start + step) % len(images)] for step in range(1, len(images))]
    same = [_card(collection, order, i) for i in around[:SAME_COLLECTION_COUNT]]

    # 2. Curated related styles (editorial, NOT image similarity).
    related_styles = []
    for related_slug in related_style_slugs(slug):
        other_order = next(i for i, c in enumerate(collections) if c["slug"] == related_slug)
        other = collections[other_order]
        # Same photograph number first, so the choice is stable and varied.
        picks = [other["images"][(image["number"] - 1 + step) % len(other["images"])]
                 for step in range(min(STYLE_PREVIEW_COUNT, len(other["images"])))]
        related_styles.append({
            "slug": other["slug"],
            "name": other["name"],
            "url": "/gallery/" + other["slug"],
            "images": [_card(other, other_order, i) for i in picks],
        })

    # 3. Shares checked details. Empty until IMAGE_META has entries.
    facts = _shared_facts(image)
    shared = []
    if any(facts):
        scored = []
        for other_order, other in enumerate(collections):
            for candidate in other["images"]:
                if candidate["id"] == image["id"]:
                    continue
                theirs = _shared_facts(candidate)
                overlap = sum(len(a & b) for a, b in zip(facts, theirs))
                if overlap:
                    scored.append((-overlap, other_order, candidate["number"], other, candidate))
        scored.sort(key=lambda row: row[:3])
        shared = [_card(row[3], row[1], row[4]) for row in scored[:FACT_MATCH_COUNT]]

    return {
        "id": image["id"],
        "style": collection["name"],
        "style_slug": collection["slug"],
        "same_collection": same,
        "related_styles": related_styles,
        "related_styles_note": CURATED_NOTE,
        "shared_details": shared,
        "shared_details_note": "These photographs share checked details (room, colour, material or tag).",
    }
