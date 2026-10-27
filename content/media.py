"""Design Stories (videos) and the Listening Room (podcasts).

WHAT IS IN HERE TODAY
---------------------
VIDEOS   is empty on purpose. A video can only be shown after you give a real
         YouTube video ID, and no video ID has been checked yet. The page shows
         an honest "being curated" message until you add one.
PODCASTS has two shows with verified links to their official pages. They open
         in a new tab. There is no audio player yet because no Spotify show or
         episode ID has been added.

HOW TO ADD A VIDEO
------------------
1. Open the video on YouTube. The address looks like
       https://www.youtube.com/watch?v=AbCdEfGhIjK
   The 11 characters after v= are the video ID (here: AbCdEfGhIjK).
2. Copy the example block below into VIDEOS, remove the # signs, and fill it in.
3. Write the title, creator and description yourself, or copy the title and
   channel name exactly as YouTube shows them. Only add a duration if you checked it.
4. Open the Journal page and press the play button on that card to test it.
   Some videos do not allow embedding. If the player shows an error, the
   "Watch on YouTube" link on the card still works. You can also remove the video.

    # {
    #     "id": "small-living-room-tour",      # unique, lowercase-with-hyphens
    #     "title": "Title exactly as on YouTube",
    #     "description": "One or two sentences in your own words.",
    #     "category": "Room Tours",
    #     "creator": "Channel name",           # optional
    #     "youtube_id": "AbCdEfGhIjK",
    #     "duration": "12 min",                # optional, only if you checked it
    # },

HOW TO ADD A PODCAST EPISODE OR SHOW WITH A PLAYER
--------------------------------------------------
1. In Spotify, open the show or episode, choose Share, then Copy link.
   The link looks like  https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk
   The 22 letters and numbers at the end are the ID. The word before it is the
   type: "show" or "episode".
2. Fill in spotify_type and spotify_id on the podcast block. A "Load player"
   button then appears on its card, next to the normal Listen link.
3. Test it. If Spotify refuses to embed it, remove those two fields.

Never type an ID you have not copied from the real page. The site will not guess.

If an entry has a mistake it is skipped, and a warning is printed in the CMD
window where the server is running. The rest of the site keeps working.
"""

import logging
import re
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

VIDEOS = []

PODCASTS = [
    {
        "id": "99-percent-invisible",
        "title": "99% Invisible",
        "kind": "Show",
        "publisher": "Roman Mars",
        "initials": "99",
        "description": "A long-running podcast about the design and architecture we rarely notice, told one story at a time.",
        "category": "Architecture & Design",
        # Official site of the show. Checked in October 2026.
        "listen_url": "https://99percentinvisible.org/",
        "listen_label": "Visit the show",
        # Add these two after copying a real link from Spotify (see above):
        # "spotify_type": "show",
        # "spotify_id": "xxxxxxxxxxxxxxxxxxxxxx",
    },
    {
        "id": "design-matters",
        "title": "Design Matters with Debbie Millman",
        "kind": "Show",
        "publisher": "Debbie Millman",
        "description": "Conversations with designers, artists and thinkers about how creative people shape their working lives.",
        "category": "Creative Careers",
        # Show page on TED's website. Checked in October 2026.
        "listen_url": "https://www.ted.com/podcasts/design_matters_with_debbie_millman",
        "listen_label": "Visit the show page",
    },
]


# ---------------------------------------------------------------------------
# Everything below prepares the data for the templates. You do not need to
# edit it when adding items.
# ---------------------------------------------------------------------------

ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
YOUTUBE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
SPOTIFY_ID_RE = re.compile(r"^[A-Za-z0-9]{22}$")
SPOTIFY_TYPES = {"show", "episode"}


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")


def _text(value):
    return isinstance(value, str) and value.strip() != ""


def _optional_text(value):
    return value.strip() if _text(value) else ""


def _https_url(value):
    """True only for plain https links with a host name."""
    if not _text(value):
        return False
    parsed = urlparse(value.strip())
    return parsed.scheme == "https" and bool(parsed.netloc)


def _initials(custom, title):
    """Letters shown on the podcast cover tile. Use the optional 'initials' field to override."""
    if _text(custom):
        return custom.strip()[:3]
    letters = "".join(w[0] for w in re.findall(r"[A-Za-z0-9]+", title)[:2]).upper()
    return letters or "CT"


