// Chair on Top - search-results.js
// The search results page (/search?q=...):
//   - places every card in the shortest column, keeping the result order,
//   - replaces the "Show more" page link with a Load More button that uses
//     /api/search/results (offset paging),
//   - builds new cards from one hidden template, so the Like, Save, Share and
//     Download buttons are the very same ones actions.js already handles.
//
// Without JavaScript none of this runs: the server-rendered cards, the CSS
// columns and the Previous / Show more links keep working.

(function () {
  "use strict";

  var grid = document.getElementById("sr-grid");
  if (!grid) {
    return;
  }

  var template = document.getElementById("sr-card-template");
  var pager = document.getElementById("sr-pager");
  var more = document.getElementById("sr-more");
  var meta = document.getElementById("sr-meta");
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var query = grid.getAttribute("data-query") || "";
  var pageSize = parseInt(grid.getAttribute("data-page-size"), 10) || 24;
  var loading = false;
  var ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*\/img\d+$/;
  var SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var FILE_RE = /^img\d+\.jpg$/;

  // ---- Masonry ----------------------------------------------------------------
  var lastWidth = 0;
  var lastCount = 0;

  function columnsFor(width) {
    if (width < 600) {
      return 2;
    }
    if (width < 1024) {
      return 3;
    }
    if (width < 1440) {
      return 4;
    }
    return 5;
  }

  function gapFor(columns) {
    return columns <= 2 ? 12 : 16;
  }

  function cards() {
    return Array.prototype.slice.call(grid.children).filter(function (node) {
      return node.classList && node.classList.contains("gl-item");
    });
  }

  // Shortest-column placement: each card goes into the column that is
  // currently shortest (the leftmost one when columns are level), so results
  // read in order from left to right and then down.
  function layout(force) {
    var width = grid.clientWidth;
    var list = cards();
    if (!width || !list.length) {
      return;
    }
    if (!force && width === lastWidth && list.length === lastCount) {
      return;
    }
    var columns = columnsFor(window.innerWidth);
    var gap = gapFor(columns);
    var columnWidth = Math.floor((width - gap * (columns - 1)) / columns);

    // Write all widths first, then read all heights (one layout pass).
    list.forEach(function (card) {
      card.style.width = columnWidth + "px";
    });
    var heights = list.map(function (card) {
      return card.offsetHeight;
    });

    var tops = [];
    var i;
    for (i = 0; i < columns; i += 1) {
      tops.push(0);
    }
    list.forEach(function (card, index) {
      var best = 0;
      for (var c = 1; c < columns; c += 1) {
        if (tops[c] < tops[best]) {
          best = c;
        }
      }
      var x = best * (columnWidth + gap);
      var y = tops[best];
      card.style.transform = "translate(" + x + "px, " + y + "px)";
      tops[best] = y + heights[index] + gap;
    });
    grid.style.height = Math.max.apply(null, tops) - gap + "px";
    lastWidth = width;
    lastCount = list.length;
  }

  function startMasonry() {
    grid.classList.add("is-masonry");
    layout(true);
    // Allow the glide animation only after the first placement.
    window.requestAnimationFrame(function () {
      grid.classList.add("is-ready");
    });
    if (typeof window.ResizeObserver === "function") {
      new window.ResizeObserver(function () {
        layout(false);
      }).observe(grid);
    }
    window.addEventListener("resize", function () {
      layout(true);
    });
    window.addEventListener("orientationchange", function () {
      window.setTimeout(function () {
        layout(true);
      }, 150);
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        layout(true);
      });
    }
    window.addEventListener("load", function () {
      layout(true);
    });
  }

  // ---- Building a card from the API ------------------------------------------
  function cleanText(value) {
    return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim() : "";
  }

  // Everything the card needs is derived from fields the API already returns.
  // Nothing is invented: the label is "Image <number>" unless a checked title exists.
  function cardFromResult(result) {
    if (!template || !template.content || !result) {
      return null;
    }
    var id = cleanText(result.id);
    var slug = cleanText(result.style_slug);
    var style = cleanText(result.style);
    var path = cleanText(result.path);
    var galleryUrl = cleanText(result.gallery_url);
    if (!ID_RE.test(id) || !SLUG_RE.test(slug) || id.split("/")[0] !== slug || !style) {
      return null;
    }
    var filename = path.split("/").pop();
    if (!FILE_RE.test(filename) || path.indexOf("images/designs/") !== 0 || path.indexOf("..") !== -1) {
      return null;
    }
    var key = id.split("/")[1];
    if (filename !== key + ".jpg") {
      return null;
    }
    var number = parseInt(result.number, 10) || 0;
    var label = result.title_generated === false && cleanText(result.title) ? cleanText(result.title) : "Image " + number;
    var imageUrl = "/static/" + path;
    var gallery = "/gallery/" + slug + "?image=" + key;
    if (galleryUrl && galleryUrl !== gallery) {
      return null; // the API and our own rules must agree
    }
    var download = slug + "-" + filename;

    var fragment = template.content.cloneNode(true);
    var card = fragment.querySelector(".gl-item");
    if (!card) {
      return null;
    }
    card.setAttribute("data-id", id);
    card.setAttribute("data-key", key);
    card.setAttribute("data-download", download);
    card.setAttribute("data-style", style);
    card.setAttribute("data-gallery", gallery);
    card.setAttribute("data-label", label);

    var thumb = card.querySelector(".gl-thumb");
    thumb.setAttribute("href", gallery);
    thumb.setAttribute("aria-label", "Open " + style + " image " + number);
    var width = parseInt(result.width, 10);
    var height = parseInt(result.height, 10);
    var img = thumb.querySelector("img");
    img.setAttribute("src", imageUrl);
    img.setAttribute("alt", style + " collection, image " + number);
    if (width > 0 && height > 0) {
      thumb.style.setProperty("--ratio", width + " / " + height);
      img.setAttribute("width", String(width));
      img.setAttribute("height", String(height));
    }

    var captionLink = card.querySelector(".sr-caption a");
    captionLink.setAttribute("href", "/gallery/" + slug);
    captionLink.textContent = style;
    card.querySelector(".sr-caption-label").textContent = label;

    var group = card.querySelector(".gl-actions");
    if (group) {
      group.setAttribute("aria-label", "Actions for " + style + " image " + number);
    }
    Array.prototype.forEach.call(card.querySelectorAll("[data-act]"), function (button) {
      var act = button.getAttribute("data-act");
      var names = { like: "Like", save: "Save", share: "Share", download: "Download" };
      button.setAttribute("data-id", id);
      button.setAttribute("aria-label", names[act] + " " + style + " image " + number);
      if (act === "share") {
        button.setAttribute("data-name", style);
      }
      if (act === "download") {
        button.setAttribute("href", imageUrl);
        button.setAttribute("download", download);
      }
    });
    return card;
  }

  // ---- Load More ---------------------------------------------------------------
  var button = null;
  var message = null;

  function hasMore() {
    return grid.getAttribute("data-has-more") === "true";
  }

  function nextOffset() {
    var value = parseInt(grid.getAttribute("data-next-offset"), 10);
    return value >= 0 ? value : null;
  }

  function updateMeta() {
    if (!meta) {
      return;
    }
    var total = parseInt(meta.getAttribute("data-total"), 10) || 0;
    var start = parseInt(meta.getAttribute("data-start"), 10) || 0;
    var shown = cards().length;
    var text = total + (total === 1 ? " photograph" : " photographs");
    if (total > shown) {
      text += " \u00b7 showing " + (start + 1) + "\u2013" + (start + shown);
    }
    meta.textContent = text;
  }

  function renderMore(state, text) {
    if (!more) {
      return;
    }
    more.textContent = "";
    if (state === "hidden") {
      more.hidden = true;
      return;
    }
    more.hidden = false;
    if (state === "done") {
      var done = document.createElement("p");
      done.className = "sr-more-text";
      done.textContent = text;
      more.appendChild(done);
      return;
    }
    if (state === "error") {
      var problem = document.createElement("p");
      problem.className = "sr-more-error";
      problem.setAttribute("role", "alert");
      problem.textContent = text;
      more.appendChild(problem);
    }
    button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-dark sr-more-btn";
    if (state === "loading") {
      button.setAttribute("aria-busy", "true");
      button.disabled = true;
      var spin = document.createElement("span");
      spin.className = "ss-spin";
      spin.setAttribute("aria-hidden", "true");
      button.appendChild(spin);
      button.appendChild(document.createTextNode("Loading\u2026"));
    } else {
      button.textContent = state === "error" ? "Try again" : "Load more";
    }
    button.addEventListener("click", loadMore);
    more.appendChild(button);
  }

  function announce(text) {
    if (meta) {
      // The meta line is a status region: its new text is read out.
      meta.setAttribute("aria-label", text);
      window.setTimeout(function () {
        meta.removeAttribute("aria-label");
      }, 1500);
    }
  }

  function loadMore() {
    if (loading || !hasMore()) {
      return;
    }
    var offset = nextOffset();
    if (offset === null) {
      return;
    }
    loading = true;
    var restoreFocus = !!(more && more.contains(document.activeElement));
    renderMore("loading");
    var url = "/api/search/results?q=" + encodeURIComponent(query) + "&offset=" + offset + "&limit=" + pageSize;
    window
      .fetch(url, { headers: { Accept: "application/json" } })
      .then(function (response) {
        return response.json().then(
          function (data) {
            if (!response.ok) {
              var failure = new Error("http");
              failure.friendly = data && typeof data.message === "string" ? data.message : "";
              throw failure;
            }
            return data;
          },
          function () {
            throw new Error("bad json");
          }
        );
      })
      .then(function (data) {
        var results = Array.isArray(data.results) ? data.results : [];
        var known = {};
        cards().forEach(function (card) {
          known[card.getAttribute("data-id")] = true;
        });
        var fresh = [];
        results.forEach(function (result) {
          var card = cardFromResult(result);
          if (card && !known[card.getAttribute("data-id")]) {
            known[card.getAttribute("data-id")] = true;
            fresh.push(card);
          }
        });
        fresh.forEach(function (card) {
          if (!reduceMotion) {
            card.classList.add("sr-enter");
          }
          grid.appendChild(card);
        });
        grid.setAttribute("data-has-more", data.has_more ? "true" : "false");
        grid.setAttribute("data-next-offset", data.has_more && typeof data.next_offset === "number" ? String(data.next_offset) : "");
        if (window.CoT && typeof window.CoT.syncButtons === "function") {
          window.CoT.syncButtons(grid);
        }
        layout(true);
        if (!reduceMotion) {
          window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
              fresh.forEach(function (card) {
                card.classList.remove("sr-enter");
              });
            });
          });
        }
        updateMeta();
        loading = false;
        if (data.has_more) {
          renderMore("button");
        } else {
          renderMore("done", "That is every photograph for this search.");
        }
        announce(fresh.length + (fresh.length === 1 ? " more photograph loaded." : " more photographs loaded."));
        // If the visitor used the Load More button, move focus to the first new
        // photograph so the next Tab continues from there (the button was replaced).
        if (restoreFocus && fresh.length) {
          var firstLink = fresh[0].querySelector(".gl-thumb");
          if (firstLink) {
            try {
              firstLink.focus({ preventScroll: true });
            } catch (error) {
              firstLink.focus();
            }
          }
        }
        document.dispatchEvent(new CustomEvent("cot:results-updated", { detail: { added: fresh.length } }));
      })
      .catch(function (error) {
        loading = false;
        renderMore("error", (error && error.friendly) || "Could not load more photographs. Check your connection and try again.");
        document.dispatchEvent(new CustomEvent("cot:results-failed"));
      });
  }

  // The image viewer asks for more when the visitor reaches the last loaded photograph.
  document.addEventListener("cot:load-more-request", loadMore);

  // ---- Start --------------------------------------------------------------------
  if (pager) {
    // "Show more" is replaced by the Load More button. "Previous" stays.
    var next = pager.querySelector(".sr-next");
    if (next && next.parentNode) {
      next.parentNode.removeChild(next);
    }
    if (!pager.querySelector("a")) {
      pager.hidden = true;
    }
  }
  startMasonry();
  if (hasMore()) {
    renderMore("button");
  } else if (cards().length > pageSize || parseInt(grid.getAttribute("data-offset"), 10) > 0) {
    renderMore("done", "That is every photograph for this search.");
  }
})();
