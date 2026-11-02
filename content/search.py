"""Keyword search over the gallery catalogue.

WHAT IT SEARCHES
----------------
Only what the project really knows (see content/image_meta.py):
  * the style of each photograph (its collection),
  * verified style-level facts: colour names, materials and short descriptions,
  * photograph-level facts (title, room, colours, materials, tags), which are
    empty for now and start to count as soon as they are filled in.
It does not use AI, a database or any outside service. The gallery catalogue
(content/gallery.py) stays the single source of truth for images and paths.

HOW A RESULT IS RANKED (score per word typed, best match for that word)
-----------------------------------------------------------------------
  100  the whole query equals the photograph's VERIFIED title (added once).
       Photographs have no verified titles yet, so this scores nothing today.
       The display label "Japandi image 3" is NOT a title and never scores.
   80  the word is the style (or a spelling of it: "scandi")
   60  the word is the photograph's room                     (when tagged)
   50  the word is part of a style name ("century", "modern")
   45  the word is in a verified title (none yet)
   40  the word is a tag, colour or material
   20  the word appears in the style's description
  -10  if the match came through a "related word" (green -> olive)
  +25  every word typed was matched
Ties keep the gallery order (collection, then photograph number).

If some words match nothing (for example "living room", because no photograph is
tagged by room yet) the rest of the search still runs and a plain-language
notice says what could not be matched. Use strict=True to require every word.
"""

import re
import unicodedata
from functools import lru_cache
from urllib.parse import quote, quote_plus

from content import gallery as gallery_store
from content import image_meta

MAX_QUERY_LENGTH = 80
MIN_SUGGEST_LENGTH = 2
DEFAULT_LIMIT = 24
MAX_LIMIT = 48
MAX_SUGGESTIONS = 8

SCORE_TITLE = 100
SCORE_STYLE = 80
SCORE_ROOM = 60
SCORE_STYLE_PART = 50
SCORE_TITLE_WORD = 45
SCORE_FACET = 40  # tag, colour, material
SCORE_DESCRIPTION = 20
RELATED_PENALTY = 10
BONUS_ALL_MATCHED = 25

# Words that do not help find a photograph.
STOP_WORDS = {
    "a", "an", "the", "in", "for", "of", "and", "with", "to", "on", "at", "by", "or", "from",
    "my", "your", "our", "me", "some", "any", "inspiration", "inspirations", "ideas", "idea",
    "interior", "interiors", "design", "designs", "decor", "decoration", "home", "homes",
    "style", "styles", "look", "looks", "aesthetic", "aesthetics", "image", "images", "photo",
    "photos", "picture", "pictures", "colour", "colours", "color", "colors", "palette",
    "palettes", "room", "rooms", "space", "spaces", "furniture",
}

# Rooms: recognised so that we can say honestly when they cannot be matched.
ROOM_PHRASES = {
    ("living", "room"): "living room",
    ("dining", "room"): "dining room",
    ("home", "office"): "office",
    ("living",): "living room",
    ("bedroom",): "bedroom",
    ("kitchen",): "kitchen",
    ("bathroom",): "bathroom",
    ("office",): "office",
    ("dining",): "dining room",
}

# "Related words": other ways to say something that IS in the data.
# They only help a visitor's word find real data; they add no new facts.
RELATED = {
    "gray": ["grey"],
    "green": ["olive"],
    "beige": ["sand", "cream"],
    "wooden": ["wood"],
    "wood": ["oak", "ash", "teak", "walnut", "birch"],
    "tan": ["sand"],
}

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")


class QueryError(ValueError):
    """A search the visitor can fix. 'code' is stable, 'message' is friendly."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


# ---------------------------------------------------------------------------
# Text handling
# ---------------------------------------------------------------------------
def normalize(text):
    """Lower-case, strip accents, keep only letters and digits, single spaces."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text).split())


def stem(word):
    """Very small plural handling: woods -> wood, colours -> colour."""
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def words_of(text):
    return [stem(w) for w in normalize(text).split() if w]


def clean_query(raw):
    """Validate and tidy what the visitor typed. Raises QueryError."""
    if raw is None:
        raise QueryError("missing_query", "Type something to search for.")
    if not isinstance(raw, str):
        raise QueryError("invalid_query", "That search could not be read.")
    if len(raw) > 2000:
        raise QueryError("query_too_long", "That search is too long. Please use %d characters or fewer." % MAX_QUERY_LENGTH)
    text = " ".join(CONTROL_RE.sub(" ", raw).split())
    if not text:
        raise QueryError("empty_query", "Type something to search for.")
    if len(text) > MAX_QUERY_LENGTH:
        raise QueryError("query_too_long", "That search is too long. Please use %d characters or fewer." % MAX_QUERY_LENGTH)
    if not normalize(text):
        raise QueryError("no_searchable_text", "Please include some letters or numbers in your search.")
    return text


