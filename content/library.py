"""The Design Library on the Journal & Listen page (/journal).

Eight style sections, each with YouTube video cards and, for some styles,
Spotify episode cards. Every card is a plain link that opens the ORIGINAL
YouTube or Spotify address in a new tab. Nothing is embedded.

HOW TO ADD, REMOVE OR REORDER A LINK
------------------------------------
Edit the lists in LIBRARY below. Paste the address exactly as you copied it.
The site keeps the address untouched and only reads the video or episode ID
from it to build the thumbnail picture.

HOW TO ADD A VERIFIED TITLE
---------------------------
Cards are labelled "Video 01", "Video 02" ... because no titles have been
checked yet. After you open a video and copy its title exactly as YouTube shows
it, add it to VERIFIED_TITLES (the key is the 11 character video ID):

    VERIFIED_TITLES = {"6hIcr9d1Qog": "Title exactly as on YouTube"}

A video with a title in that list shows the title; the number label is used
for all the others. Never type a title you have not copied from the real page.

If a link is wrong it is skipped and a warning is printed in the CMD window
where the server is running. The rest of the page keeps working.
"""

import logging
import re
from urllib.parse import urlparse

from content import gallery as gallery_store

logger = logging.getLogger(__name__)

VERIFIED_TITLES = {}

# (slug, name, YouTube links, Spotify links). The slug matches the gallery
# collection of the same style, so the section can link to its photographs.
LIBRARY = [
    {
        "slug": "japandi",
        "name": "Japandi",
        "youtube": [
            "https://youtu.be/6hIcr9d1Qog?si=97HMAbtW8XS5hksd",
            "https://youtu.be/JoCKRnAsNSA?si=6zTRQ7RKd5RzBhkl",
            "https://youtu.be/jLXpTXZ9zWY?si=6YWeKwcJv3-KmqIX",
            "https://youtu.be/w2-gaH6kaM4?si=DzN2JWZu_m5edCDP",
            "https://youtu.be/g_aQriYhgtE?si=kcKT0JxPy16mztaq",
            "https://youtu.be/YpS4vmG0adQ?si=gfYWNMYK5p2xPAb1",
        ],
        "spotify": [
            "https://open.spotify.com/episode/0jmKEan6S4DgPgaPm9qm6X?si=82054f6a3de94829",
        ],
    },
    {
        "slug": "mid-century-modern",
        "name": "Mid-Century Modern",
        "youtube": [
            "https://youtu.be/gjPsdqSEvfs?si=RQrGB--B_hGCz6mp",
            "https://youtu.be/M8kHCje7QSY?si=_SVmaoyUQiNi059T",
            "https://youtu.be/OQi6Be70FuQ?si=4C1PICi8Ehi6Rj0p",
            "https://youtu.be/F_-mPv2UBzA?si=i7QQxD80nbvdaK0q",
            "https://youtu.be/DtU9OcgrjNo?si=fRYd3QOt9CgIQ6dp",
        ],
        "spotify": [
            "https://open.spotify.com/episode/014eIsnQSLDTj8Ht9xsUl9?si=9mv_c1JHRBKW27we1KNGnw",
        ],
    },
    {
        "slug": "scandinavian",
        "name": "Scandinavian",
        "youtube": [
            "https://youtu.be/32ey5Cu30Mo?si=iDhTE0xSqQ2itdwV",
            "https://youtu.be/LCdJ3OdG3rY?si=Q_6UST3E8keDY4f7",
            "https://youtu.be/wfitA6sDVcY?si=FVsUYkO5ehUxS1Gx",
            "https://youtu.be/vmmlXOA-eNk?si=KvuAHGWmMAeykqtC",
            "https://youtu.be/0l1ZBdO9P3k?si=E6vaiuwSKr1SmpbB",
            "https://youtu.be/1A8d9aeUQlU?si=vZhJ3PzLjiXqP8LP",
        ],
        "spotify": [],
    },
    {
        "slug": "minimalism",
        "name": "Minimalism",
        "youtube": [
            "https://youtu.be/gwggDY3uqaM?si=pSVt47bkyxiksJd8",
            "https://youtu.be/wQWMvaB43pw?si=dK72EVk8a7PUS-pU",
            "https://youtu.be/DOwJtRa751c?si=MhrbYzh8O5qpYbK-",
            "https://youtu.be/hDacqaR0mnA?si=nZjrul2-tYESIpO7",
            "https://youtu.be/4VKTozTY4Ek?si=8YBH35-m03AY05S3",
            "https://youtu.be/5pvNYrOUTtM?si=wK4m5jYIMzgeUw6C",
            "https://youtu.be/vH1zOzW954E?si=bhp65k-mdhZhjoAa",
        ],
        "spotify": [],
    },
    {
        "slug": "industrial",
        "name": "Industrial",
        "youtube": [
            "https://youtube.com/shorts/P7Uejl0JbeY?si=IvI75njCo-yQpkhE",
            "https://youtu.be/isz-GIvjcRE?si=BNfOfGb3XxwrQ46Z",
            "https://youtu.be/Ezc4BDjoIDI?si=_sxCmWTeiXeBA6mY",
            "https://youtu.be/M4exp4Mgkuk?si=7mMXnAU9uVfPWBkQ",
            "https://youtu.be/tFHVCrUUHM0?si=2weK1amSM6Ok6hQi",
            "https://youtu.be/WqqYUFMMP9A?si=L0MDh2iVpg1Sivmg",
        ],
        "spotify": [],
    },
    {
        "slug": "indian-deco",
        "name": "Indian Deco",
        "youtube": [
            "https://youtube.com/shorts/xN5AC8Hmbzc?si=BLThipRtAaDMms-u",
            "https://youtu.be/ghtiNCMYCFA?si=wl28FgS9TR8np6Th",
            "https://youtu.be/iF2dQqOf9-Q?si=Nsh7Hm8cLnH-Rbjt",
            "https://youtu.be/eafDweQ3E7g?si=jQ_iCcMgNtc8xbjb",
            "https://youtu.be/8KVr2nvxBII?si=voQjTASzvHKKxyrs",
            "https://youtu.be/QOBzua_peYc?si=Yuj4C1YwV8S90M0E",
        ],
        "spotify": [],
    },
    {
        "slug": "bohemian",
        "name": "Bohemian",
        "youtube": [
            "https://youtu.be/QOXyA71Uxus?si=K91ruID8-WAd9zez",
            "https://youtu.be/kUjcTNljZt0?si=hxVeHWlHtNrFS4cU",
            "https://youtu.be/FLZtljVoRjI?si=PogPapIB_DVFesti",
            "https://youtu.be/XIzQbd3VEsc?si=NbvcWdXQ0AAjyyJY",
            "https://youtu.be/BxrCXaK4Odo?si=5mIUTFV-tox4HAZv",
            "https://youtu.be/BSWIOsmaiZA?si=MJ8zA_Pg9C-KWx5R",
            "https://youtu.be/PeDyGzNp85I?si=Io_HiLBzIPRlXViW",
            "https://youtu.be/jz86vSM0GdA?si=ghs83Q5dSfJRa71Y",
        ],
        "spotify": [],
    },
    {
        "slug": "transitional",
        "name": "Transitional",
        "youtube": [
            "https://youtube.com/shorts/RkSYkBVTAFo?si=1es0pjbTJO1IuTU4",
            "https://youtu.be/aXiMS7lOc4U?si=4DrNP8edRXBWrhMG",
            "https://youtu.be/3dIHTWlYBvQ?si=3GDtg4mqppGMbphO",
            "https://youtu.be/OJVTOylI2lI?si=modJoYeeB8wwxPkt",
        ],
        "spotify": [],
    },
]


