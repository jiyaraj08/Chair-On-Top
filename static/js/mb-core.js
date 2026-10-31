// Chair on Top - mb-core.js
// Shared by the Moodboards pages: the 64-image catalogue, the board store
// (localStorage key "cot.moodboards.v1") and a few small helpers.
// It never touches "cot.v1" (likes and saves) or "cot.theme".

(function () {
  "use strict";

  var KEY = "cot.moodboards.v1";
  var MAX_BOARDS = 30;
  var MAX_IMAGES = 200;
  var NAME_MAX = 60;
  var DESC_MAX = 160;
  var BOARD_ID_RE = /^b[a-z0-9]{4,16}$/;
  var IMAGE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*\/img\d+$/;

  // ---- The real gallery images (supplied by the server) -------------------
  var catalog = [];
  try {
    catalog = JSON.parse(document.getElementById("cot-catalog").textContent);
  } catch (error) {
    catalog = [];
  }
  var byId = {};
  var collectionOrder = [];
  catalog.forEach(function (item) {
    byId[item.id] = item;
    if (collectionOrder.indexOf(item.slug) === -1) {
      collectionOrder.push(item.slug);
    }
  });

  function isImage(id) {
    if (typeof id !== "string") {
      return false;
    }
    // If the catalogue could not be read, keep well-formed ids rather than lose data.
    return catalog.length ? Object.prototype.hasOwnProperty.call(byId, id) : IMAGE_ID_RE.test(id);
  }

  // ---- Storage (untrusted input: everything is checked) -------------------
  var persistent = true;
  try {
    window.localStorage.setItem("cot.test", "1");
    window.localStorage.removeItem("cot.test");
  } catch (error) {
    persistent = false;
  }

  function cleanText(value, max) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
  }

  function cleanTime(value) {
    return typeof value === "number" && isFinite(value) && value > 0 ? value : Date.now();
  }

  function cleanBoard(raw) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !BOARD_ID_RE.test(raw.id)) {
      return null;
    }
    var name = cleanText(raw.name, NAME_MAX);
    if (!name) {
      return null;
    }
    var images = [];
    if (Array.isArray(raw.images)) {
      raw.images.forEach(function (id) {
        if (isImage(id) && images.indexOf(id) === -1 && images.length < MAX_IMAGES) {
          images.push(id);
        }
      });
    }
    var cover = isImage(raw.cover) ? raw.cover : null;
    if (cover && images.indexOf(cover) === -1 && images.length < MAX_IMAGES) {
      images.unshift(cover); // the cover is always one of the board's images
    }
    return {
      id: raw.id,
      name: name,
      description: cleanText(raw.description, DESC_MAX),
      cover: cover,
      images: images,
      created: cleanTime(raw.created),
      updated: cleanTime(raw.updated)
    };
  }

  function loadBoards() {
    var data = null;
    if (persistent) {
      try {
        data = JSON.parse(window.localStorage.getItem(KEY));
      } catch (error) {
        data = null; // damaged data: start with an empty studio
      }
    }
    var boards = [];
    var seen = {};
    if (data && typeof data === "object" && Array.isArray(data.boards)) {
      data.boards.forEach(function (raw) {
        var board = cleanBoard(raw);
        if (board && !seen[board.id] && boards.length < MAX_BOARDS) {
          seen[board.id] = true;
          boards.push(board);
        }
      });
    }
    return boards;
  }

  var state = { v: 1, boards: loadBoards() };

  function reload() {
    state.boards = loadBoards();
  }

  function save() {
    if (!persistent) {
      return false;
    }
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      persistent = false;
      return false;
    }
  }

  function toast(message, href, linkText) {
    if (window.CoT && window.CoT.toast) {
      window.CoT.toast(message, href, linkText);
    }
  }

  function saveWithNotice(message) {
    var kept = save();
    toast(kept ? message : message + " It will be lost when you close this page: this browser is blocking storage.");
    return kept;
  }

  function findBoard(id) {
    for (var i = 0; i < state.boards.length; i += 1) {
      if (state.boards[i].id === id) {
        return state.boards[i];
      }
    }
    return null;
  }

  function newId() {
    var id;
    do {
      id = "b" + Math.random().toString(36).slice(2, 10);
    } while (!BOARD_ID_RE.test(id) || findBoard(id));
    return id;
  }

  // ---- Small helpers -------------------------------------------------------
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

  function plural(n, one, many) {
    return n + " " + (n === 1 ? one : many);
  }

  function ago(time) {
    var minutes = Math.floor((Date.now() - time) / 60000);
    if (minutes < 1) {
      return "just now";
    }
    if (minutes < 60) {
      return plural(minutes, "minute", "minutes") + " ago";
    }
    var hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return plural(hours, "hour", "hours") + " ago";
    }
    var days = Math.floor(hours / 24);
    if (days === 1) {
      return "yesterday";
    }
    if (days < 14) {
      return days + " days ago";
    }
    try {
      return "on " + new Date(time).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    } catch (error) {
      return "a while ago";
    }
  }

  function collectionName(slug) {
    for (var i = 0; i < catalog.length; i += 1) {
      if (catalog[i].slug === slug) {
        return catalog[i].collection;
      }
    }
    return slug;
  }

  function imageLabel(item) {
    return item.collection + " image " + item.number;
  }

  function imageNode(item, loading) {
    var img = document.createElement("img");
    img.src = "/static/" + item.path;
    if (item.width && item.height) {
      img.width = item.width;
      img.height = item.height;
    }
    img.alt = "";
    img.loading = loading || "lazy";
    img.decoding = "async";
    img.addEventListener("error", function () {
      if (img.parentNode) {
        img.parentNode.classList.add("is-missing");
      }
      img.hidden = true;
    });
    return img;
  }

  // ---- Dialog helpers --------------------------------------------------------
  var root = document.documentElement;

  function openDialog(dialog) {
    root.classList.add("dialog-lock"); // phones: stop the page behind from scrolling
    dialog.showModal();
  }

  function wireDialog(dialog) {
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog || event.target.closest("[data-close]")) {
        dialog.close();
      }
    });
    dialog.addEventListener("close", function () {
      if (!document.querySelector("dialog[open]")) {
        root.classList.remove("dialog-lock");
      }
    });
  }

  window.MB = {
    KEY: KEY,
    MAX_BOARDS: MAX_BOARDS,
    MAX_IMAGES: MAX_IMAGES,
    NAME_MAX: NAME_MAX,
    DESC_MAX: DESC_MAX,
    catalog: catalog,
    byId: byId,
    collectionOrder: collectionOrder,
    state: state,
    isImage: isImage,
    cleanText: cleanText,
    reload: reload,
    save: save,
    saveWithNotice: saveWithNotice,
    toast: toast,
    findBoard: findBoard,
    newId: newId,
    el: el,
    plural: plural,
    ago: ago,
    collectionName: collectionName,
    imageLabel: imageLabel,
    imageNode: imageNode,
    openDialog: openDialog,
    wireDialog: wireDialog,
    persistent: function () { return persistent; }
  };
})();