# ---------------------------------------------------------------------------
# The index (built once from the gallery catalogue)
# ---------------------------------------------------------------------------
def _split_phrases(text):
    return [p.strip() for p in re.split(r",| and ", text) if p.strip()]


@lru_cache(maxsize=1)
def _index():
    styles = []
    phrase_to_slug = {}
    for order, collection in enumerate(gallery_store.get_collections()):
        slug = collection["slug"]
        facts = image_meta.STYLE_META.get(slug, {})
        name_words = words_of(collection["name"])
        aliases = {normalize(collection["name"])} | {normalize(a) for a in facts.get("aliases", [])}
        colour_phrases = [normalize(c) for c in facts.get("colors", [])]
        material_phrases = [normalize(m) for m in _split_phrases(facts.get("materials", ""))]
        description_text = " ".join([collection["description"], facts.get("mood", ""), facts.get("summary", "")])
        style = {
            "order": order,
            "slug": slug,
            "name": collection["name"],
            "name_words": set(name_words),
            "aliases": aliases,
            "colour_words": {w for p in colour_phrases for w in words_of(p)},
            "colour_labels": list(facts.get("colors", [])),
            "material_words": {w for p in material_phrases for w in words_of(p)},
            "material_labels": [m.strip() for m in _split_phrases(facts.get("materials", ""))],
            "description_words": set(words_of(description_text)),
            "images": [],
        }
        for alias in aliases:
            phrase_to_slug[tuple(alias.split())] = slug
            phrase_to_slug[tuple(stem(w) for w in alias.split())] = slug
        for image in collection["images"]:
            meta = image.get("meta") or {}
            style["images"].append({
                "image": image,
                # Only a title someone has checked (IMAGE_META) may score. The generated
                # display label ("Japandi image 3") is deliberately left out.
                "title_norm": normalize(meta["title"]) if isinstance(meta.get("title"), str) else "",
                "room": normalize(meta.get("room", "")),
                "title_words": set(words_of(meta["title"])) if isinstance(meta.get("title"), str) else set(),
                "description_words": set(words_of(meta["description"])) if isinstance(meta.get("description"), str) else set(),
                "tags": {w for t in meta.get("tags", []) for w in words_of(t)},
                "colour_words": {w for c in meta.get("colors", []) for w in words_of(c)},
                "material_words": {w for m in meta.get("materials", []) for w in words_of(m)},
                "meta": meta,
            })
        styles.append(style)
    longest = max([len(k) for k in phrase_to_slug] or [1])
    by_slug = {s["slug"]: s for s in styles}
    return {"styles": styles, "by_slug": by_slug, "phrases": phrase_to_slug, "longest": longest}


def clear_cache():
    """Used by tests (and by anything that changes the catalogue at run time)."""
    _index.cache_clear()


# ---------------------------------------------------------------------------
# Reading a query
# ---------------------------------------------------------------------------
def parse_terms(text):
    """Turn clean text into terms: {"text", "kind": style|room|word, "slug"?}."""
    index = _index()
    tokens = normalize(text).split()
    terms = []
    i = 0
    while i < len(tokens):
        # 1. a style name or spelling (longest phrase first)
        matched = False
        for size in range(min(index["longest"], len(tokens) - i), 0, -1):
            chunk = tokens[i:i + size]
            slug = index["phrases"].get(tuple(chunk)) or index["phrases"].get(tuple(stem(w) for w in chunk))
            if slug:
                terms.append({"text": " ".join(tokens[i:i + size]), "kind": "style", "slug": slug})
                i += size
                matched = True
                break
        if matched:
            continue
        # 2. a room
        for size in (2, 1):
            key = tuple(tokens[i:i + size])
            if key in ROOM_PHRASES:
                terms.append({"text": ROOM_PHRASES[key], "kind": "room"})
                i += size
                matched = True
                break
        if matched:
            continue
        # 3. an ordinary word
        word = stem(tokens[i])
        if tokens[i] not in STOP_WORDS and word not in STOP_WORDS:
            terms.append({"text": word, "kind": "word"})
        i += 1
    unique = []
    seen = set()
    for term in terms:
        key = (term["kind"], term["text"])
        if key not in seen:
            seen.add(key)
            unique.append(term)
    return unique


