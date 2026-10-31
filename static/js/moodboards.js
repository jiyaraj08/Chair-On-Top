// Chair on Top - moodboards.js
// The Moodboards page (/moodboards): list, create, rename and delete.
// Boards are kept in this browser only (localStorage, key "cot.moodboards.v1").
// Nothing here touches "cot.v1" (likes and saves) or "cot.theme".

(function () {
  "use strict";

  var root = document.documentElement;
  var grid = document.getElementById("mb-grid");
  var empty = document.getElementById("mb-empty");
  var countEl = document.getElementById("mb-count");
  var createButton = document.getElementById("mb-create");
  if (!grid || !empty || !countEl || !createButton) {
    return;
  }

  // ---- Shared catalogue, store and helpers (mb-core.js) ---------------------
  var MB = window.MB;
  if (!MB) {
    return;
  }
  var state = MB.state;
  var catalog = MB.catalog;
  var byId = MB.byId;
  var collectionOrder = MB.collectionOrder;
  var MAX_BOARDS = MB.MAX_BOARDS;
  var MAX_IMAGES = MB.MAX_IMAGES;
  var NAME_MAX = MB.NAME_MAX;
  var DESC_MAX = MB.DESC_MAX;
  var isImage = MB.isImage;
  var cleanText = MB.cleanText;
  var toast = MB.toast;
  var saveWithNotice = MB.saveWithNotice;
  var newId = MB.newId;
  var findBoard = MB.findBoard;
  var el = MB.el;
  var plural = MB.plural;
  var ago = MB.ago;
  var imageNode = MB.imageNode;
  var KEY = MB.KEY;

  var PLACEHOLDER_ART =
    '<svg viewBox="0 0 160 120" aria-hidden="true" focusable="false">' +
    '<path d="M52 100V50a28 28 0 0 1 56 0v50M80 22v78M52 66h56M30 100h100"/></svg>';

  // ---- Cards ---------------------------------------------------------------
  function previewIds(board) {
    var ids = [];
    if (board.cover) {
      ids.push(board.cover);
    }
    board.images.forEach(function (id) {
      if (ids.indexOf(id) === -1) {
        ids.push(id);
      }
    });
    return ids.filter(function (id) {
      return catalog.length ? byId[id] : false;
    });
  }

  function buildCollage(board) {
    var ids = previewIds(board);
    var collage = el("div", "mb-collage");
    if (!ids.length) {
      collage.className += " is-empty";
      var art = el("div", "mb-collage-art");
      art.innerHTML = PLACEHOLDER_ART; // fixed drawing, no user text
      collage.appendChild(art);
      collage.appendChild(el("p", "mb-collage-caption", "A blank canvas"));
      return collage;
    }
    var shown = ids.slice(0, 3);
    collage.className += " mb-n" + shown.length;
    shown.forEach(function (id, index) {
      var tile = el("div", "mb-tile");
      tile.appendChild(imageNode(byId[id], index === 0 ? "eager" : "lazy"));
      if (index === 2 && ids.length > 3) {
        tile.appendChild(el("span", "mb-more", "+" + (ids.length - 3)));
      }
      collage.appendChild(tile);
    });
    return collage;
  }

  function buildCard(board) {
    var li = el("li", "mb-card");
    li.setAttribute("data-id", board.id);
    li.tabIndex = -1;
    li.appendChild(buildCollage(board));

    var body = el("div", "mb-card-body");
    var title = el("h3", "mb-card-title");
    var link = el("a", "mb-card-link", board.name);
    link.href = "/moodboards/board?id=" + encodeURIComponent(board.id);
    title.appendChild(link);
    body.appendChild(title);
    var total = previewIds(board).length;
    body.appendChild(
      el("p", "mb-card-meta", (total ? plural(total, "image", "images") : "No images yet") + " \u00b7 Updated " + ago(board.updated))
    );
    if (board.description) {
      body.appendChild(el("p", "mb-card-desc", board.description));
    }
    li.appendChild(body);

    var actions = el("div", "mb-card-actions");
    var rename = el("button", "mb-text-btn", "Rename");
    rename.type = "button";
    rename.setAttribute("data-act", "rename");
    rename.setAttribute("aria-label", "Rename " + board.name);
    var remove = el("button", "mb-text-btn is-danger", "Delete");
    remove.type = "button";
    remove.setAttribute("data-act", "delete");
    remove.setAttribute("aria-label", "Delete " + board.name);
    actions.appendChild(rename);
    actions.appendChild(remove);
    li.appendChild(actions);
    return li;
  }

  function buildNewTile() {
    var li = el("li", "mb-new-item");
    var button = el("button", "mb-new");
    button.type = "button";
    button.setAttribute("data-create", "");
    button.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>';
    button.appendChild(el("span", "mb-new-label", "New moodboard"));
    li.appendChild(button);
    return li;
  }

  function render() {
    var boards = state.boards.slice().sort(function (a, b) {
      return b.updated - a.updated;
    });
    countEl.textContent = boards.length ? plural(boards.length, "moodboard", "moodboards") : "No moodboards yet";

    grid.textContent = "";
    if (!boards.length) {
      grid.hidden = true;
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    grid.hidden = false;
    boards.forEach(function (board) {
      grid.appendChild(buildCard(board));
    });
    if (boards.length < MAX_BOARDS) {
      grid.appendChild(buildNewTile());
    }
  }

  // ---- Dialog helpers --------------------------------------------------------
  var openCount = 0;
  var lastTrigger = null;

  function openDialog(dialog, trigger) {
    lastTrigger = trigger || document.activeElement;
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

  var formDialog = document.getElementById("mb-form-dialog");
  var confirmDialog = document.getElementById("mb-confirm-dialog");
  if (typeof formDialog.showModal !== "function") {
    createButton.hidden = true;
    return;
  }
  wireDialog(formDialog);
  wireDialog(confirmDialog);

  // ---- Create / rename form --------------------------------------------------
  var form = document.getElementById("mb-form");
  var formTitle = document.getElementById("mb-form-title");
  var nameInput = document.getElementById("mb-name");
  var descInput = document.getElementById("mb-desc");
  var nameError = document.getElementById("mb-name-err");
  var submitButton = document.getElementById("mb-submit");
  var coverThumb = document.getElementById("mb-cover-thumb");
  var coverLabel = document.getElementById("mb-cover-label");
  var coverToggle = document.getElementById("mb-cover-toggle");
  var coverClear = document.getElementById("mb-cover-clear");
  var picker = document.getElementById("mb-picker");
  var seg = document.getElementById("mb-seg");
  var thumbs = document.getElementById("mb-thumbs");

  var editingId = null;
  var chosenCover = null;
  var pickerSlug = collectionOrder[0] || null;

  var collectionName = MB.collectionName;
  var imageLabel = MB.imageLabel;

  function showNameError(message) {
    if (message) {
      nameError.textContent = message;
      nameError.hidden = false;
      nameInput.setAttribute("aria-invalid", "true");
    } else {
      nameError.hidden = true;
      nameError.textContent = "";
      nameInput.removeAttribute("aria-invalid");
    }
  }

  function renderCoverRow() {
    coverThumb.textContent = "";
    if (chosenCover && byId[chosenCover]) {
      coverThumb.appendChild(imageNode(byId[chosenCover], "eager"));
      coverLabel.textContent = imageLabel(byId[chosenCover]);
      coverClear.hidden = false;
      coverToggle.textContent = "Change cover image";
    } else {
      coverLabel.textContent = "No cover chosen. The board will use its own images.";
      coverClear.hidden = true;
      coverToggle.textContent = "Choose a cover image";
    }
  }

  function renderPicker() {
    seg.textContent = "";
    collectionOrder.forEach(function (slug) {
      var button = el("button", "mb-seg-btn", collectionName(slug));
      button.type = "button";
      button.setAttribute("data-slug", slug);
      button.setAttribute("aria-pressed", slug === pickerSlug ? "true" : "false");
      seg.appendChild(button);
    });
    thumbs.textContent = "";
    catalog.forEach(function (item) {
      if (item.slug !== pickerSlug) {
        return;
      }
      var label = el("label", "mb-thumb");
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "mb-cover";
      input.value = item.id;
      input.checked = item.id === chosenCover;
      input.setAttribute("aria-label", imageLabel(item));
      label.appendChild(input);
      var frame = el("span", "mb-thumb-frame");
      frame.appendChild(imageNode(item, "lazy"));
      label.appendChild(frame);
      var check = el("span", "mb-check");
      check.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
      label.appendChild(check);
      thumbs.appendChild(label);
    });
  }

  function setPickerOpen(open) {
    picker.hidden = !open;
    coverToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      renderPicker();
    }
  }

  function openForm(board, trigger) {
    editingId = board ? board.id : null;
    chosenCover = board ? board.cover : null;
    pickerSlug = chosenCover && byId[chosenCover] ? byId[chosenCover].slug : collectionOrder[0] || null;
    formTitle.textContent = board ? "Rename moodboard" : "Create moodboard";
    submitButton.textContent = board ? "Save changes" : "Create moodboard";
    nameInput.value = board ? board.name : "";
    descInput.value = board ? board.description : "";
    showNameError("");
    setPickerOpen(false);
    renderCoverRow();
    coverToggle.hidden = !catalog.length;
    openDialog(formDialog, trigger);
    nameInput.focus();
    if (board) {
      nameInput.select();
    }
  }

  coverToggle.addEventListener("click", function () {
    setPickerOpen(picker.hidden);
  });

  coverClear.addEventListener("click", function () {
    chosenCover = null;
    renderCoverRow();
    if (!picker.hidden) {
      renderPicker();
    }
    coverToggle.focus();
  });

  seg.addEventListener("click", function (event) {
    var button = event.target.closest(".mb-seg-btn");
    if (!button) {
      return;
    }
    pickerSlug = button.getAttribute("data-slug");
    renderPicker();
    var again = seg.querySelector('[data-slug="' + pickerSlug + '"]');
    if (again) {
      again.focus();
    }
  });

  thumbs.addEventListener("change", function (event) {
    var input = event.target;
    if (input && input.type === "radio" && isImage(input.value)) {
      chosenCover = input.value;
      renderCoverRow();
    }
  });

  nameInput.addEventListener("input", function () {
    if (nameInput.value.trim()) {
      showNameError("");
    }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var name = cleanText(nameInput.value, NAME_MAX);
    if (!name) {
      showNameError("Please give your moodboard a name.");
      nameInput.focus();
      return;
    }
    var description = cleanText(descInput.value, DESC_MAX);
    var now = Date.now();
    var focusId;

    if (editingId) {
      var board = findBoard(editingId);
      if (!board) {
        formDialog.close();
        render();
        return;
      }
      board.name = name;
      board.description = description;
      board.cover = chosenCover && isImage(chosenCover) ? chosenCover : null;
      if (board.cover && board.images.indexOf(board.cover) === -1 && board.images.length < MAX_IMAGES) {
        board.images.unshift(board.cover);
      }
      board.updated = now;
      focusId = board.id;
      formDialog.close();
      render();
      saveWithNotice("Moodboard updated.");
    } else {
      if (state.boards.length >= MAX_BOARDS) {
        showNameError("You have reached the limit of " + MAX_BOARDS + " moodboards. Delete one to make room.");
        return;
      }
      var created = {
        id: newId(),
        name: name,
        description: description,
        cover: chosenCover && isImage(chosenCover) ? chosenCover : null,
        images: chosenCover && isImage(chosenCover) ? [chosenCover] : [],
        created: now,
        updated: now
      };
      state.boards.push(created);
      focusId = created.id;
      formDialog.close();
      render();
      saveWithNotice("\u201c" + name + "\u201d is ready. Moodboard created.");
    }
    var card = grid.querySelector('[data-id="' + focusId + '"]');
    if (card) {
      card.classList.add("is-new");
      card.focus({ preventScroll: true });
      card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  // ---- Delete ----------------------------------------------------------------
  var pendingDelete = null;

  document.getElementById("mb-confirm-yes").addEventListener("click", function () {
    var board = pendingDelete && findBoard(pendingDelete);
    pendingDelete = null;
    confirmDialog.close();
    if (!board) {
      return;
    }
    state.boards = state.boards.filter(function (item) {
      return item.id !== board.id;
    });
    render();
    saveWithNotice("Moodboard deleted.");
    (state.boards.length ? grid.querySelector(".mb-card .mb-text-btn") : createButton).focus();
  });

  confirmDialog.addEventListener("close", function () {
    pendingDelete = null;
  });

  // ---- Wiring ------------------------------------------------------------------
  document.addEventListener("click", function (event) {
    var make = event.target.closest("#mb-create, [data-create]");
    if (make) {
      if (state.boards.length >= MAX_BOARDS) {
        toast("You have reached the limit of " + MAX_BOARDS + " moodboards.");
        return;
      }
      openForm(null, make);
      return;
    }
    var button = event.target.closest(".mb-card [data-act]");
    if (!button) {
      return;
    }
    var card = button.closest(".mb-card");
    var board = findBoard(card.getAttribute("data-id"));
    if (!board) {
      return;
    }
    if (button.getAttribute("data-act") === "rename") {
      openForm(board, button);
    } else if (button.getAttribute("data-act") === "delete") {
      pendingDelete = board.id;
      document.getElementById("mb-confirm-text").textContent =
        "\u201c" + board.name + "\u201d will be removed from this browser. The photographs themselves stay in the gallery.";
      openDialog(confirmDialog, button);
      document.getElementById("mb-confirm-yes").blur();
      confirmDialog.querySelector("[data-close]").focus();
    }
  });

  // Keep several open tabs in step.
  window.addEventListener("storage", function (event) {
    if (event.key === KEY) {
      MB.reload();
      render();
    }
  });

  render();
})();