# ---------------------------------------------------------------------------
# Everything below prepares the data for the templates. You do not need to
# edit it when adding links.
# ---------------------------------------------------------------------------
YOUTUBE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
SPOTIFY_ID_RE = re.compile(r"^[A-Za-z0-9]{22}$")
YOUTUBE_HOSTS = {"youtu.be", "youtube.com", "www.youtube.com"}


def _youtube_id(url):
    """Return (video_id, is_short) for a youtu.be or youtube.com/shorts link, else (None, False)."""
    if not isinstance(url, str):
        return None, False
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in YOUTUBE_HOSTS:
        return None, False
    parts = [p for p in parsed.path.split("/") if p]
    if parsed.hostname == "youtu.be" and len(parts) == 1:
        vid, short = parts[0], False
    elif parsed.hostname != "youtu.be" and len(parts) == 2 and parts[0] == "shorts":
        vid, short = parts[1], True
    else:
        return None, False
    return (vid, short) if YOUTUBE_ID_RE.match(vid) else (None, False)


def _spotify_id(url):
    if not isinstance(url, str):
        return None
    parsed = urlparse(url)
    parts = [p for p in parsed.path.split("/") if p]
    if parsed.scheme == "https" and parsed.hostname == "open.spotify.com" \
            and len(parts) == 2 and parts[0] == "episode" and SPOTIFY_ID_RE.match(parts[1]):
        return parts[1]
    return None


def _build():
    sections = []
    seen = set()
    for raw in LIBRARY:
        name, slug = raw["name"], raw["slug"]
        gallery = gallery_store.get_collection(slug)
        videos, episodes = [], []

        for url in raw.get("youtube", []):
            vid, short = _youtube_id(url)
            if vid is None or url in seen:
                logger.warning("Library (%s): YouTube link skipped (invalid or repeated): %r", name, url)
                continue
            seen.add(url)
            number = "%02d" % (len(videos) + 1)
            title = VERIFIED_TITLES.get(vid) or "Video " + number
            videos.append({
                "url": url,  # exactly as supplied
                "title": title,
                "number": number,
                "short": short,
                "thumb": "https://i.ytimg.com/vi/%s/hqdefault.jpg" % vid,
                "search_text": " ".join([name, title, "video", "youtube", "short" if short else ""]).lower().strip(),
            })

        for url in raw.get("spotify", []):
            if _spotify_id(url) is None or url in seen:
                logger.warning("Library (%s): Spotify link skipped (invalid or repeated): %r", name, url)
                continue
            seen.add(url)
            number = "%02d" % (len(episodes) + 1)
            episodes.append({
                "url": url,  # exactly as supplied
                "title": "Episode " + number,
                "number": number,
                "search_text": " ".join([name, "episode", number, "spotify", "podcast"]).lower(),
            })

        if not videos and not episodes:
            continue
        sections.append({
            "slug": slug,
            "name": name,
            "index": "%02d" % (len(sections) + 1),
            "description": gallery["description"] if gallery else "",
            "has_gallery": gallery is not None,
            "videos": videos,
            "episodes": episodes,
        })
    return sections


_SECTIONS = _build()


def get_library():
    return list(_SECTIONS)


def get_stats():
    return {
        "styles": len(_SECTIONS),
        "videos": sum(len(s["videos"]) for s in _SECTIONS),
        "episodes": sum(len(s["episodes"]) for s in _SECTIONS),
    }