def _candidates(term):
    """The word itself, then related words (which score a little less).

    Related words may lead on to more related words (wooden -> wood -> oak),
    so the lookup follows the chain once, never in circles.
    """
    out = [(term["text"], False)]
    if term["kind"] != "word":
        return out
    seen = {term["text"]}
    queue = [term["text"]]
    while queue:
        current = queue.pop(0)
        for other in RELATED.get(current, []):
            other = stem(other)
            if other not in seen:
                seen.add(other)
                out.append((other, True))
                queue.append(other)
    return out


def _match(style, entry, term, word, related):
    """Return (score, reason) for one word against one photograph, or (0, None)."""
    penalty = RELATED_PENALTY if related else 0
    if term["kind"] == "style":
        if style["slug"] == term["slug"]:
            return SCORE_STYLE, "Style: " + style["name"]
        return 0, None
    if term["kind"] == "room":
        if entry["room"] and entry["room"] == term["text"]:
            return SCORE_ROOM, "Room: " + term["text"]
        return 0, None
    # ordinary word
    if word in style["name_words"]:
        return SCORE_STYLE_PART - penalty, "Style: " + style["name"]
    if word in entry["title_words"]:
        return SCORE_TITLE_WORD - penalty, "Title word: " + word
    if word in entry["tags"]:
        return SCORE_FACET - penalty, "Tag: " + word
    if word in entry["colour_words"] or word in style["colour_words"]:
        label = next((c for c in style["colour_labels"] if word in words_of(c)), word)
        return SCORE_FACET - penalty, "Colour: " + label
    if word in entry["material_words"] or word in style["material_words"]:
        label = next((m for m in style["material_labels"] if word in words_of(m)), word)
        return SCORE_FACET - penalty, "Material: " + label
    if word in style["description_words"] or word in entry["description_words"]:
        return SCORE_DESCRIPTION - penalty, "Description"
    return 0, None


def _score(style, entry, terms, query_norm):
    total = 0
    reasons = []
    matched = set()
    for number, term in enumerate(terms):
        best = (0, None)
        for word, related in _candidates(term):
            result = _match(style, entry, term, word, related)
            if result[0] > best[0]:
                best = result
        if best[0] > 0:
            total += best[0]
            matched.add(number)
            if best[1] not in reasons:
                reasons.append(best[1])
    if terms and len(matched) == len(terms) and len(terms) > 1:
        total += BONUS_ALL_MATCHED
    if total and query_norm and entry["title_norm"] and entry["title_norm"] == query_norm:
        total += SCORE_TITLE
        reasons.insert(0, "Title")
    return total, reasons, matched


# ---------------------------------------------------------------------------
# Public: search
# ---------------------------------------------------------------------------
def _describe_unmatched(terms):
    rooms = [t["text"] for t in terms if t["kind"] == "room"]
    others = [t["text"] for t in terms if t["kind"] != "room"]
    parts = []
    if rooms:
        parts.append(
            "No photograph is tagged by room yet, so \u201c%s\u201d could not be matched." % "\u201d, \u201c".join(rooms)
        )
    if others:
        parts.append("Nothing in the catalogue matches \u201c%s\u201d." % "\u201d, \u201c".join(others))
    return " ".join(parts)


def _public(result):
    image = result["image"]
    slug = result["slug"]
    return {
        "id": image["id"],
        "style": result["style"],
        "style_slug": slug,
        "number": image["number"],
        "title": image["title"],
        "title_generated": not bool((image.get("meta") or {}).get("title")),  # True = display label only
        "path": image["path"],
        "url": "/static/" + image["path"],
        "width": image["width"],
        "height": image["height"],
        "gallery_url": "/gallery/%s?image=%s" % (slug, image["key"]),
        "score": result["score"],
        "reasons": result["reasons"],
    }


# ---------------------------------------------------------------------------
# Filters, sorting and facets (added for the Explore page)
# ---------------------------------------------------------------------------
SORT_LABELS = {
    "relevance": "Relevance",
    "collection": "Collection order",
    "newest": "Newest first",
    "oldest": "Oldest first",
}


def _has_dates():
    """True when at least one photograph has a checked 'added' date."""
    return any(
        isinstance((e["meta"] or {}).get("added"), str)
        for style in _index()["styles"] for e in style["images"]
    )


