// Chair on Top - gallery.js
// Opens the pictures of a collection in a large viewer (a native <dialog>).
// Without JavaScript, every thumbnail is still a normal link to the full picture.
// Like, Save, Share and Download come from actions.js (loaded first).
// A link such as /gallery/japandi?image=img3 opens the viewer on that photograph.
//
// The same viewer also serves the search results page. That is opt-in: the
// grid must carry data-viewer="search". In that mode:
//   - photographs can come from different collections,
//   - photographs added later by "Load More" are included,
//   - the address bar keeps /search?q=... untouched and uses a fragment
//     (#photo=japandi/img3) instead of ?image=,
//   - the browser Back button closes the viewer.
// Collection pages (the #gl-grid grid) behave exactly as before.

(function () {
  "use strict";

  var collectionGrid = document.getElementById("gl-grid");
  var searchGrid = collectionGrid ? null : document.querySelector('[data-viewer="search"]');
  var grid = collectionGrid || searchGrid;
  var dialog = document.getElementById("gl-lightbox");
  if (!grid || !dialog || typeof dialog.showModal !== "function") {
    return;
  }

  var isSearch = !!searchGrid;

  var image = document.getElementById("gl-lb-img");
  var caption = document.getElementById("gl-lb-caption");
  var counter = document.getElementById("gl-lb-count");
  var closeButton = document.getElementById("gl-lb-close");
  var prevButton = document.getElementById("gl-lb-prev");
  var nextButton = document.getElementById("gl-lb-next");
  var lbLike = document.getElementById("gl-lb-like");
  var lbSave = document.getElementById("gl-lb-save");
  var lbShare = document.getElementById("gl-lb-share");
  var lbDownload = document.getElementById("gl-lb-download");
  var lbGallery = document.getElementById("gl-lb-gallery"); // search page only
  var collectionName = grid.getAttribute("data-collection") || "Gallery";
  var root = document.documentElement;

  var items = [];

  function readCard(card) {
    var link = card.querySelector(".gl-thumb");
    var thumb = link.querySelector("img");
    var item = {
      link: link,
      id: card.getAttribute("data-id"),
      key: card.getAttribute("data-key"),
      download: card.getAttribute("data-download"),
      href: link.getAttribute("href"),
      alt: thumb ? thumb.getAttribute("alt") || "" : "",
      width: thumb ? thumb.getAttribute("width") : null,
      height: thumb ? thumb.getAttribute("height") : null
    };
    if (isSearch) {
      // On the search page the thumbnail links to the gallery page, so the
      // picture itself comes from the <img>.
      item.href = thumb ? thumb.getAttribute("src") || "" : "";
      item.gallery = card.getAttribute("data-gallery") || link.getAttribute("href");
      item.style = card.getAttribute("data-style") || "Gallery";
      item.label = card.getAttribute("data-label") || "";
    }
    return item;
  }

  // Read the cards that are on the page now. On a collection page this runs
  // once. On the search page it runs again whenever the list may have changed.
  function collect() {
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".gl-item"));
    items = cards.map(readCard);
    items.forEach(function (item) {
      item.link.setAttribute("aria-haspopup", "dialog");
    });
  }

  collect();
  if (!items.length) {
    return;
  }

  var current = 0;
  var lastTrigger = null;
  var pendingNext = false; // search page: waiting for Load More to finish

  // ---- Address bar ------------------------------------------------------------
  // Collection pages: keep ?image=... pointing at the open photograph (shareable,
  // and it still works after a refresh). It is removed again when the viewer closes.
  function setUrl(key) {
    try {
      var url = new URL(window.location.href);
      if (key) {
        url.searchParams.set("image", key);
      } else {
        url.searchParams.delete("image");
      }
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (error) {
      /* an old browser: the viewer still works, just without the address */
    }
  }

  // Search page: only the #fragment changes. The path and the ?q=... stay exactly
  // as they are, so a search link can never be corrupted.
  var HASH_RE = /^#photo=([a-z0-9]+(?:-[a-z0-9]+)*\/img\d+)$/;
  var viewerPushed = false; // true when opening the viewer added a history entry

  function searchBase() {
    return window.location.pathname + window.location.search;
  }

  function fragmentFor(id) {
    return "#photo=" + id;
  }

  function stripFragment() {
    try {
      if (HASH_RE.test(window.location.hash)) {
        window.history.replaceState(null, "", searchBase());
      }
    } catch (error) {
      /* ignore */
    }
  }

  function replaceFragment(item) {
    try {
      window.history.replaceState({ cotViewer: item.id }, "", searchBase() + fragmentFor(item.id));
    } catch (error) {
      /* ignore */
    }
  }

  function pushFragment(item) {
    try {
      window.history.pushState({ cotViewer: item.id }, "", searchBase() + fragmentFor(item.id));
      viewerPushed = true;
    } catch (error) {
      viewerPushed = false;
    }
  }

  function preload(index) {
    var item = items[(index + items.length) % items.length];
    var probe = new Image();
    probe.src = item.href;
  }

  // Point the four viewer buttons at the photograph that is showing now.
  function updateActions(item) {
    [lbLike, lbSave, lbShare, lbDownload].forEach(function (button) {
      if (button) {
        button.setAttribute("data-id", item.id);
      }
    });
    if (lbShare) {
      lbShare.setAttribute("data-name", isSearch ? item.style : collectionName);
    }
    if (lbDownload) {
      lbDownload.setAttribute("href", item.href);
      lbDownload.setAttribute("download", item.download || "");
    }
    if (lbGallery && isSearch) {
      lbGallery.setAttribute("href", item.gallery);
    }
    if (window.CoT) {
      window.CoT.syncButtons(dialog);
    }
  }

  function searchTotal() {
    var total = parseInt(grid.getAttribute("data-total"), 10);
    return total > 0 ? total : items.length;
  }

  function searchStart() {
    var start = parseInt(grid.getAttribute("data-offset"), 10);
    return start > 0 ? start : 0;
  }

  function hasMore() {
    return isSearch && grid.getAttribute("data-has-more") === "true";
  }

  // skipUrl is true while the viewer is being opened: open() sets the address itself.
  function show(index, skipUrl) {
    current = (index + items.length) % items.length;
    var item = items[current];
    var label;

    image.removeAttribute("width");
    image.removeAttribute("height");
    if (item.width && item.height) {
      image.setAttribute("width", item.width);
      image.setAttribute("height", item.height);
    }
    image.alt = item.alt;
    image.src = item.href;

    if (isSearch) {
      label = "Result " + (searchStart() + current + 1) + " of " + searchTotal();
      counter.textContent = label;
      caption.textContent = item.style + (item.label ? " \u00b7 " + item.label : "");
    } else {
      label = "Image " + (current + 1) + " of " + items.length;
      counter.textContent = label;
      caption.textContent = collectionName + " \u00b7 " + label;
    }
    updateActions(item);
    if (!skipUrl) {
      if (isSearch) {
        replaceFragment(item);
      } else {
        setUrl(item.key);
      }
    }

    if (items.length > 1) {
      preload(current + 1);
      preload(current - 1);
    }
  }

  // how: "click" (adds a history entry), "history" (forward button: entry exists),
  // "load" (a fragment in the address when the page opened).
  function open(index, trigger, how) {
    lastTrigger = trigger || null;
    show(index, true);
    if (isSearch) {
      var item = items[current];
      if (how === "history") {
        viewerPushed = true;
        replaceFragment(item);
      } else if (how === "load") {
        viewerPushed = false;
        replaceFragment(item);
      } else {
        pushFragment(item);
      }
    } else {
      setUrl(items[current].key);
    }
    root.classList.add("gl-lock");
    dialog.showModal();
  }

  function close() {
    if (dialog.open) {
      dialog.close();
    }
  }

  // Next and previous. On the search page, moving past the last loaded photograph
  // asks the page to load more (when there are more) instead of jumping back.
  function go(step) {
    if (isSearch && step > 0 && current === items.length - 1 && hasMore()) {
      if (!pendingNext) {
        pendingNext = true;
        document.dispatchEvent(new CustomEvent("cot:load-more-request"));
      }
      return;
    }
    show(current + step);
  }

  // Thumbnails: a normal click opens the viewer. Ctrl/Shift/middle click keep
  // the browser's usual behaviour (open the page or picture in a new tab).
  grid.addEventListener("click", function (event) {
    var link = event.target.closest(".gl-thumb");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (isSearch) {
      collect(); // picks up photographs added since the page loaded
    }
    var index = items.findIndex(function (item) {
      return item.link === link;
    });
    if (index !== -1) {
      open(index, link, "click");
    }
  });

  prevButton.addEventListener("click", function () {
    go(-1);
  });
  nextButton.addEventListener("click", function () {
    go(1);
  });
  closeButton.addEventListener("click", close);

  // A click on the empty area around the picture closes the viewer. Clicks on
  // the picture, the buttons and the action row never do.
  dialog.addEventListener("click", function (event) {
    if (!event.target.closest(".gl-lb-img, .gl-lb-btn, .gl-lb-caption, .gl-lb-count, .gl-lb-gallery, .gl-actions, .cot-toast")) {
      close();
    }
  });

  // Keyboard: arrows and Home/End move around. Escape is handled by <dialog>.
  dialog.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    } else if (event.key === "Home") {
      event.preventDefault();
      show(0);
    } else if (event.key === "End") {
      event.preventDefault();
      show(items.length - 1);
    }
  });

  // Touch: swipe left or right to move between pictures.
  var startX = 0;
  var startY = 0;
  dialog.addEventListener(
    "touchstart",
    function (event) {
      if (event.touches.length === 1) {
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
      }
    },
    { passive: true }
  );
  dialog.addEventListener(
    "touchend",
    function (event) {
      if (!event.changedTouches.length) {
        return;
      }
      var dx = event.changedTouches[0].clientX - startX;
      var dy = event.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dy) < 60) {
        go(dx < 0 ? 1 : -1);
      }
    },
    { passive: true }
  );

  // A picture that cannot be loaded: say so instead of showing nothing.
  image.addEventListener("error", function () {
    caption.textContent = "This image could not be loaded.";
  });

  // Runs for every way of closing (button, Escape, outside click, browser Back).
  dialog.addEventListener("close", function () {
    root.classList.remove("gl-lock");
    pendingNext = false;
    if (isSearch) {
      if (viewerPushed) {
        // Opening added a history entry. Remove it, so Back and Forward stay tidy.
        viewerPushed = false;
        try {
          window.history.back();
        } catch (error) {
          stripFragment();
        }
      } else {
        stripFragment();
      }
    } else {
      setUrl(null);
    }
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
    }
  });

  if (isSearch) {
    // Browser Back while the viewer is open closes it. Forward opens it again.
    window.addEventListener("popstate", function (event) {
      var state = event.state;
      var viewerState = state && typeof state === "object" && typeof state.cotViewer === "string";
      if (dialog.open && !viewerState) {
        viewerPushed = false; // that entry is already gone
        dialog.close();
      } else if (!dialog.open && viewerState) {
        collect();
        var index = items.findIndex(function (item) {
          return item.id === state.cotViewer;
        });
        if (index !== -1) {
          open(index, null, "history");
        }
      } else if (dialog.open && viewerState) {
        collect();
        var again = items.findIndex(function (item) {
          return item.id === state.cotViewer;
        });
        if (again !== -1) {
          show(again, true);
        }
      }
    });

    // Load More finished: include the new photographs. If the visitor pressed
    // Next on the last loaded photograph, carry on to the first new one.
    document.addEventListener("cot:results-updated", function () {
      var currentId = items[current] ? items[current].id : null;
      collect();
      var index = items.findIndex(function (item) {
        return item.id === currentId;
      });
      current = index === -1 ? 0 : index;
      if (pendingNext) {
        pendingNext = false;
        if (dialog.open && current < items.length - 1) {
          show(current + 1);
        }
      }
    });

    document.addEventListener("cot:results-failed", function () {
      if (pendingNext) {
        pendingNext = false;
        if (window.CoT) {
          window.CoT.toast("Could not load more photographs. Please try again.");
        }
      }
    });

    // A shared or refreshed link: /search?q=wood#photo=japandi/img3
    var fromAddress = HASH_RE.exec(window.location.hash);
    if (fromAddress) {
      var found = items.findIndex(function (item) {
        return item.id === fromAddress[1];
      });
      if (found !== -1) {
        open(found, items[found].link, "load");
      } else {
        stripFragment();
      }
    }
    return;
  }

  // A shared link: /gallery/<collection>?image=img3 opens that photograph.
  var wanted = null;
  try {
    wanted = new URL(window.location.href).searchParams.get("image");
  } catch (error) {
    wanted = null;
  }
  if (wanted && /^img\d+$/.test(wanted)) {
    var start = items.findIndex(function (item) {
      return item.key === wanted;
    });
    if (start !== -1) {
      open(start, items[start].link, "click");
    }
  }
})();