def _prepare_video(raw):
    if not isinstance(raw, dict):
        return None, "a video entry is not a dictionary"
    key = raw.get("id")
    if not (isinstance(key, str) and ID_RE.match(key)):
        return None, "video id %r must use lowercase letters, numbers and hyphens" % (key,)
    for field in ("title", "description", "category"):
        if not _text(raw.get(field)):
            return None, "video %r is missing %s" % (key, field)
    video_id = raw.get("youtube_id")
    if not (isinstance(video_id, str) and YOUTUBE_ID_RE.match(video_id)):
        return None, "video %r needs an 11 character youtube_id" % key
    title = raw["title"].strip()
    description = raw["description"].strip()
    category = raw["category"].strip()
    creator = _optional_text(raw.get("creator"))
    duration = _optional_text(raw.get("duration"))
    return {
        "id": key,
        "title": title,
        "description": description,
        "category": category,
        "category_slug": slugify(category),
        "creator": creator,
        "duration": duration,
        "watch_url": "https://www.youtube.com/watch?v=" + video_id,
        "embed_url": "https://www.youtube-nocookie.com/embed/" + video_id,
        "thumb_url": "https://i.ytimg.com/vi/" + video_id + "/hqdefault.jpg",
        "search_text": " ".join([title, description, category, creator]).lower(),
    }, None


def _prepare_podcast(raw):
    if not isinstance(raw, dict):
        return None, "a podcast entry is not a dictionary"
    key = raw.get("id")
    if not (isinstance(key, str) and ID_RE.match(key)):
        return None, "podcast id %r must use lowercase letters, numbers and hyphens" % (key,)
    for field in ("title", "description", "category"):
        if not _text(raw.get(field)):
            return None, "podcast %r is missing %s" % (key, field)
    if not _https_url(raw.get("listen_url")):
        return None, "podcast %r needs a listen_url that starts with https://" % key

    embed_url = ""
    spotify_type = raw.get("spotify_type")
    spotify_id = raw.get("spotify_id")
    if spotify_type is not None or spotify_id is not None:
        if spotify_type in SPOTIFY_TYPES and isinstance(spotify_id, str) and SPOTIFY_ID_RE.match(spotify_id):
            embed_url = "https://open.spotify.com/embed/%s/%s" % (spotify_type, spotify_id)
        else:
            return None, "podcast %r has an invalid spotify_type or spotify_id" % key

    title = raw["title"].strip()
    description = raw["description"].strip()
    category = raw["category"].strip()
    publisher = _optional_text(raw.get("publisher"))
    kind = _optional_text(raw.get("kind")) or "Show"
    return {
        "id": key,
        "title": title,
        "description": description,
        "category": category,
        "category_slug": slugify(category),
        "publisher": publisher,
        "kind": kind,
        "duration": _optional_text(raw.get("duration")),
        "listen_url": raw["listen_url"].strip(),
        "listen_label": _optional_text(raw.get("listen_label")) or "Listen",
        "embed_url": embed_url,
        "initials": _initials(raw.get("initials"), title),
        "search_text": " ".join([title, description, category, publisher, kind]).lower(),
    }, None


def _load(raw_items, prepare, label):
    prepared = []
    seen = set()
    for raw in raw_items:
        item, problem = prepare(raw)
        if problem is None and item["id"] in seen:
            problem = "duplicate id %r" % item["id"]
        if problem:
            logger.warning("%s skipped: %s", label, problem)
            continue
        seen.add(item["id"])
        prepared.append(item)
    return prepared


_VIDEOS = _load(VIDEOS, _prepare_video, "Video")
_PODCASTS = _load(PODCASTS, _prepare_podcast, "Podcast")


def _categories(items):
    seen = {}
    for item in items:
        seen.setdefault(item["category"], item["category_slug"])
    return [{"name": name, "slug": slug} for name, slug in sorted(seen.items())]


def get_videos():
    return list(_VIDEOS)


def get_podcasts():
    return list(_PODCASTS)


def get_video_categories():
    return _categories(_VIDEOS)


def get_podcast_categories():
    return _categories(_PODCASTS)
