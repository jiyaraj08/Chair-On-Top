// Chair on Top - journal.js
// Used only by the Journal pages. It adds:
//   1. Search and category filters (articles, videos and podcasts)
//   2. Click-to-load video and podcast players
//   3. A safety net for pictures that fail to load
// Every part checks that its elements exist, so it is safe on any Journal page.

(function () {
  "use strict";

  // ---------------------------------------------------------
  // 1. Search and filters
  // ---------------------------------------------------------
  var searchInput = document.getElementById("jn-search");
  var resetButton = document.getElementById("jn-reset");
  var statusLine = document.getElementById("jn-status");
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-jn-item]"));

  var COLLECTIONS = ["articles", "videos", "podcasts"];
  var NAMES = { articles: "articles", videos: "videos", podcasts: "podcasts" };

  if (searchInput && items.length) {
    var state = {
      query: "",
      category: { articles: "all", videos: "all", podcasts: "all" }
    };

    var normalise = function (text) {
      return String(text).toLowerCase().replace(/\s+/g, " ").trim();
    };

    // An item is shown when it passes its collection's category AND the search.
    var matches = function (item) {
      var collection = item.getAttribute("data-collection");
      var wanted = state.category[collection] || "all";
      if (wanted !== "all" && item.getAttribute("data-category") !== wanted) {
        return false;
      }
      if (state.query) {
        var haystack = item.getAttribute("data-search") || "";
        var words = state.query.split(" ");
        for (var i = 0; i < words.length; i += 1) {
          if (haystack.indexOf(words[i]) === -1) {
            return false;
          }
        }
      }
      return true;
    };

    var filtersActive = function () {
      return (
        state.query !== "" ||
        COLLECTIONS.some(function (name) {
          return state.category[name] !== "all";
        })
      );
    };

    var apply = function () {
      var counts = {};
      COLLECTIONS.forEach(function (name) {
        counts[name] = { shown: 0, total: 0 };
      });

      items.forEach(function (item) {
        var name = item.getAttribute("data-collection");
        var show = matches(item);
        item.hidden = !show;
        if (counts[name]) {
          counts[name].total += 1;
          if (show) {
            counts[name].shown += 1;
          }
        }
      });

      COLLECTIONS.forEach(function (name) {
        var empty = document.querySelector('[data-jn-empty="' + name + '"]');
        if (empty) {
          empty.hidden = !(counts[name].total > 0 && counts[name].shown === 0);
        }
      });

      var active = filtersActive();
      if (resetButton) {
        resetButton.hidden = !active;
      }
      if (statusLine) {
        if (!active) {
          statusLine.textContent = "";
        } else {
          var parts = [];
          COLLECTIONS.forEach(function (name) {
            if (counts[name].total > 0) {
              parts.push(counts[name].shown + " of " + counts[name].total + " " + NAMES[name]);
            }
          });
          statusLine.textContent = "Showing " + parts.join(", ") + ".";
        }
      }
    };

    var setChip = function (group, value) {
      var buttons = document.querySelectorAll('[data-jn-filter="' + group + '"] [data-category]');
      var found = false;
      Array.prototype.forEach.call(buttons, function (button) {
        var on = button.getAttribute("data-category") === value;
        button.setAttribute("aria-pressed", on ? "true" : "false");
        if (on) {
          found = true;
        }
      });
      state.category[group] = found ? value : "all";
      if (!found) {
        var all = document.querySelector('[data-jn-filter="' + group + '"] [data-category="all"]');
        if (all) {
          all.setAttribute("aria-pressed", "true");
        }
      }
    };

    var resetAll = function () {
      state.query = "";
      searchInput.value = "";
      COLLECTIONS.forEach(function (name) {
        setChip(name, "all");
      });
      apply();
    };

    searchInput.addEventListener("input", function () {
      state.query = normalise(searchInput.value);
      apply();
    });

    // Category chips (one delegated listener for the whole page).
    document.addEventListener("click", function (event) {
      var chip = event.target.closest("[data-jn-filter] [data-category]");
      if (chip) {
        var group = chip.closest("[data-jn-filter]").getAttribute("data-jn-filter");
        setChip(group, chip.getAttribute("data-category"));
        apply();
        return;
      }
      if (event.target.closest("[data-jn-reset]") || event.target.closest("#jn-reset")) {
        resetAll();
        searchInput.focus();
      }
    });

    // Links like /journal?category=lighting or /journal?q=budget
    try {
      var params = new URLSearchParams(window.location.search);
      var q = params.get("q");
      var category = params.get("category");
      if (q) {
        searchInput.value = q.slice(0, 80);
        state.query = normalise(searchInput.value);
      }
      if (category) {
        setChip("articles", category);
      }
    } catch (error) {
      // Old browsers without URLSearchParams simply skip this.
    }

    apply();
  }

  // ---------------------------------------------------------
  // 2. Click-to-load players (nothing loads until the visitor asks)
  // ---------------------------------------------------------
  var ALLOWED_HOSTS = ["www.youtube-nocookie.com", "open.spotify.com"];

  var loadPlayer = function (button) {
    var url;
    try {
      url = new URL(button.getAttribute("data-embed"), window.location.href);
    } catch (error) {
      return;
    }
    // Only approved providers, only over https.
    if (url.protocol !== "https:" || ALLOWED_HOSTS.indexOf(url.hostname) === -1) {
      return;
    }

    var holder = button.closest("[data-player]");
    if (!holder) {
      var card = button.closest("li");
      holder = card ? card.querySelector("[data-player]") : null;
    }
    if (!holder) {
      return;
    }

    var kind = button.getAttribute("data-kind");
    var frame = document.createElement("iframe");
    frame.className = "jn-iframe";
    frame.src = url.href;
    frame.title = button.getAttribute("data-title") || "Media player";
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    frame.setAttribute("loading", "lazy");
    if (kind === "video") {
      frame.setAttribute(
        "allow",
        "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      );
      frame.setAttribute("allowfullscreen", "");
    } else {
      frame.setAttribute("allow", "encrypted-media");
    }

    // Replace the picture and play button with the player. No autoplay.
    while (holder.firstChild) {
      holder.removeChild(holder.firstChild);
    }
    holder.appendChild(frame);
    if (holder !== button.parentNode && button.parentNode) {
      button.hidden = true;
    }
    frame.focus();
  };

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-embed]");
    if (button) {
      loadPlayer(button);
    }
  });

  // ---------------------------------------------------------
  // 3. Pictures that fail to load: hide them so the colour placeholder shows
  //    (the error event does not bubble, so we listen while it travels down)
  // ---------------------------------------------------------
  document.addEventListener(
    "error",
    function (event) {
      var el = event.target;
      if (el && el.tagName === "IMG" && el.closest(".jn-cover, .jn-thumb")) {
        el.classList.add("is-broken");
      }
    },
    true
  );

  Array.prototype.forEach.call(
    document.querySelectorAll(".jn-cover > img, .jn-thumb img"),
    function (img) {
      if (img.complete && img.naturalWidth === 0) {
        img.classList.add("is-broken");
      }
    }
  );
})();
