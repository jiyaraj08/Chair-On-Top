// Chair on Top - gallery.js
// Opens the pictures of a collection in a large viewer (a native <dialog>).
// Without JavaScript, every thumbnail is still a normal link to the full picture.
// Like, Save, Share and Download come from actions.js (loaded first).
// A link such as /gallery/japandi?image=img3 opens the viewer on that photograph.

(function () {
  "use strict";

  var grid = document.getElementById("gl-grid");
  var dialog = document.getElementById("gl-lightbox");
  if (!grid || !dialog || typeof dialog.showModal !== "function") {
    return;
  }

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
  var collectionName = grid.getAttribute("data-collection") || "Gallery";
  var root = document.documentElement;

  var cards = Array.prototype.slice.call(grid.querySelectorAll(".gl-item"));
  var items = cards.map(function (card) {
    var link = card.querySelector(".gl-thumb");
    var thumb = link.querySelector("img");
    return {
      link: link,
      id: card.getAttribute("data-id"),
      key: card.getAttribute("data-key"),
      download: card.getAttribute("data-download"),
      href: link.getAttribute("href"),
      alt: thumb ? thumb.getAttribute("alt") || "" : "",
      width: thumb ? thumb.getAttribute("width") : null,
      height: thumb ? thumb.getAttribute("height") : null
    };
  });
  if (!items.length) {
    return;
  }

  items.forEach(function (item) {
    item.link.setAttribute("aria-haspopup", "dialog");
  });

  var current = 0;
  var lastTrigger = null;

  // Keep the address bar pointing at the open photograph (shareable, and it
  // still works after a refresh). It is removed again when the viewer closes.
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
      lbShare.setAttribute("data-name", collectionName);
    }
    if (lbDownload) {
      lbDownload.setAttribute("href", item.href);
      lbDownload.setAttribute("download", item.download || "");
    }
    if (window.CoT) {
      window.CoT.syncButtons(dialog);
    }
  }

  function show(index) {
    current = (index + items.length) % items.length;
    var item = items[current];
    var label = "Image " + (current + 1) + " of " + items.length;

    image.removeAttribute("width");
    image.removeAttribute("height");
    if (item.width && item.height) {
      image.setAttribute("width", item.width);
      image.setAttribute("height", item.height);
    }
    image.alt = item.alt;
    image.src = item.href;
    counter.textContent = label;
    caption.textContent = collectionName + " \u00b7 " + label;
    updateActions(item);
    setUrl(item.key);

    if (items.length > 1) {
      preload(current + 1);
      preload(current - 1);
    }
  }

  function open(index, trigger) {
    lastTrigger = trigger || null;
    show(index);
    root.classList.add("gl-lock");
    dialog.showModal();
  }

  function close() {
    if (dialog.open) {
      dialog.close();
    }
  }

  // Thumbnails: a normal click opens the viewer. Ctrl/Shift/middle click keep
  // the browser's usual behaviour (open the picture in a new tab).
  grid.addEventListener("click", function (event) {
    var link = event.target.closest(".gl-thumb");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    var index = items.findIndex(function (item) {
      return item.link === link;
    });
    open(index, link);
  });

  prevButton.addEventListener("click", function () {
    show(current - 1);
  });
  nextButton.addEventListener("click", function () {
    show(current + 1);
  });
  closeButton.addEventListener("click", close);

  // A click on the empty area around the picture closes the viewer. Clicks on
  // the picture, the buttons and the action row never do.
  dialog.addEventListener("click", function (event) {
    if (!event.target.closest(".gl-lb-img, .gl-lb-btn, .gl-lb-caption, .gl-lb-count, .gl-actions, .cot-toast")) {
      close();
    }
  });

  // Keyboard: arrows and Home/End move around. Escape is handled by <dialog>.
  dialog.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      show(current - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      show(current + 1);
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
        show(dx < 0 ? current + 1 : current - 1);
      }
    },
    { passive: true }
  );

  // A picture that cannot be loaded: say so instead of showing nothing.
  image.addEventListener("error", function () {
    caption.textContent = "This image could not be loaded.";
  });

  // Runs for every way of closing (button, Escape, outside click).
  dialog.addEventListener("close", function () {
    root.classList.remove("gl-lock");
    setUrl(null);
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
    }
  });

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
      open(start, items[start].link);
    }
  }
})();
