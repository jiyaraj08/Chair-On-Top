"""Design gallery data for Chair on Top.

WHERE THE PICTURES LIVE
-----------------------
static/images/designs/<folder>/img1.jpg ... img16.jpg

The site LOOKS at those folders when it starts, so you never have to list the
16 pictures by hand. If a file is missing or named wrongly, a warning is printed
in the CMD window where the server is running, and that picture is left out.

IMPORTANT: FILE NAMES MUST BE EXACT
-----------------------------------
Windows ignores capital letters, but Vercel and Render (Linux) do not.
"img1.jpg" works everywhere. "IMG1.JPG" or "img1.JPEG" works on your laptop but
breaks after deployment, so this gallery refuses to use such names and tells
you to rename them.

HOW TO CHANGE A COVER IMAGE
---------------------------
Change the "cover" value of that collection below, for example "img5.jpg".

HOW TO ADD A COLLECTION
-----------------------
1. Put the pictures in static/images/designs/<new-folder>/ named img1.jpg, img2.jpg ...
2. Copy one block inside COLLECTIONS, then change slug, name, folder, description.
   The slug becomes the web address: /gallery/<slug>.
"""

import logging
import os
import re
import struct
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
IMAGE_ROOT = BASE_DIR / "static" / "images" / "designs"

# Used with url_for('static', path=...) in the templates.
URL_ROOT = "images/designs"

EXPECTED_COUNT = 16

# Editorial copy. It describes the spirit of each style, not every single photo.
COLLECTIONS = [
    {
        "slug": "japandi",
        "name": "Japandi",
        "folder": "japandi",
        "description": "Calm Japanese minimalism blended with Scandinavian warmth.",
        "cover": "img1.jpg",
    },
    {
        "slug": "mid-century-modern",
        "name": "Mid-Century Modern",
        "folder": "mid-cent-modern",
        "description": "Warm woods, sculptural furniture, geometric forms, and timeless design.",
        "cover": "img1.jpg",
    },
    {
        "slug": "scandinavian",
        "name": "Scandinavian",
        "folder": "scandinavian",
        "description": "Light-filled spaces, functional furniture, natural materials, and understated comfort.",
        "cover": "img1.jpg",
    },
    {
        "slug": "minimalism",
        "name": "Minimalism",
        "folder": "minimalism",
        "description": "Open space, quiet surfaces, and only the pieces that earn their place.",
        "cover": "img1.jpg",
    },
]


# ---------------------------------------------------------------------------
# Everything below prepares the data for the templates. You do not need to
# edit it.
# ---------------------------------------------------------------------------

# Case-sensitive on purpose (see the note at the top).
FILE_RE = re.compile(r"^img(\d+)\.jpg$")
LOOSE_RE = re.compile(r"^img\d+\.jpe?g$", re.IGNORECASE)
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FOLDER_RE = re.compile(r"^[A-Za-z0-9_-]+$")


def _exif_orientation(segment):
    """Read the 'rotate me' flag from a JPEG's EXIF block. Returns 1 to 8, or None."""
    try:
        if not segment.startswith(b"Exif\x00\x00"):
            return None
        tiff = segment[6:]
        if tiff[:2] == b"II":
            end = "<"
        elif tiff[:2] == b"MM":
            end = ">"
        else:
            return None
        if struct.unpack(end + "H", tiff[2:4])[0] != 42:
            return None
        offset = struct.unpack(end + "I", tiff[4:8])[0]
        entries = struct.unpack(end + "H", tiff[offset:offset + 2])[0]
        for i in range(entries):
            start = offset + 2 + i * 12
            tag = struct.unpack(end + "H", tiff[start:start + 2])[0]
            if tag == 0x0112:
                value = struct.unpack(end + "H", tiff[start + 8:start + 10])[0]
                return value if 1 <= value <= 8 else None
    except (struct.error, IndexError):
        return None
    return None


