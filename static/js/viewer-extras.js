// Chair on Top - viewer-extras.js
// Adds two buttons to the EXISTING image viewer (the <dialog id="gl-lightbox">):
//   - "Save to moodboard": adds or removes the photograph on one of your boards,
//   - "Related photographs": more from the same collection, plus curated style
//     recommendations.
// It does not create a second viewer and does not touch Like, Save, Share or
// Download. It follows whichever photograph the viewer shows by watching the
// data-id of the viewer's Like button (gallery.js keeps that up to date).
//
// Moodboards live in localStorage under "cot.moodboards.v1" (the same schema
// mb-core.js uses). Every write re-reads the stored data first, changes only the
// board you picked and keeps every other field exactly as it was. If the stored
// data cannot be read, nothing is written.

(function () {
  "use strict";

  var dialog = document.getElementById("gl-lightbox");
  var likeButton = document.getElementById("gl-lb-like");
  var actions = dialog ? dialog.querySelector(".gl-lb-actions") : null;
  var inner = dialog ? dialog.querySelector(".gl-lb-inner") : null;
  if (!dialog || !likeButton || !actions || !inner) {
    return;
  }

  var BOARD_KEY = "cot.moodboards.v1";
  var MAX_BOARDS = 30;
  var MAX_IMAGES = 200;
  var NAME_MAX = 60;
  var BOARD_ID_RE = /^b[a-z0-9]{4,16}$/;
  var ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*\/img\d+$/;
  var SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var GALLERY_RE = /^\/gallery\/[a-z0-9]+(?:-[a-z0-9]+)*\?image=img\d+$/;
  var FILE_RE = /^img\d+\.jpg$/;

  // ---- Small helpers ------------------------------------------------------------
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  function svg(paths, extra) {
    var ns = "http://www.w3.org/2000/svg";
    var icon = document.createElementNS(ns, "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");
    paths.forEach(function (d) {
      var path = document.createElementNS(ns, "path");
      path.setAttribute("d", d);
      icon.appendChild(path);
    });
    if (extra) {
      icon.setAttribute("class", extra);
    }
    return icon;
  }

  function toast(message, href, linkText) {
    if (window.CoT && typeof window.CoT.toast === "function") {
      window.CoT.toast(message, href, linkText);
    }
  }

  function currentId() {
    var id = likeButton.getAttribute("data-id") || "";
    return ID_RE.test(id) ? id : "";
  }

  // ---- Moodboard storage --------------------------------------------------------
  var persistent = true;
  try {
    window.localStorage.setItem("cot.test", "1");
    window.localStorage.removeItem("cot.test");
  } catch (error) {
    persistent = false;
  }

  // Returns { data, boards } or { error: "blocked" | "damaged" }.
  function readStore() {
    if (!persistent) {
      return { error: "blocked" };
    }
    var raw = null;
    try {
      raw = window.localStorage.getItem(BOARD_KEY);
    } catch (error) {
      return { error: "blocked" };
    }
    var data;
    if (raw === null) {
      data = { v: 1, boards: [] };
    } else {
      try {
        data = JSON.parse(raw);
      } catch (error) {
        return { error: "damaged" };
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { error: "damaged" };
      }
      if (data.boards === undefined) {
        data.boards = [];
      }
      if (!Array.isArray(data.boards)) {
        return { error: "damaged" };
      }
    }
    var boards = data.boards.filter(function (board) {
      return board && typeof board === "object" && typeof board.id === "string" && BOARD_ID_RE.test(board.id) &&
        typeof board.name === "string" && board.name.trim();
    });
    return { data: data, boards: boards };
  }

  function writeStore(data) {
    try {
      window.localStorage.setItem(BOARD_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      return false;
    }
  }

  function boardHas(board, id) {
    return Array.isArray(board.images) && board.images.indexOf(id) !== -1;
  }

  function anyBoardHas(id) {
    var store = readStore();
    return !!store.boards && store.boards.some(function (board) {
      return boardHas(board, id);
    });
  }

  function newBoardId(boards) {
    var id;
    var taken = {};
    boards.forEach(function (board) {
      taken[board.id] = true;
    });
    do {
      id = "b" + Math.random().toString(36).slice(2, 10);
    } while (!BOARD_ID_RE.test(id) || taken[id]);
    return id;
  }

  // Add (or remove) the photograph on one board. Returns a message for the toast, or "".
  function toggleOnBoard(boardId, imageId) {
    var store = readStore();
    if (!store.boards) {
      return "";
    }
    var board = store.boards.filter(function (b) {
      return b.id === boardId;
    })[0];
    if (!board) {
      return "That moodboard could not be found.";
    }
    if (!Array.isArray(board.images)) {
      board.images = [];
    }
    var index = board.images.indexOf(imageId);
    var message;
    if (index === -1) {
      if (board.images.length >= MAX_IMAGES) {
        return "That moodboard is full (" + MAX_IMAGES + " photographs).";
      }
      board.images.push(imageId);
      message = "Added to \u201c" + board.name + "\u201d.";
    } else {
      board.images.splice(index, 1);
      if (board.cover === imageId) {
        board.cover = null; // a board's cover must be one of its images
      }
      message = "Removed from \u201c" + board.name + "\u201d.";
    }
    board.updated = Date.now();
    return writeStore(store.data) ? message : "Not saved: this browser is blocking storage.";
  }

  function createBoard(name, imageId) {
    var store = readStore();
    if (!store.boards) {
      return { message: "" };
    }
    var clean = name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
    if (!clean) {
      return { message: "Give the moodboard a name first." };
    }
    if (store.data.boards.length >= MAX_BOARDS) {
      return { message: "You have reached the limit of " + MAX_BOARDS + " moodboards." };
    }
    var now = Date.now();
    store.data.boards.push({
      id: newBoardId(store.data.boards),
      name: clean,
      description: "",
      cover: null,
      images: [imageId],
      created: now,
      updated: now
    });
    if (typeof store.data.v !== "number") {
      store.data.v = 1;
    }
    if (!writeStore(store.data)) {
      return { message: "Not saved: this browser is blocking storage." };
    }
    return { message: "Created \u201c" + clean + "\u201d and added the photograph.", created: true };
  }

  // ---- The two buttons ---------------------------------------------------------
  var boardButton = el("button", "gl-act vx-btn");
  boardButton.type = "button";
  boardButton.setAttribute("data-vx", "board");
  boardButton.setAttribute("aria-haspopup", "dialog");
  boardButton.setAttribute("aria-expanded", "false");
  boardButton.setAttribute("aria-pressed", "false");
  boardButton.setAttribute("aria-label", "Save this image to a moodboard");
  boardButton.title = "Save to moodboard";
  boardButton.appendChild(svg(["M4 4h7v7H4z", "M13 4h7v4h-7z", "M13 10h7v10h-7z", "M4 13h7v7H4z"]));

  var relatedButton = el("button", "gl-act vx-btn");
  relatedButton.type = "button";
  relatedButton.setAttribute("data-vx", "related");
  relatedButton.setAttribute("aria-haspopup", "dialog");
  relatedButton.setAttribute("aria-expanded", "false");
  relatedButton.setAttribute("aria-label", "Show related photographs");
  relatedButton.title = "Related photographs";
  relatedButton.appendChild(svg(["M3 7h13v13H3z", "M8 3h13v13"]));

  actions.appendChild(boardButton);
  actions.appendChild(relatedButton);

  // ---- Panels ------------------------------------------------------------------
  function makePanel(kind, label) {
    var panel = el("div", "vx-panel vx-" + kind);
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", label);
    panel.hidden = true;
    // Clicks inside a panel must not reach the viewer's "click outside closes" rule,
    // and arrow keys must not move to another photograph while someone types.
    panel.addEventListener("click", function (event) {
      event.stopPropagation();
    });
    panel.addEventListener("keydown", function (event) {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        closePanels(true);
      }
    });
    inner.appendChild(panel);
    return panel;
  }

  var boardPanel = makePanel("board", "Save to moodboard");
  var relatedPanel = makePanel("related", "Related photographs");

  function isOpen(panel) {
    return !panel.hidden;
  }

  // Keep the panel just above the row of action buttons, so the buttons stay
  // reachable (a second click on the same button closes the panel).
  function place(panel) {
    var box = inner.getBoundingClientRect();
    var row = actions.getBoundingClientRect();
    panel.style.bottom = Math.max(8, Math.round(box.bottom - row.top + 10)) + "px";
    panel.style.maxHeight = Math.max(160, Math.round(row.top - box.top - 70)) + "px";
  }

  function placeOpen() {
    [boardPanel, relatedPanel].forEach(function (panel) {
      if (isOpen(panel)) {
        place(panel);
      }
    });
  }

  function closePanels(returnFocus) {
    var which = isOpen(boardPanel) ? boardButton : isOpen(relatedPanel) ? relatedButton : null;
    boardPanel.hidden = true;
    relatedPanel.hidden = true;
    boardButton.setAttribute("aria-expanded", "false");
    relatedButton.setAttribute("aria-expanded", "false");
    if (relatedAbort) {
      relatedAbort.abort();
      relatedAbort = null;
    }
    if (returnFocus && which) {
      which.focus();
    }
  }

  function panelHead(title, onClose) {
    var head = el("div", "vx-head");
    head.appendChild(el("h3", "vx-title", title));
    var close = el("button", "vx-close");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.appendChild(svg(["M6 6l12 12", "M18 6L6 18"]));
    close.addEventListener("click", onClose);
    head.appendChild(close);
    return head;
  }

  // ---- Moodboard panel ---------------------------------------------------------
  function refreshBoardButton() {
    var id = currentId();
    var on = !!id && anyBoardHas(id);
    boardButton.setAttribute("aria-pressed", on ? "true" : "false");
    boardButton.classList.toggle("is-on", on);
  }

  function renderBoardPanel(focusSelector) {
    var id = currentId();
    boardPanel.textContent = "";
    boardPanel.appendChild(panelHead("Save to moodboard", function () {
      closePanels(true);
    }));
    var store = readStore();

    if (store.error) {
      boardPanel.appendChild(el("p", "vx-note",
        store.error === "blocked"
          ? "This browser is blocking storage, so moodboards cannot be saved here."
          : "Your saved moodboards could not be read, so nothing was changed. Open Moodboards to check them."));
      var back = el("a", "vx-link", "Open Moodboards");
      back.href = "/moodboards";
      boardPanel.appendChild(back);
      return;
    }

    if (!store.boards.length) {
      boardPanel.appendChild(el("p", "vx-note", "You have no moodboards yet. Name one to start."));
    } else {
      var list = el("ul", "vx-boards");
      store.boards.forEach(function (board) {
        var item = el("li");
        var has = boardHas(board, id);
        var row = el("button", "vx-row");
        row.type = "button";
        row.setAttribute("data-board", board.id);
        row.setAttribute("aria-pressed", has ? "true" : "false");
        row.appendChild(el("span", "vx-row-name", board.name));
        var count = Array.isArray(board.images) ? board.images.length : 0;
        row.appendChild(el("span", "vx-row-count", count + (count === 1 ? " photograph" : " photographs")));
        row.appendChild(el("span", "vx-row-state", has ? "Added" : "Add"));
        row.addEventListener("click", function () {
          var message = toggleOnBoard(board.id, id);
          if (message) {
            toast(message, "/moodboards", "Open Moodboards");
          }
          refreshBoardButton();
          renderBoardPanel('[data-board="' + board.id + '"]');
        });
        item.appendChild(row);
        list.appendChild(item);
      });
      boardPanel.appendChild(list);
    }

    var form = el("form", "vx-new");
    form.setAttribute("novalidate", "");
    var label = el("label", "visually-hidden", "New moodboard name");
    label.setAttribute("for", "vx-new-name");
    var input = el("input", "vx-input");
    input.id = "vx-new-name";
    input.type = "text";
    input.maxLength = NAME_MAX;
    input.placeholder = "New moodboard name";
    input.autocomplete = "off";
    var submit = el("button", "vx-create", "Create and add");
    submit.type = "submit";
    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(submit);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var result = createBoard(input.value, id);
      if (result.message) {
        toast(result.message, result.created ? "/moodboards" : "", result.created ? "Open Moodboards" : "");
      }
      if (result.created) {
        refreshBoardButton();
        renderBoardPanel();
      } else {
        input.focus();
      }
    });
    boardPanel.appendChild(form);

    var open = el("a", "vx-link", "Open Moodboards");
    open.href = "/moodboards";
    boardPanel.appendChild(open);

    if (focusSelector) {
      var target = boardPanel.querySelector(focusSelector);
      if (target) {
        target.focus();
      }
    }
  }

  boardButton.addEventListener("click", function () {
    if (!currentId()) {
      return;
    }
    if (isOpen(boardPanel)) {
      closePanels(true);
      return;
    }
    closePanels(false);
    renderBoardPanel();
    boardPanel.hidden = false;
    place(boardPanel);
    boardButton.setAttribute("aria-expanded", "true");
    var first = boardPanel.querySelector(".vx-row, .vx-input");
    if (first) {
      first.focus();
    }
  });

  // ---- Related panel -----------------------------------------------------------
  var relatedCache = {};
  var relatedAbort = null;

  function safeCard(card) {
    if (!card || typeof card !== "object") {
      return null;
    }
    var id = typeof card.id === "string" ? card.id : "";
    var slug = typeof card.style_slug === "string" ? card.style_slug : "";
    var path = typeof card.path === "string" ? card.path : "";
    var gallery = typeof card.gallery_url === "string" ? card.gallery_url : "";
    var style = typeof card.style === "string" ? card.style : "";
    if (!ID_RE.test(id) || !SLUG_RE.test(slug) || id.split("/")[0] !== slug || !style) {
      return null;
    }
    if (path.indexOf("images/designs/") !== 0 || path.indexOf("..") !== -1 || !FILE_RE.test(path.split("/").pop())) {
      return null;
    }
    if (!GALLERY_RE.test(gallery)) {
      return null;
    }
    return {
      id: id,
      style: style,
      number: parseInt(card.number, 10) || 0,
      path: path,
      gallery: gallery,
      width: parseInt(card.width, 10) || 0,
      height: parseInt(card.height, 10) || 0
    };
  }

  function thumb(card) {
    var link = el("a", "vx-thumb");
    link.href = card.gallery;
    link.setAttribute("aria-label", "Show " + card.style + " image " + card.number);
    var img = el("img");
    img.src = "/static/" + card.path;
    img.alt = card.style + " collection, image " + card.number;
    img.loading = "lazy";
    img.decoding = "async";
    if (card.width > 0 && card.height > 0) {
      img.width = card.width;
      img.height = card.height;
    }
    link.appendChild(img);
    link.addEventListener("click", function (event) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      document.dispatchEvent(new CustomEvent("cot:viewer-goto", { detail: { id: card.id, href: card.gallery } }));
    });
    return link;
  }

  function row(cards) {
    var strip = el("ul", "vx-strip");
    cards.forEach(function (raw) {
      var card = safeCard(raw);
      if (card) {
        var item = el("li");
        item.appendChild(thumb(card));
        strip.appendChild(item);
      }
    });
    return strip.children.length ? strip : null;
  }

  function section(title, note) {
    var block = el("section", "vx-section");
    block.appendChild(el("h4", "vx-sub", title));
    if (note) {
      block.appendChild(el("p", "vx-note vx-note-small", note));
    }
    return block;
  }

  function renderRelated(data) {
    var body = relatedPanel.querySelector(".vx-body");
    body.textContent = "";
    body.removeAttribute("aria-busy");
    var shown = 0;

    var same = row(data.same_collection || []);
    if (same) {
      var a = section("More from " + (typeof data.style === "string" ? data.style : "this collection"));
      a.appendChild(same);
      body.appendChild(a);
      shown += 1;
    }

    var shared = row(data.shared_details || []);
    if (shared) {
      var b = section("Shares checked details", typeof data.shared_details_note === "string" ? data.shared_details_note : "");
      b.appendChild(shared);
      body.appendChild(b);
      shown += 1;
    }

    var styles = Array.isArray(data.related_styles) ? data.related_styles : [];
    var curated = section("Curated style recommendations", typeof data.related_styles_note === "string" ? data.related_styles_note : "");
    var curatedShown = 0;
    styles.forEach(function (style) {
      var strip = row(style && style.images ? style.images : []);
      var slug = style && typeof style.slug === "string" && SLUG_RE.test(style.slug) ? style.slug : "";
      var name = style && typeof style.name === "string" ? style.name : "";
      if (!strip || !slug || !name) {
        return;
      }
      var head = el("p", "vx-style");
      var link = el("a", "vx-style-link", name);
      link.href = "/explore?style=" + encodeURIComponent(slug);
      head.appendChild(link);
      curated.appendChild(head);
      curated.appendChild(strip);
      curatedShown += 1;
    });
    if (curatedShown) {
      body.appendChild(curated);
      shown += 1;
    }

    if (!shown) {
      body.appendChild(el("p", "vx-note", "No related photographs were found for this image."));
    }
  }

  function loadRelated(id) {
    var body = relatedPanel.querySelector(".vx-body");
    if (relatedCache[id]) {
      renderRelated(relatedCache[id]);
      return;
    }
    body.textContent = "";
    body.setAttribute("aria-busy", "true");
    body.appendChild(el("p", "vx-note", "Finding related photographs\u2026"));
    var parts = id.split("/");
    if (relatedAbort) {
      relatedAbort.abort();
    }
    var controller = typeof window.AbortController === "function" ? new window.AbortController() : null;
    relatedAbort = controller;
    window.fetch("/api/related/" + encodeURIComponent(parts[0]) + "/" + encodeURIComponent(parts[1]), {
      headers: { Accept: "application/json" },
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("http");
        }
        return response.json();
      })
      .then(function (data) {
        if (!data || typeof data !== "object" || data.id !== id) {
          throw new Error("shape");
        }
        relatedCache[id] = data;
        if (currentId() === id && isOpen(relatedPanel)) {
          renderRelated(data);
        }
      })
      .catch(function (error) {
        if (error && error.name === "AbortError") {
          return;
        }
        if (currentId() !== id || !isOpen(relatedPanel)) {
          return;
        }
        body.textContent = "";
        body.removeAttribute("aria-busy");
        var problem = el("p", "vx-note vx-error", "Related photographs could not be loaded.");
        problem.setAttribute("role", "alert");
        body.appendChild(problem);
        var retry = el("button", "vx-create", "Try again");
        retry.type = "button";
        retry.addEventListener("click", function () {
          loadRelated(id);
        });
        body.appendChild(retry);
        retry.focus();
      });
  }

  relatedPanel.appendChild(panelHead("Related photographs", function () {
    closePanels(true);
  }));
  relatedPanel.appendChild(el("div", "vx-body"));

  relatedButton.addEventListener("click", function () {
    var id = currentId();
    if (!id) {
      return;
    }
    if (isOpen(relatedPanel)) {
      closePanels(true);
      return;
    }
    closePanels(false);
    relatedPanel.hidden = false;
    place(relatedPanel);
    relatedButton.setAttribute("aria-expanded", "true");
    loadRelated(id);
    var close = relatedPanel.querySelector(".vx-close");
    if (close) {
      close.focus();
    }
  });

  // ---- Follow the viewer -------------------------------------------------------
  if (typeof window.MutationObserver === "function") {
    new window.MutationObserver(function () {
      var id = currentId();
      if (!id) {
        return;
      }
      refreshBoardButton();
      if (isOpen(boardPanel)) {
        renderBoardPanel();
      }
      if (isOpen(relatedPanel)) {
        loadRelated(id); // the panel stays open and follows the photograph
      }
    }).observe(likeButton, { attributes: true, attributeFilter: ["data-id"] });
  }

  window.addEventListener("resize", placeOpen);
  window.addEventListener("orientationchange", placeOpen);

  dialog.addEventListener("close", function () {
    closePanels(false);
  });
  dialog.addEventListener("cancel", function (event) {
    if (isOpen(boardPanel) || isOpen(relatedPanel)) {
      event.preventDefault();
      closePanels(true);
    }
  });

  // Moodboards changed in another tab.
  window.addEventListener("storage", function (event) {
    if (event.key === BOARD_KEY || event.key === null) {
      refreshBoardButton();
      if (isOpen(boardPanel)) {
        renderBoardPanel();
      }
    }
  });

  refreshBoardButton();
})();