def available_sorts():
    """Sort options that can honestly be offered. Newest/Oldest need real dates."""
    keys = ["relevance", "collection"] + (["newest", "oldest"] if _has_dates() else [])
    return [{"value": k, "label": SORT_LABELS[k]} for k in keys]


def clean_styles(styles):
    """Keep only known collection slugs (an old or edited link must not break the page)."""
    known = _index()["by_slug"]
    out = []
    for value in styles or []:
        if isinstance(value, str) and SLUG_RE.match(value) and value in known and value not in out:
            out.append(value)
    return out


def clean_sort(sort, default="relevance"):
    if sort is None or sort == "":
        return default
    if sort not in SORT_LABELS:
        raise QueryError("invalid_sort", "That sort order is not available.")
    if sort in ("newest", "oldest") and not _has_dates():
        raise QueryError("invalid_sort", "That sort order is not available yet.")
    return sort


def _meta_of(result):
    return (result["image"].get("meta") or {})


def _same(a, b):
    return bool(a) and normalize(a) == normalize(b)


def filter_results(results, styles=None, room=None, color=None, material=None):
    """Apply the filters. Room, colour and material only match checked photograph facts."""
    styles = set(styles or [])
    out = []
    for r in results:
        meta = _meta_of(r)
        if styles and r["slug"] not in styles:
            continue
        if room and not _same(meta.get("room", ""), room):
            continue
        if color and not any(_same(c, color) for c in meta.get("colors", [])):
            continue
        if material and not any(_same(m, material) for m in meta.get("materials", [])):
            continue
        out.append(r)
    return out


def sort_results(results, sort):
    if sort == "collection":
        return sorted(results, key=lambda r: (r["order"], r["image"]["number"]))
    if sort in ("newest", "oldest"):
        dated = [r for r in results if isinstance(_meta_of(r).get("added"), str)]
        undated = [r for r in results if not isinstance(_meta_of(r).get("added"), str)]
        dated.sort(key=lambda r: (_meta_of(r)["added"], -r["order"]), reverse=(sort == "newest"))
        return dated + undated
    return results  # relevance: already ordered by score, then gallery order


def build_facets(results):
    """Counts for the filter bar, from the matched photographs only.

    Styles always exist. Rooms, colours and materials appear ONLY when checked
    photograph-level facts exist (content/image_meta.py IMAGE_META), so the bar
    never offers a filter that has no real data behind it.
    """
    index = _index()
    style_counts = {}
    rooms, colors, materials = {}, {}, {}

    def bump(bucket, label):
        key = normalize(label)
        if key:
            entry = bucket.setdefault(key, {"value": label, "label": label, "count": 0})
            entry["count"] += 1

    for r in results:
        style_counts[r["slug"]] = style_counts.get(r["slug"], 0) + 1
        meta = _meta_of(r)
        if isinstance(meta.get("room"), str):
            bump(rooms, meta["room"])
        for c in meta.get("colors", []):
            bump(colors, c)
        for m in meta.get("materials", []):
            bump(materials, m)

    def listed(bucket):
        return sorted(bucket.values(), key=lambda e: (-e["count"], e["label"].lower()))

    return {
        "styles": [
            {"slug": s["slug"], "name": s["name"], "count": style_counts.get(s["slug"], 0)}
            for s in index["styles"]
        ],
        "rooms": listed(rooms),
        "colors": listed(colors),
        "materials": listed(materials),
    }