def jpeg_size(path):
    """Return (width, height) of a JPEG as a browser will SHOW it, or None.

    Reads only the file header, with no extra packages. Phone photos can carry
    an EXIF rotation flag, which browsers obey, so we swap width and height
    for the rotated cases.
    """
    orientation = None
    try:
        with open(path, "rb") as handle:
            if handle.read(2) != b"\xff\xd8":
                return None
            while True:
                byte = handle.read(1)
                while byte and byte != b"\xff":
                    byte = handle.read(1)
                if not byte:
                    return None
                marker = handle.read(1)
                while marker == b"\xff":
                    marker = handle.read(1)
                if not marker:
                    return None
                code = marker[0]
                if code == 0x01 or 0xD0 <= code <= 0xD8:
                    continue  # markers that have no length
                if code in (0xD9, 0xDA):
                    return None  # reached the picture data without a size
                raw = handle.read(2)
                if len(raw) != 2:
                    return None
                length = struct.unpack(">H", raw)[0]
                if length < 2:
                    return None
                if 0xC0 <= code <= 0xCF and code not in (0xC4, 0xC8, 0xCC):
                    body = handle.read(5)
                    if len(body) != 5:
                        return None
                    _, height, width = struct.unpack(">BHH", body)
                    if not width or not height:
                        return None
                    if orientation in (5, 6, 7, 8):
                        width, height = height, width
                    return width, height
                if code == 0xE1 and orientation is None:
                    orientation = _exif_orientation(handle.read(length - 2))
                else:
                    handle.seek(length - 2, 1)
    except OSError:
        return None


def _scan_folder(folder_path, name):
    """Return a sorted list of (number, filename) for exact img<N>.jpg files."""
    found = {}
    try:
        names = os.listdir(folder_path)
    except OSError:
        return []
    for filename in names:
        match = FILE_RE.match(filename)
        if match:
            found[int(match.group(1))] = filename
        elif LOOSE_RE.match(filename):
            logger.warning(
                "Gallery (%s): %r is skipped. Rename it to lowercase img<number>.jpg "
                "(Linux servers are case-sensitive).", name, filename
            )
    return sorted(found.items())


@lru_cache(maxsize=1)
def _load():
    prepared = []
    for raw in COLLECTIONS:
        slug, folder = raw.get("slug"), raw.get("folder")
        if not (isinstance(slug, str) and SLUG_RE.match(slug) and isinstance(folder, str) and FOLDER_RE.match(folder)):
            logger.warning("Gallery: collection %r skipped (bad slug or folder)", raw.get("name"))
            continue
        name = raw["name"]
        folder_path = IMAGE_ROOT / folder
        files = _scan_folder(folder_path, name)

        present = {number for number, _ in files}
        missing = [n for n in range(1, EXPECTED_COUNT + 1) if n not in present]
        if not files:
            logger.warning("Gallery (%s): no pictures found in %s", name, folder_path)
        elif missing:
            logger.warning(
                "Gallery (%s): missing %s", name, ", ".join("img%d.jpg" % n for n in missing)
            )
        if len(files) > EXPECTED_COUNT:
            logger.info("Gallery (%s): %d pictures found, more than the expected %d", name, len(files), EXPECTED_COUNT)

        total = len(files)
        images = []
        for position, (number, filename) in enumerate(files, start=1):
            size = jpeg_size(folder_path / filename)
            image = {
                "number": position,
                "filename": filename,
                "path": "%s/%s/%s" % (URL_ROOT, folder, filename),
                "width": size[0] if size else None,
                "height": size[1] if size else None,
                "alt": "%s collection, image %d of %d" % (name, position, total),
            }
            images.append(image)

        cover = next((i for i in images if i["filename"] == raw.get("cover")), None)
        if cover is None and images:
            cover = images[0]

        prepared.append({
            "slug": slug,
            "name": name,
            "folder": folder,
            "description": raw["description"],
            "count": total,
            "images": images,
            "cover": cover,
        })
    return prepared


def get_collections():
    """Collections that have at least one picture."""
    return [c for c in _load() if c["images"]]


def get_collection(slug):
    for collection in get_collections():
        if collection["slug"] == slug:
            return collection
    return None
