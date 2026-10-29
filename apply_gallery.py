"""apply_gallery.py - one-time helper that adds the gallery to three existing files.

Run it ONCE from the app folder, after unzipping the gallery update:

    python apply_gallery.py

What it does
------------
It makes three small insertions. It never replaces a whole file.
  1. main.py                         registers the gallery router
  2. templates/partials/site_footer.html   adds a "Gallery" footer link
  3. templates/index.html            adds a "View the gallery" link under the six styles

Safety
------
* It first checks that every spot it needs to edit is found EXACTLY once.
  If anything looks different from what it expects, it changes NOTHING and
  explains what it found.
* It copies the three original files to ..\\backup-before-gallery before writing.
* Running it a second time is harmless: it skips edits that are already there.

This file is only a helper. Delete it after use. Do not add it to Git.
"""

import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

REQUIRED_NEW_FILES = [
    "content/gallery.py",
    "routes/gallery.py",
    "templates/gallery/index.html",
    "templates/gallery/collection.html",
    "templates/gallery/not_found.html",
    "static/css/gallery.css",
    "static/js/gallery.js",
]

problems = []


def read(relative):
    path = ROOT / relative
    if not path.is_file():
        problems.append("%s was not found. Run this from the app folder." % relative)
        return None
    # newline="" keeps the file's own line endings exactly as they are.
    with open(path, "r", encoding="utf-8", newline="") as handle:
        return handle.read()


def newline_of(text):
    return "\r\n" if "\r\n" in text else "\n"


def once(text, needle, label):
    count = text.count(needle)
    if count != 1:
        problems.append("%s: expected to find the marker exactly once but found it %d time(s)." % (label, count))
        return False
    return True


# ---------------------------------------------------------------- checks
for name in REQUIRED_NEW_FILES:
    if not (ROOT / name).is_file():
        problems.append("%s is missing. Unzip the gallery update into the app folder first." % name)

main_text = read("main.py")
footer_text = read("templates/partials/site_footer.html")
index_text = read("templates/index.html")
base_text = read("templates/base.html")

edits = {}  # relative path -> new text

if base_text is not None and "{% block head_extra %}" not in base_text:
    problems.append("templates/base.html has no head_extra block. The Journal update must be applied first.")

# ---- 1. main.py
if main_text is not None:
    nl = newline_of(main_text)
    imp = "from routes.journal import router as journal_router"
    inc = "app.include_router(journal_router)"
    if "gallery_router" in main_text:
        print("main.py: gallery already registered, skipping.")
    elif once(main_text, imp, "main.py (journal import)") and once(main_text, inc, "main.py (journal include)"):
        new = main_text.replace(imp, imp + nl + "from routes.gallery import router as gallery_router", 1)
        new = new.replace(
            inc,
            inc + nl + nl + "# The design gallery (/gallery and /gallery/<collection>)." + nl + "app.include_router(gallery_router)",
            1,
        )
        edits["main.py"] = new

# ---- 2. footer link
if footer_text is not None:
    nl = newline_of(footer_text)
    anchor = '<li><a href="/journal">Journal &amp; Listen</a></li>'
    if 'href="/gallery"' in footer_text:
        print("site_footer.html: gallery link already there, skipping.")
    elif once(footer_text, anchor, "site_footer.html (Journal link)"):
        edits["templates/partials/site_footer.html"] = footer_text.replace(
            anchor, anchor + nl + '        <li><a href="/gallery">Gallery</a></li>', 1
        )

# ---- 3. homepage link
if index_text is not None:
    nl = newline_of(index_text)
    if "gl-home-link" in index_text:
        print("index.html: gallery link already there, skipping.")
    else:
        shortlist_end = (
            "Saving to an account is a future feature.</p>" + nl + "      </div>"
        )
        title_line = re.search(r"^\{% block title %\}.*\{% endblock %\}[ \t]*\r?$", index_text, re.MULTILINE)
        title_matches = re.findall(r"^\{% block title %\}", index_text, re.MULTILINE)
        ok = once(index_text, shortlist_end, "index.html (end of the six-styles block)")
        if len(title_matches) != 1 or title_line is None:
            problems.append("index.html: could not find a single {% block title %} line.")
            ok = False
        if "{% block head_extra %}" in index_text:
            problems.append("index.html already has a head_extra block, so I will not guess how to merge it.")
            ok = False
        if ok:
            link_block = (
                shortlist_end + nl + nl
                + '      <div class="gl-home-link">' + nl
                + "        <p>Want more to look at? Browse three collections of interior photography.</p>" + nl
                + '        <a class="btn btn-outline" href="/gallery">View the gallery</a>' + nl
                + "      </div>"
            )
            new = index_text.replace(shortlist_end, link_block, 1)
            head_block = (
                nl + nl + "{% block head_extra %}" + nl
                + "  <link rel=\"stylesheet\" href=\"{{ url_for('static', path='css/gallery.css') }}\">" + nl
                + "{% endblock %}"
            )
            matched = title_line.group(0).rstrip("\r")
            new = new.replace(matched, matched + head_block, 1)
            edits["templates/index.html"] = new

# ---------------------------------------------------------------- decide
if problems:
    print("")
    print("NOTHING WAS CHANGED. Please fix or report these points:")
    for item in problems:
        print("  - " + item)
    sys.exit(1)

if not edits:
    print("Nothing to do. The gallery is already wired in.")
    sys.exit(0)

# ---------------------------------------------------------------- backup + write
backup_root = ROOT.parent / "backup-before-gallery"
for relative in edits:
    target = backup_root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        shutil.copy2(ROOT / relative, target)

for relative, text in edits.items():
    with open(ROOT / relative, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)
    print("updated: " + relative)

print("")
print("Done. Originals are saved in: " + str(backup_root))
print("You can now delete apply_gallery.py.")