def search(raw_query, offset=0, limit=DEFAULT_LIMIT, strict=False,
           styles=None, sort="relevance", room=None, color=None, material=None):
    """Run a search. Raises QueryError for a query the visitor can fix."""
    text = clean_query(raw_query)
    try:
        offset = int(offset)
        limit = int(limit)
    except (TypeError, ValueError):
        raise QueryError("invalid_paging", "The page position could not be read.")
    if offset < 0 or limit < 1:
        raise QueryError("invalid_paging", "The page position could not be read.")
    limit = min(limit, MAX_LIMIT)

    index = _index()
    terms = parse_terms(text)
    query_norm = normalize(text)
    results = []
    matched_numbers = set()  # which words matched anything at all (before strict filtering)

    if terms:
        for style in index["styles"]:
            for entry in style["images"]:
                score, reasons, matched = _score(style, entry, terms, query_norm)
                if score <= 0:
                    continue
                matched_numbers |= matched
                if strict and len(matched) != len(terms):
                    continue
                results.append({
                    "image": entry["image"],
                    "slug": style["slug"],
                    "style": style["name"],
                    "order": style["order"],
                    "score": score,
                    "reasons": reasons,
                })
    results.sort(key=lambda r: (-r["score"], r["order"], r["image"]["number"]))

    # Filters and sorting (all optional; the defaults leave the old behaviour unchanged).
    styles = clean_styles(styles)
    sort = clean_sort(sort)
    unfiltered_total = len(results)
    facets = build_facets(results)
    results = sort_results(filter_results(results, styles, room, color, material), sort)

    unmatched = [t for n, t in enumerate(terms) if n not in matched_numbers]
    if not terms:
        notice = "Try a style, colour or material, such as \u201cJapandi\u201d, \u201colive\u201d or \u201cwool\u201d."
    elif unmatched and results and not strict:
        notice = _describe_unmatched(unmatched) + " Showing results for the rest of your search."
    elif unmatched:
        notice = _describe_unmatched(unmatched)
    else:
        notice = ""

    total = len(results)
    page = results[offset:offset + limit]
    end = offset + len(page)
    return {
        "query": text,
        "total": total,
        "offset": offset,
        "limit": limit,
        "count": len(page),
        "has_more": end < total,
        "next_offset": end if end < total else None,
        "previous_offset": max(0, offset - limit) if offset > 0 else None,
        "strict": bool(strict),
        "terms": [t["text"] for t in terms],
        "unmatched": [t["text"] for t in unmatched],
        "notice": notice,
        "sort": sort,
        "sorts": available_sorts(),
        "filters": {"styles": styles, "room": room or "", "color": color or "", "material": material or ""},
        "unfiltered_total": unfiltered_total,
        "facets": facets,
        "results": [_public(r) for r in page],
        "_raw": page,  # for templates only; removed before JSON is sent
    }


def public(response):
    """The search response without template-only fields."""
    return {k: v for k, v in response.items() if not k.startswith("_")}


# ---------------------------------------------------------------------------
# Public: suggestions
# ---------------------------------------------------------------------------
def _count(label):
    try:
        return search(label)["total"]
    except QueryError:
        return 0


def _suggestion(label, kind, detail=""):
    return {
        "label": label,
        "kind": kind,
        "detail": detail,
        "url": "/search?q=" + quote_plus(label),
        "count": _count(label),
    }


def curated():
    """Hand-picked searches (not live trends). Each one has real results."""
    return [_suggestion(item["label"], item["kind"]) for item in image_meta.CURATED_SEARCHES]


def suggest(raw_query):
    """Live suggestions for what the visitor is typing.

    An empty query returns only the curated list. A query shorter than
    MIN_SUGGEST_LENGTH returns nothing. Every suggestion leads to real results.
    """
    if raw_query is None or not str(raw_query).strip():
        return {
            "query": "",
            "suggestions": [],
            "curated": curated(),
            "curated_note": "Hand-picked by Chair on Top. These are suggestions, not live trends.",
        }
    text = clean_query(raw_query)
    norm = normalize(text)
    if len(norm) < MIN_SUGGEST_LENGTH:
        return {"query": text, "suggestions": [], "curated": []}

    index = _index()
    out = []
    seen = set()

    def add(label, kind, detail="", url=None):
        key = (label.lower(), kind)
        if key in seen or len(out) >= MAX_SUGGESTIONS:
            return
        item = _suggestion(label, kind, detail) if url is None else {
            "label": label, "kind": kind, "detail": detail, "url": url, "count": None}
        if url is None and item["count"] == 0:
            return
        seen.add(key)
        out.append(item)

    def starts(candidate):
        return any(w.startswith(norm) for w in normalize(candidate).split()) or normalize(candidate).startswith(norm)

    for style in index["styles"]:
        if starts(style["name"]) or any(a.startswith(norm) or norm in a.split() for a in style["aliases"]):
            add(style["name"], "style")
    for style in index["styles"]:
        for label in style["colour_labels"]:
            if starts(label):
                add(label, "colour", style["name"])
    for style in index["styles"]:
        for label in style["material_labels"]:
            if starts(label):
                add(label[0].upper() + label[1:], "material", style["name"])
    for style in index["styles"]:
        if starts(style["name"]) or any(a.startswith(norm) for a in style["aliases"]):
            add("Browse the %s gallery" % style["name"], "gallery", "", "/gallery/" + quote(style["slug"]))
    return {"query": text, "suggestions": out}
