// Chair on Top - search.js
// The header search: a drop-down panel with recent searches, hand-picked
// (curated) suggestions and live suggestions from /api/search/suggestions.
//
// Without JavaScript the search icon is a normal link to /search, so nothing
// here is required for search to work.
//
// Storage: recent searches are kept in localStorage under "cot.search.v1".
// This file never reads or writes any other key.

(function () {
  "use strict";

  var trigger = document.querySelector("[data-search-open]");
  var panel = document.getElementById("ss-panel");
  var input = document.getElementById("ss-input");
  var clearButton = document.getElementById("ss-clear");
  var body = document.getElementById("ss-body");
  var form = document.getElementById("ss-form");
  var statusEl = document.getElementById("ss-status");
  if (!trigger || !panel || !input || !body || !form) {
    return;
  }

  var KEY = "cot.search.v1";
  var MAX_RECENT = 10;
  var MAX_LENGTH = 80;
  var MIN_SUGGEST = 2;
  var DEBOUNCE_MS = 200;
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var KIND_LABELS = { style: "Style", colour: "Colour", material: "Material", gallery: "Gallery" };

  // ---- Small helpers --------------------------------------------------------
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null) {
      node.textContent = text;
    }
    return node;
  }

  var SVG_NS = "http://www.w3.org/2000/svg";
  function icon(paths) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    paths.forEach(function (spec) {
      var shape = document.createElementNS(SVG_NS, spec.tag);
      Object.keys(spec.attrs).forEach(function (name) {
        shape.setAttribute(name, spec.attrs[name]);
      });
      svg.appendChild(shape);
    });
    return svg;
  }

  function clockIcon() {
    return icon([
      { tag: "circle", attrs: { cx: "12", cy: "12", r: "8.5" } },
      { tag: "path", attrs: { d: "M12 7.5V12l3 2" } }
    ]);
  }

  function searchIcon() {
    return icon([
      { tag: "circle", attrs: { cx: "11", cy: "11", r: "6.5" } },
      { tag: "path", attrs: { d: "M16 16l4.5 4.5" } }
    ]);
  }

  function closeIcon() {
    return icon([{ tag: "path", attrs: { d: "M6 6l12 12M18 6L6 18" } }]);
  }

  // A link must be a path on this site. This also blocks "//evil.example".
  function safeUrl(url) {
    return typeof url === "string" && url.charAt(0) === "/" && url.charAt(1) !== "/" && url.indexOf("\\") === -1;
  }

  function searchUrl(text) {
    return "/search?q=" + encodeURIComponent(text);
  }

  function announce(message) {
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  // ---- Recent searches (cot.search.v1) ---------------------------------------
  var memoryRecent = null; // used only if the browser blocks localStorage

  function cleanText(value) {
    if (typeof value !== "string") {
      return "";
    }
    // eslint-disable-next-line no-control-regex
    var text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    return text.length > MAX_LENGTH ? text.slice(0, MAX_LENGTH).trim() : text;
  }

  function cleanList(list) {
    var out = [];
    var seen = {};
    if (!Array.isArray(list)) {
      return out;
    }
    list.forEach(function (value) {
      var text = cleanText(value);
      var lower = text.toLowerCase();
      if (text && !seen[lower] && out.length < MAX_RECENT) {
        seen[lower] = true;
        out.push(text);
      }
    });
    return out;
  }

  function readRecent() {
    if (memoryRecent) {
      return memoryRecent.slice();
    }
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) {
        return [];
      }
      var data = JSON.parse(raw);
      // Accept the current shape {v:1, recent:[...]} and a plain array.
      if (data && Array.isArray(data.recent)) {
        return cleanList(data.recent);
      }
      return cleanList(data);
    } catch (error) {
      return []; // malformed or blocked: behave as if there is no history
    }
  }

  function writeRecent(list) {
    var clean = cleanList(list);
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ v: 1, recent: clean }));
      memoryRecent = null;
    } catch (error) {
      memoryRecent = clean;
    }
  }

  function addRecent(text) {
    var value = cleanText(text);
    if (!value) {
      return;
    }
    var lower = value.toLowerCase();
    var rest = readRecent().filter(function (item) {
      return item.toLowerCase() !== lower;
    });
    rest.unshift(value);
    writeRecent(rest.slice(0, MAX_RECENT));
  }

  function removeRecent(text) {
    var lower = String(text).toLowerCase();
    writeRecent(
      readRecent().filter(function (item) {
        return item.toLowerCase() !== lower;
      })
    );
  }

  function clearRecent() {
    try {
      window.localStorage.removeItem(KEY);
      memoryRecent = null;
    } catch (error) {
      memoryRecent = [];
    }
  }

  // The results page marks the form with the query that produced results.
  (function recordPageQuery() {
    var pageForm = document.getElementById("sr-form");
    var query = pageForm ? pageForm.getAttribute("data-record") : "";
    if (query) {
      addRecent(query);
    }
  })();

  // ---- Network ---------------------------------------------------------------
  var cache = {}; // query -> suggestions response
  var cacheCount = 0;
  var curated = null; // { list, note } once loaded
  var pending = null; // AbortController of the request in flight
  var timer = null;
  var requestId = 0;

  function fetchJson(url, signal) {
    return window.fetch(url, { headers: { Accept: "application/json" }, signal: signal }).then(function (response) {
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
    });
  }

  function abortPending() {
    if (pending && typeof pending.abort === "function") {
      pending.abort();
    }
    pending = null;
  }

  // ---- Rendering -------------------------------------------------------------
  var view = { mode: "idle", state: "ok", suggestions: [], message: "" };
  var activeIndex = -1;
  var optionCounter = 0;

  function options() {
    return Array.prototype.slice.call(body.querySelectorAll('[role="option"]'));
  }

  function setActive(index) {
    var list = options();
    list.forEach(function (option, i) {
      var on = i === index;
      option.classList.toggle("is-active", on);
      option.setAttribute("aria-selected", on ? "true" : "false");
    });
    activeIndex = index;
    if (index >= 0 && list[index]) {
      input.setAttribute("aria-activedescendant", list[index].id);
      if (typeof list[index].scrollIntoView === "function") {
        list[index].scrollIntoView({ block: "nearest" });
      }
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function makeOption(opts) {
    // opts: { href, label, meta, count, recent, record }
    var row = el("li", "ss-row");
    row.setAttribute("role", "presentation");
    var link = el("a", "ss-opt");
    link.id = "ss-opt-" + ++optionCounter;
    link.href = opts.href;
    link.setAttribute("role", "option");
    link.setAttribute("aria-selected", "false");
    if (opts.record) {
      link.setAttribute("data-record", opts.record);
    }
    if (opts.recent) {
      link.setAttribute("data-recent", opts.recent);
    }
    if (opts.recent) {
      var clock = clockIcon();
      clock.setAttribute("class", "ss-opt-icon");
      link.appendChild(clock);
    } else if (opts.withIcon) {
      var glass = searchIcon();
      glass.setAttribute("class", "ss-opt-icon");
      link.appendChild(glass);
    }
    var text = el("span", "ss-opt-text");
    text.appendChild(el("span", "ss-opt-label", opts.label));
    if (opts.meta) {
      text.appendChild(el("span", "ss-opt-meta", opts.meta));
    }
    link.appendChild(text);
    if (typeof opts.count === "number") {
      link.appendChild(el("span", "ss-opt-count", opts.count + (opts.count === 1 ? " photograph" : " photographs")));
    }
    row.appendChild(link);
    if (opts.recent) {
      var remove = el("button", "ss-remove");
      remove.type = "button";
      remove.setAttribute("data-remove", opts.recent);
      remove.setAttribute("aria-label", "Remove " + opts.recent + " from recent searches");
      remove.appendChild(closeIcon());
      row.appendChild(remove);
    }
    return row;
  }

  function section(titleText, buttonText, buttonAttr) {
    var wrap = el("section", "ss-section");
    var head = el("div", "ss-head");
    var title = el("h2", "ss-title", titleText);
    title.id = "ss-h-" + ++optionCounter;
    head.appendChild(title);
    if (buttonText) {
      var button = el("button", "ss-link-btn", buttonText);
      button.type = "button";
      button.setAttribute(buttonAttr, "1");
      head.appendChild(button);
    }
    wrap.appendChild(head);
    return { wrap: wrap, labelId: title.id };
  }

  function listbox(labelId, extraClass) {
    var list = el("ul", "ss-list" + (extraClass ? " " + extraClass : ""));
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-labelledby", labelId);
    return list;
  }

  function stateBlock(kind, heading, message, retry) {
    var block = el("div", "ss-state");
    block.setAttribute("data-state", kind);
    if (kind === "loading") {
      var spinner = el("span", "ss-spin");
      spinner.setAttribute("aria-hidden", "true");
      block.appendChild(spinner);
    }
    if (heading) {
      block.appendChild(el("strong", "", heading));
    }
    if (message) {
      block.appendChild(el("p", "", message));
    }
    if (retry) {
      var button = el("button", "btn btn-outline", "Try again");
      button.type = "button";
      button.setAttribute("data-retry", "1");
      block.appendChild(button);
    }
    return block;
  }

  function renderRecent(into) {
    var recent = readRecent();
    if (!recent.length) {
      return;
    }
    var parts = section("Recent searches", "Clear all", "data-clear-all");
    var list = listbox(parts.labelId);
    recent.forEach(function (text) {
      list.appendChild(makeOption({ href: searchUrl(text), label: text, recent: text, record: text }));
    });
    parts.wrap.appendChild(list);
    into.appendChild(parts.wrap);
  }

  function renderCurated(into) {
    var parts = section("Curated suggestions");
    parts.wrap.appendChild(
      el("p", "ss-note", (curated && curated.note) || "Hand-picked by Chair on Top. These are suggestions, not live trends.")
    );
    if (curated && curated.list && curated.list.length) {
      var list = listbox(parts.labelId, "ss-chips");
      curated.list.forEach(function (item) {
        if (!item || typeof item.label !== "string" || !safeUrl(item.url)) {
          return;
        }
        list.appendChild(
          makeOption({
            href: item.url,
            label: item.label,
            count: typeof item.count === "number" ? item.count : null,
            record: item.kind === "gallery" ? "" : item.label
          })
        );
      });
      parts.wrap.appendChild(list);
    } else if (view.curatedState === "loading") {
      parts.wrap.appendChild(stateBlock("loading", "", "Loading suggestions\u2026"));
    } else if (view.curatedState === "error") {
      parts.wrap.appendChild(stateBlock("error", "", "Suggestions could not be loaded. You can still search.", true));
    }
    into.appendChild(parts.wrap);
  }

  function renderSuggestions(into) {
    if (view.state === "loading") {
      into.appendChild(stateBlock("loading", "", "Searching\u2026"));
      return;
    }
    if (view.state === "error") {
      into.appendChild(
        stateBlock(
          "error",
          "Suggestions are not available",
          view.message || "Something went wrong. Press Enter to search anyway, or try again.",
          !view.noRetry
        )
      );
      return;
    }
    if (view.state === "short") {
      into.appendChild(stateBlock("hint", "", "Keep typing: suggestions start at " + MIN_SUGGEST + " letters."));
      return;
    }
    var typed = cleanText(input.value);
    var parts = section("Suggestions");
    var list = listbox(parts.labelId);
    list.appendChild(
      makeOption({ href: searchUrl(typed), label: "Search for \u201c" + typed + "\u201d", withIcon: true, record: typed })
    );
    view.suggestions.forEach(function (item) {
      if (!item || typeof item.label !== "string" || !safeUrl(item.url)) {
        return;
      }
      var meta = (KIND_LABELS[item.kind] || "") + (item.detail ? (KIND_LABELS[item.kind] ? " \u00b7 " : "") + item.detail : "");
      list.appendChild(
        makeOption({
          href: item.url,
          label: item.label,
          meta: meta,
          count: typeof item.count === "number" ? item.count : null,
          record: item.kind === "gallery" ? "" : item.label
        })
      );
    });
    parts.wrap.appendChild(list);
    into.appendChild(parts.wrap);
    if (!view.suggestions.length) {
      var none = stateBlock("empty", "No suggestions for \u201c" + typed + "\u201d", "Press Enter to search the gallery anyway, or try a style, colour or material.");
      into.appendChild(none);
    }
  }

  function render() {
    body.textContent = "";
    optionCounter = 0;
    if (view.mode === "idle") {
      renderRecent(body);
      renderCurated(body);
    } else {
      renderSuggestions(body);
    }
    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");
    var count = options().length;
    if (view.mode === "typing" && view.state === "ok") {
      announce(count + (count === 1 ? " suggestion" : " suggestions") + " available. Use the up and down arrows.");
    }
  }

  // ---- Loading data ----------------------------------------------------------
  function loadCurated() {
    if (curated || view.curatedState === "loading") {
      return;
    }
    view.curatedState = "loading";
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    fetchJson("/api/search/suggestions", controller ? controller.signal : undefined)
      .then(function (data) {
        curated = {
          list: Array.isArray(data.curated) ? data.curated : [],
          note: typeof data.curated_note === "string" ? data.curated_note : ""
        };
        view.curatedState = "ok";
        if (view.mode === "idle" && isOpen()) {
          render();
        }
      })
      .catch(function () {
        view.curatedState = "error";
        if (view.mode === "idle" && isOpen()) {
          render();
        }
      });
  }

  function loadSuggestions(text) {
    var key = text.toLowerCase();
    if (cache[key]) {
      view.state = "ok";
      view.suggestions = cache[key];
      render();
      return;
    }
    abortPending();
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    pending = controller;
    var mine = ++requestId;
    view.state = "loading";
    render();
    fetchJson("/api/search/suggestions?q=" + encodeURIComponent(text), controller ? controller.signal : undefined)
      .then(function (data) {
        if (mine !== requestId) {
          return; // an older request: ignore it
        }
        var list = Array.isArray(data.suggestions) ? data.suggestions : [];
        if (cacheCount > 60) {
          cache = {};
          cacheCount = 0;
        }
        cache[key] = list;
        cacheCount += 1;
        view.state = "ok";
        view.suggestions = list;
        render();
      })
      .catch(function (error) {
        if (mine !== requestId || (error && error.name === "AbortError")) {
          return;
        }
        view.state = "error";
        view.noRetry = !!(error && error.friendly);
        view.message = (error && error.friendly) || "";
        render();
      });
  }

  function onInput() {
    var raw = input.value;
    clearButton.hidden = raw.length === 0;
    var text = cleanText(raw);
    window.clearTimeout(timer);
    if (!text) {
      abortPending();
      requestId += 1;
      view.mode = "idle";
      render();
      loadCurated();
      return;
    }
    view.mode = "typing";
    if (text.length < MIN_SUGGEST) {
      abortPending();
      requestId += 1;
      view.state = "short";
      render();
      return;
    }
    if (!cache[text.toLowerCase()]) {
      view.state = "loading";
      render();
    }
    timer = window.setTimeout(function () {
      loadSuggestions(text);
    }, DEBOUNCE_MS);
  }

  // ---- Open and close --------------------------------------------------------
  var closeTimer = null;

  function isOpen() {
    return !panel.hidden && panel.classList.contains("is-open");
  }

  function closeMenu() {
    var menuButton = document.querySelector(".nav-toggle");
    if (menuButton && menuButton.getAttribute("aria-expanded") === "true") {
      menuButton.click();
    }
  }

  function open() {
    if (isOpen()) {
      return;
    }
    window.clearTimeout(closeTimer);
    closeMenu();
    panel.hidden = false;
    void panel.offsetWidth; // lets the opening animation start from the hidden state
    panel.classList.add("is-open");
    void panel.offsetWidth; // the panel must count as visible before it can take focus
    trigger.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-expanded", "true");
    clearButton.hidden = input.value.length === 0;
    if (cleanText(input.value)) {
      onInput();
    } else {
      view.mode = "idle";
      render();
      loadCurated();
    }
    try {
      input.focus({ preventScroll: true });
    } catch (error) {
      input.focus();
    }
  }

  function close(returnFocus) {
    window.clearTimeout(timer);
    abortPending();
    requestId += 1;
    if (panel.hidden && !panel.classList.contains("is-open")) {
      return;
    }
    panel.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(
      function () {
        if (!panel.classList.contains("is-open")) {
          panel.hidden = true;
        }
      },
      reduceMotion ? 0 : 220
    );
    if (returnFocus) {
      trigger.focus();
    }
  }

  // The icon is a real link (so it works without JavaScript). With JavaScript
  // it behaves like a button.
  trigger.setAttribute("role", "button");
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", "ss-panel");

  trigger.addEventListener("click", function (event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return; // keep the normal link for "open in a new tab"
    }
    event.preventDefault();
    if (isOpen()) {
      close(false);
    } else {
      open();
    }
  });

  trigger.addEventListener("keydown", function (event) {
    if (event.key === " ") {
      event.preventDefault();
      if (isOpen()) {
        close(false);
      } else {
        open();
      }
    }
  });

  // Opening the menu closes the search panel.
  var menuToggle = document.querySelector(".nav-toggle");
  if (menuToggle) {
    menuToggle.addEventListener("click", function () {
      if (isOpen()) {
        close(false);
      }
    });
  }

  // Outside clicks: pointerdown fires before any re-render, so a click on a
  // remove button (which re-draws the list) is never mistaken for an outside click.
  document.addEventListener("pointerdown", function (event) {
    if (isOpen() && !panel.contains(event.target) && !trigger.contains(event.target)) {
      close(false);
    }
  });

  // Leaving the panel with the keyboard (Tab) closes it.
  panel.addEventListener("focusout", function (event) {
    var next = event.relatedTarget;
    if (next && !panel.contains(next) && !trigger.contains(next)) {
      close(false);
    }
  });

  // Escape closes the panel wherever the focus is.
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isOpen() && !panel.contains(event.target)) {
      close(true);
    }
  });

  // A page restored from the back/forward cache starts with the panel closed.
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      panel.classList.remove("is-open");
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    }
  });

  // ---- Input, keyboard and clicks -------------------------------------------
  input.addEventListener("input", onInput);

  clearButton.addEventListener("click", function () {
    input.value = "";
    onInput();
    input.focus();
  });

  input.addEventListener("keydown", function (event) {
    var list = options();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!list.length) {
        return;
      }
      var next;
      if (event.key === "ArrowDown") {
        next = activeIndex + 1 >= list.length ? 0 : activeIndex + 1;
      } else {
        next = activeIndex <= 0 ? list.length - 1 : activeIndex - 1;
      }
      setActive(next);
    } else if (event.key === "Enter") {
      if (activeIndex >= 0 && list[activeIndex]) {
        event.preventDefault();
        list[activeIndex].click();
      }
      // Otherwise the form submits normally (see the submit handler).
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Delete" && activeIndex >= 0 && list[activeIndex] && list[activeIndex].getAttribute("data-recent")) {
      event.preventDefault();
      removeRecent(list[activeIndex].getAttribute("data-recent"));
      var keep = activeIndex;
      render();
      var after = options();
      setActive(after.length ? Math.min(keep, after.length - 1) : -1);
    }
  });

  // Escape also works when focus is on a button inside the panel.
  panel.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && event.target !== input) {
      event.preventDefault();
      close(true);
    }
  });

  form.addEventListener("submit", function (event) {
    var text = cleanText(input.value);
    if (!text) {
      event.preventDefault();
      input.focus();
      return;
    }
    input.value = text;
    addRecent(text);
  });

  body.addEventListener("click", function (event) {
    var remove = event.target.closest("[data-remove]");
    if (remove) {
      event.preventDefault();
      removeRecent(remove.getAttribute("data-remove"));
      render();
      announce("Removed from recent searches.");
      input.focus();
      return;
    }
    if (event.target.closest("[data-clear-all]")) {
      event.preventDefault();
      clearRecent();
      render();
      announce("Recent searches cleared.");
      input.focus();
      return;
    }
    var retry = event.target.closest("[data-retry]");
    if (retry) {
      event.preventDefault();
      if (view.mode === "idle") {
        view.curatedState = "";
        render();
        loadCurated();
        render();
      } else {
        loadSuggestions(cleanText(input.value));
      }
      input.focus();
      return;
    }
    var link = event.target.closest('[role="option"]');
    if (link) {
      var record = link.getAttribute("data-record");
      if (record) {
        addRecent(record);
      }
      // The link then opens normally.
    }
  });

  // Moving the mouse over an option makes it the active one.
  body.addEventListener("mousemove", function (event) {
    var link = event.target.closest('[role="option"]');
    if (!link) {
      return;
    }
    var index = options().indexOf(link);
    if (index !== activeIndex) {
      setActive(index);
    }
  });

  // Keep a mouse click on the panel from stealing focus from the input.
  body.addEventListener("mousedown", function (event) {
    if (event.target.closest("button, a")) {
      event.preventDefault();
    }
  });
})();
