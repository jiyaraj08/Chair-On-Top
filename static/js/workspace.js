// Chair on Top - workspace.js
// One moodboard (/moodboards/board?id=...): the canvas, adding and removing
// images, reordering, cover, details, viewer, export and print.
// Boards live in this browser only (localStorage "cot.moodboards.v1").

(function () {
  "use strict";

  var MB = window.MB;
  var app = document.getElementById("mbw-app");
  var missing = document.getElementById("mbw-missing");
  if (!MB || !app || !missing) {
    return;
  }

  var root = document.documentElement;
  var byId = MB.byId;
  var catalog = MB.catalog;
  var el = MB.el;
  var toast = MB.toast;
  var plural = MB.plural;
  var $ = function (id) { return document.getElementById(id); };

  // ---- Which board? --------------------------------------------------------
  var boardId = null;
  try {
    var wanted = new URL(window.location.href).searchParams.get("id");
    boardId = wanted && /^b[a-z0-9]{4,16}$/.test(wanted) ? wanted : null;
  } catch (error) {
    boardId = null;
  }
  var board = boardId ? MB.findBoard(boardId) : null;
  if (!board) {
    missing.hidden = false;
    return;
  }
  app.hidden = false;

  var titleEl = $("mbw-title");
  var descEl = $("mbw-desc");
  var addDescWrap = $("mbw-add-desc-wrap");
  var metaEl = $("mbw-meta");
  var coverThumb = $("mbw-cover-thumb");
  var coverLabel = $("mbw-cover-label");
  var coverChange = $("mbw-cover-change");
  var grid = $("mbw-grid");
  var emptyEl = $("mbw-empty");
  var hintEl = $("mbw-hint");
  var liveEl = $("mbw-live");

  function announce(message) {
    liveEl.textContent = "";
    window.setTimeout(function () {
      liveEl.textContent = message;
    }, 30);
  }

  function label(id) {
    return byId[id] ? MB.imageLabel(byId[id]) : "image";
  }

  function valid() {
    return board.images.filter(function (id) {
      return byId[id];
    });
  }

  function touch() {
    board.updated = Date.now();
  }

  // ---- Header ----------------------------------------------------------------
  function renderHead() {
    titleEl.textContent = board.name;
    document.title = board.name + " - Moodboards - Chair on Top";
    descEl.textContent = board.description;
    descEl.hidden = !board.description;
    addDescWrap.hidden = !!board.description;
    var n = valid().length;
    metaEl.textContent = (n ? plural(n, "image", "images") : "No images yet") + " \u00b7 Updated " + MB.ago(board.updated);

    coverThumb.textContent = "";
    if (board.cover && byId[board.cover]) {
      coverThumb.appendChild(MB.imageNode(byId[board.cover], "eager"));
      coverLabel.textContent = "Cover: " + label(board.cover);
      coverChange.textContent = "Change cover";
    } else {
      coverLabel.textContent = n ? "No cover chosen" : "Add images to choose a cover";
      coverChange.textContent = "Choose a cover";
    }
    coverChange.disabled = !n;
  }

  // ---- Canvas: masonry placed shortest-column-first --------------------------
  var UNIT = 4;
  var nodes = {};

  function ratioOf(item) {
    var r = item && item.width && item.height ? item.height / item.width : 0.75;
    return Math.min(1.35, Math.max(0.72, r)); // keeps crops balanced
  }

  function columnCount(width) {
    return width >= 1000 ? 4 : width >= 640 ? 3 : 2;
  }

  function layout() {
    var width = grid.clientWidth;
    if (!width || grid.hidden) {
      return;
    }
    var cols = columnCount(width);
    var gap = width < 500 ? 12 : 16;
    grid.style.setProperty("--cols", cols);
    grid.style.setProperty("--gap", gap + "px");
    var colWidth = (width - gap * (cols - 1)) / cols;
    var heights = [];
    for (var c = 0; c < cols; c += 1) {
      heights.push(0);
    }
    Array.prototype.forEach.call(grid.children, function (li) {
      var item = byId[li.getAttribute("data-id")];
      var span = Math.max(1, Math.round((colWidth * ratioOf(item) + gap) / UNIT));
      var best = 0;
      for (var i = 1; i < cols; i += 1) {
        if (heights[i] < heights[best]) {
          best = i;
        }
      }
      li.style.gridColumn = String(best + 1);
      li.style.gridRow = heights[best] + 1 + " / span " + span;
      heights[best] += span;
    });
  }

  var layoutQueued = false;
  function queueLayout() {
    if (layoutQueued) {
      return;
    }
    layoutQueued = true;
    window.requestAnimationFrame(function () {
      layoutQueued = false;
      layout();
    });
  }

  if (window.ResizeObserver) {
    new window.ResizeObserver(queueLayout).observe(grid);
  }
  window.addEventListener("resize", queueLayout);

  var ICONS = {
    grip: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>',
    dots: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.2 9.4l6.1-.8z"/></svg>'
  };

  function buildItem(id) {
    var item = byId[id];
    var li = el("li", "mbw-item");
    li.setAttribute("data-id", id);
    li.style.setProperty("--ratio", String(ratioOf(item)));
    var fig = el("figure", "mbw-fig");

    var open = el("button", "mbw-open");
    open.type = "button";
    open.setAttribute("data-act", "open");
    open.appendChild(MB.imageNode(item, "lazy"));
    fig.appendChild(open);

    var badge = el("span", "mbw-badge");
    badge.innerHTML = ICONS.star; // fixed drawing
    badge.appendChild(el("span", "", "Cover"));
    fig.appendChild(badge);

    var handle = el("button", "mbw-ctl mbw-handle");
    handle.type = "button";
    handle.setAttribute("data-act", "drag");
    handle.innerHTML = ICONS.grip;
    fig.appendChild(handle);

    var more = el("button", "mbw-ctl mbw-more");
    more.type = "button";
    more.setAttribute("data-act", "menu");
    more.setAttribute("aria-haspopup", "menu");
    more.setAttribute("aria-expanded", "false");
    more.innerHTML = ICONS.dots;
    fig.appendChild(more);

    li.appendChild(fig);
    return li;
  }

  function refreshItem(li, index, total) {
    var id = li.getAttribute("data-id");
    var name = label(id);
    li.classList.toggle("is-cover", board.cover === id);
    li.querySelector(".mbw-open").setAttribute("aria-label", "View " + name + " larger");
    li.querySelector(".mbw-handle").setAttribute(
      "aria-label",
      "Reorder " + name + ", position " + (index + 1) + " of " + total + ". Use the arrow keys to move it, or drag."
    );
    li.querySelector(".mbw-more").setAttribute("aria-label", "Actions for " + name);
  }

  function renderGrid() {
    var ids = valid();
    Object.keys(nodes).forEach(function (id) {
      if (ids.indexOf(id) === -1) {
        if (nodes[id].parentNode) {
          nodes[id].parentNode.removeChild(nodes[id]);
        }
        delete nodes[id];
      }
    });
    ids.forEach(function (id, index) {
      var li = nodes[id] || (nodes[id] = buildItem(id));
      refreshItem(li, index, ids.length);
      if (grid.children[index] !== li) {
        grid.insertBefore(li, grid.children[index] || null);
      }
    });
    grid.hidden = ids.length === 0;
    emptyEl.hidden = ids.length > 0;
    hintEl.hidden = ids.length === 0;
    layout();
  }

  function renderAll() {
    renderHead();
    renderGrid();
  }

  // ---- Small action menu (anchored on desktop, a bottom sheet on phones) ------
  var menu = null;
  var menuScrim = null;
  var menuAnchor = null;

  function closeMenu(returnFocus) {
    if (!menu) {
      return;
    }
    menu.remove();
    menuScrim.remove();
    menu = menuScrim = null;
    if (menuAnchor) {
      menuAnchor.setAttribute("aria-expanded", "false");
      if (returnFocus !== false) {
        menuAnchor.focus();
      }
    }
    menuAnchor = null;
  }

  function openMenu(anchor, entries) {
    closeMenu(false);
    menuAnchor = anchor;
    anchor.setAttribute("aria-expanded", "true");
    menuScrim = el("div", "mb-menu-scrim");
    menu = el("div", "mb-menu");
    menu.setAttribute("role", "menu");
    entries.forEach(function (entry) {
      if (entry.separator) {
        menu.appendChild(el("div", "mb-menu-sep"));
        return;
      }
      var item = entry.href ? el("a", "mb-menu-item", entry.label) : el("button", "mb-menu-item", entry.label);
      if (entry.href) {
        item.href = entry.href;
      } else {
        item.type = "button";
      }
      item.setAttribute("role", "menuitem");
      if (entry.danger) {
        item.className += " is-danger";
      }
      if (entry.disabled) {
        item.setAttribute("aria-disabled", "true");
        item.className += " is-disabled";
        item.tabIndex = -1;
      }
      item.addEventListener("click", function (event) {
        if (entry.disabled) {
          event.preventDefault();
          return;
        }
        var run = entry.run;
        closeMenu(!entry.href && !entry.keepFocus);
        if (run) {
          run();
        }
      });
      menu.appendChild(item);
    });
    document.body.appendChild(menuScrim);
    document.body.appendChild(menu);

    if (window.innerWidth >= 600) {
      var rect = anchor.getBoundingClientRect();
      var mw = menu.offsetWidth;
      var mh = menu.offsetHeight;
      var left = Math.min(Math.max(8, rect.right - mw), window.innerWidth - mw - 8);
      var top = rect.bottom + 6;
      if (top + mh > window.innerHeight - 8) {
        top = Math.max(8, rect.top - mh - 6);
      }
      menu.style.left = left + "px";
      menu.style.top = top + "px";
    }
    var first = menu.querySelector('[role="menuitem"]:not(.is-disabled)');
    if (first) {
      first.focus();
    }
    menuScrim.addEventListener("click", function () {
      closeMenu();
    });
    menu.addEventListener("keydown", function (event) {
      var items = Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]:not(.is-disabled)'));
      var at = items.indexOf(document.activeElement);
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        items[(at + 1) % items.length].focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        items[(at - 1 + items.length) % items.length].focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        items[0].focus();
      } else if (event.key === "End") {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (event.key === "Tab") {
        closeMenu(false);
      }
    });
  }

  // ---- Changing the board ------------------------------------------------------
  var lastRemoved = null;

  function moveImage(id, to) {
    var from = board.images.indexOf(id);
    to = Math.max(0, Math.min(board.images.length - 1, to));
    if (from === -1 || from === to) {
      return false;
    }
    board.images.splice(from, 1);
    board.images.splice(to, 0, id);
    return true;
  }

  function removeImage(id) {
    var index = board.images.indexOf(id);
    if (index === -1) {
      return;
    }
    var wasCover = board.cover === id;
    board.images.splice(index, 1);
    if (wasCover) {
      board.cover = null;
    }
    touch();
    lastRemoved = { id: id, index: index, wasCover: wasCover };
    MB.save();
    renderAll();
    toast("Removed from this moodboard.", "#undo", "Undo");
    announce(label(id) + " removed.");
  }

  document.addEventListener("click", function (event) {
    var undo = event.target.closest('a[href="#undo"]');
    if (!undo) {
      return;
    }
    event.preventDefault();
    if (lastRemoved && board.images.indexOf(lastRemoved.id) === -1) {
      board.images.splice(Math.min(lastRemoved.index, board.images.length), 0, lastRemoved.id);
      if (lastRemoved.wasCover) {
        board.cover = lastRemoved.id;
      }
      touch();
      MB.save();
      renderAll();
      toast("Image restored.");
    }
    lastRemoved = null;
  });

  function setCover(id) {
    board.cover = id;
    if (id && board.images.indexOf(id) === -1) {
      board.images.unshift(id);
    }
    touch();
    MB.saveWithNotice(id ? "Cover updated." : "Cover removed.");
    renderAll();
  }

  // ---- Dialogs --------------------------------------------------------------------
  var detailsDialog = $("mbw-details-dialog");
  var coverDialog = $("mbw-cover-dialog");
  var addDialog = $("mbw-add-dialog");
  var confirmDialog = $("mbw-confirm-dialog");
  var viewer = $("mbw-viewer");
  if (typeof detailsDialog.showModal !== "function") {
    return;
  }
  [detailsDialog, coverDialog, addDialog, confirmDialog].forEach(MB.wireDialog);

  var lastTrigger = null;
  function openDialog(dialog, trigger) {
    lastTrigger = trigger || document.activeElement;
    MB.openDialog(dialog);
  }
  [detailsDialog, coverDialog, addDialog, confirmDialog].forEach(function (dialog) {
    dialog.addEventListener("close", function () {
      if (lastTrigger && lastTrigger.isConnected && typeof lastTrigger.focus === "function") {
        lastTrigger.focus();
      }
    });
  });

  // -- Edit details
  var detailsForm = $("mbw-details-form");
  var nameInput = $("mbw-name");
  var descInput = $("mbw-desc-input");
  var nameError = $("mbw-name-err");

  function showNameError(message) {
    nameError.hidden = !message;
    nameError.textContent = message || "";
    if (message) {
      nameInput.setAttribute("aria-invalid", "true");
    } else {
      nameInput.removeAttribute("aria-invalid");
    }
  }

  function openDetails(trigger, focusDescription) {
    nameInput.value = board.name;
    descInput.value = board.description;
    showNameError("");
    openDialog(detailsDialog, trigger);
    (focusDescription ? descInput : nameInput).focus();
  }

  nameInput.addEventListener("input", function () {
    if (nameInput.value.trim()) {
      showNameError("");
    }
  });

  detailsForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var name = MB.cleanText(nameInput.value, MB.NAME_MAX);
    if (!name) {
      showNameError("Please give your moodboard a name.");
      nameInput.focus();
      return;
    }
    board.name = name;
    board.description = MB.cleanText(descInput.value, MB.DESC_MAX);
    touch();
    detailsDialog.close();
    renderHead();
    MB.saveWithNotice("Details saved.");
  });

  // -- Choose cover
  var coverForm = $("mbw-cover-form");
  var coverGrid = $("mbw-cover-grid");
  var coverChoice = null;

  function openCover(trigger) {
    if (!valid().length) {
      toast("Add some images first, then choose a cover.");
      return;
    }
    coverChoice = board.cover;
    coverGrid.textContent = "";
    valid().forEach(function (id) {
      var item = byId[id];
      var lab = el("label", "mb-thumb");
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "mbw-cover";
      input.value = id;
      input.checked = id === coverChoice;
      input.setAttribute("aria-label", MB.imageLabel(item));
      lab.appendChild(input);
      var frame = el("span", "mb-thumb-frame");
      frame.appendChild(MB.imageNode(item, "lazy"));
      lab.appendChild(frame);
      var check = el("span", "mb-check");
      check.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
      lab.appendChild(check);
      coverGrid.appendChild(lab);
    });
    $("mbw-cover-none").hidden = !board.cover;
    openDialog(coverDialog, trigger);
    var checked = coverGrid.querySelector("input:checked") || coverGrid.querySelector("input");
    if (checked) {
      checked.focus();
    }
  }

  coverGrid.addEventListener("change", function (event) {
    if (event.target.type === "radio" && MB.isImage(event.target.value)) {
      coverChoice = event.target.value;
    }
  });

  coverForm.addEventListener("submit", function (event) {
    event.preventDefault();
    coverDialog.close();
    if (coverChoice && coverChoice !== board.cover) {
      setCover(coverChoice);
    }
  });

  $("mbw-cover-none").addEventListener("click", function () {
    coverDialog.close();
    setCover(null);
  });

  // -- Add images
  var addSeg = $("mbw-add-seg");
  var addGrid = $("mbw-add-grid");
  var addNone = $("mbw-add-none");
  var addCount = $("mbw-add-count");
  var addSubmit = $("mbw-add-submit");
  var addAll = $("mbw-add-all");
  var addHide = $("mbw-add-hide");
  var strip = $("mbw-strip");
  var stripList = $("mbw-strip-list");
  var addSlug = MB.collectionOrder[0] || null;
  var selection = [];
  var hideAdded = false;

  function renderAddTabs() {
    addSeg.textContent = "";
    MB.collectionOrder.forEach(function (slug) {
      var b = el("button", "mb-seg-btn", MB.collectionName(slug));
      b.type = "button";
      b.setAttribute("data-slug", slug);
      b.setAttribute("aria-pressed", slug === addSlug ? "true" : "false");
      addSeg.appendChild(b);
    });
  }

  function renderAddGrid() {
    addGrid.textContent = "";
    var shown = 0;
    var selectable = 0;
    catalog.forEach(function (item) {
      if (item.slug !== addSlug) {
        return;
      }
      var already = board.images.indexOf(item.id) !== -1;
      if (already && hideAdded) {
        return;
      }
      shown += 1;
      if (!already) {
        selectable += 1;
      }
      var lab = el("label", "mb-thumb" + (already ? " is-added" : ""));
      var input = document.createElement("input");
      input.type = "checkbox";
      input.value = item.id;
      input.disabled = already;
      input.checked = selection.indexOf(item.id) !== -1;
      input.setAttribute("aria-label", MB.imageLabel(item) + (already ? " (already on this board)" : ""));
      lab.appendChild(input);
      var frame = el("span", "mb-thumb-frame");
      frame.appendChild(MB.imageNode(item, "lazy"));
      lab.appendChild(frame);
      var check = el("span", "mb-check");
      check.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
      lab.appendChild(check);
      if (already) {
        lab.appendChild(el("span", "mbw-added", "Added"));
      }
      addGrid.appendChild(lab);
    });
    addNone.hidden = shown > 0;
    addAll.disabled = selectable === 0;
  }

  function renderSelection() {
    var n = selection.length;
    addCount.textContent = n ? plural(n, "image", "images") + " selected" : "No images selected";
    addSubmit.disabled = n === 0;
    addSubmit.textContent = n ? "Add " + plural(n, "image", "images") : "Add selected images";
    strip.hidden = n === 0;
    stripList.textContent = "";
    selection.forEach(function (id) {
      var b = el("button", "mbw-strip-item");
      b.type = "button";
      b.setAttribute("data-id", id);
      b.setAttribute("aria-label", "Remove " + label(id) + " from the selection");
      b.appendChild(MB.imageNode(byId[id], "lazy"));
      stripList.appendChild(b);
    });
  }

  function openAdd(trigger) {
    selection = [];
    hideAdded = false;
    addHide.setAttribute("aria-pressed", "false");
    addSlug = MB.collectionOrder[0] || null;
    renderAddTabs();
    renderAddGrid();
    renderSelection();
    openDialog(addDialog, trigger);
    var firstTab = addSeg.querySelector(".mb-seg-btn");
    if (firstTab) {
      firstTab.focus();
    }
  }

  addSeg.addEventListener("click", function (event) {
    var b = event.target.closest(".mb-seg-btn");
    if (!b) {
      return;
    }
    addSlug = b.getAttribute("data-slug");
    renderAddTabs();
    renderAddGrid();
    addSeg.querySelector('[data-slug="' + addSlug + '"]').focus();
  });

  addGrid.addEventListener("change", function (event) {
    var input = event.target;
    if (!input || input.type !== "checkbox" || !MB.isImage(input.value)) {
      return;
    }
    var at = selection.indexOf(input.value);
    if (input.checked && at === -1) {
      selection.push(input.value);
    } else if (!input.checked && at !== -1) {
      selection.splice(at, 1);
    }
    renderSelection();
  });

  addAll.addEventListener("click", function () {
    catalog.forEach(function (item) {
      if (item.slug === addSlug && board.images.indexOf(item.id) === -1 && selection.indexOf(item.id) === -1) {
        selection.push(item.id);
      }
    });
    renderAddGrid();
    renderSelection();
  });

  addHide.addEventListener("click", function () {
    hideAdded = !hideAdded;
    addHide.setAttribute("aria-pressed", hideAdded ? "true" : "false");
    addHide.textContent = hideAdded ? "Show images already added" : "Hide images already added";
    renderAddGrid();
  });

  stripList.addEventListener("click", function (event) {
    var b = event.target.closest(".mbw-strip-item");
    if (!b) {
      return;
    }
    var at = selection.indexOf(b.getAttribute("data-id"));
    if (at !== -1) {
      selection.splice(at, 1);
    }
    renderAddGrid();
    renderSelection();
  });

  addSubmit.addEventListener("click", function () {
    var added = [];
    selection.forEach(function (id) {
      if (MB.isImage(id) && board.images.indexOf(id) === -1 && board.images.length < MB.MAX_IMAGES) {
        board.images.push(id);
        added.push(id);
      }
    });
    addDialog.close();
    if (!added.length) {
      toast("Those images are already on the board.");
      return;
    }
    touch();
    renderAll();
    MB.saveWithNotice(plural(added.length, "image", "images") + " added.");
    announce(plural(added.length, "image", "images") + " added to the moodboard.");
    var first = nodes[added[0]];
    if (first) {
      added.forEach(function (id) {
        nodes[id].classList.add("is-new");
      });
      first.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  // -- Delete the moodboard
  $("mbw-confirm-yes").addEventListener("click", function () {
    MB.state.boards = MB.state.boards.filter(function (b) {
      return b.id !== board.id;
    });
    MB.save();
    window.location.href = "/moodboards";
  });

  function askDelete(trigger) {
    $("mbw-confirm-text").textContent =
      "\u201c" + board.name + "\u201d will be removed from this browser. The photographs themselves stay in the gallery.";
    openDialog(confirmDialog, trigger);
    confirmDialog.querySelector("[data-close]").focus();
  }

  // ---- Drag to reorder (mouse, touch and pen) ---------------------------------------
  var dragging = null;

  function startDrag(li, event) {
    var id = li.getAttribute("data-id");
    var fig = li.querySelector(".mbw-fig");
    var rect = fig.getBoundingClientRect();
    var ghost = fig.cloneNode(true);
    ghost.className = "mbw-fig mbw-ghost";
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";
    document.body.appendChild(ghost);
    var offX = event.clientX - rect.left;
    var offY = event.clientY - rect.top;
    var original = board.images.slice();
    li.classList.add("is-dragging");
    root.classList.add("mbw-dragging");
    dragging = { id: id, li: li, ghost: ghost, original: original, changed: false };

    var pointerY = event.clientY;
    var scrollTimer = null;

    function place(x, y) {
      ghost.style.transform = "translate(" + (x - offX) + "px," + (y - offY) + "px)";
    }
    place(event.clientX, event.clientY);

    function autoScroll() {
      var edge = 90;
      if (pointerY < edge) {
        window.scrollBy(0, -14);
      } else if (pointerY > window.innerHeight - edge) {
        window.scrollBy(0, 14);
      }
      scrollTimer = window.requestAnimationFrame(autoScroll);
    }
    scrollTimer = window.requestAnimationFrame(autoScroll);

    function onMove(ev) {
      pointerY = ev.clientY;
      place(ev.clientX, ev.clientY);
      // Only look for a new spot once the pointer has left the gap we are holding.
      var here = li.getBoundingClientRect();
      if (ev.clientX >= here.left && ev.clientX <= here.right && ev.clientY >= here.top && ev.clientY <= here.bottom) {
        return;
      }
      var under = document.elementFromPoint(ev.clientX, ev.clientY);
      var target = under && under.closest ? under.closest(".mbw-item") : null;
      if (!target || target === li) {
        return;
      }
      var to = board.images.indexOf(target.getAttribute("data-id"));
      if (to !== -1 && moveImage(id, to)) {
        dragging.changed = true;
        renderGrid();
      }
    }

    function finish(cancel) {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("keydown", onKey);
      window.cancelAnimationFrame(scrollTimer);
      ghost.remove();
      li.classList.remove("is-dragging");
      root.classList.remove("mbw-dragging");
      var changed = dragging.changed;
      dragging = null;
      if (cancel && changed) {
        board.images = original;
        renderGrid();
        announce("Reorder cancelled.");
        return;
      }
      if (changed) {
        touch();
        MB.save();
        renderHead();
        var position = board.images.indexOf(id) + 1;
        announce(label(id) + " moved to position " + position + " of " + board.images.length + ".");
        toast("Order saved.");
      }
    }
    function onUp() { finish(false); }
    function onCancel() { finish(true); }
    function onKey(ev) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        finish(true);
      }
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    document.addEventListener("keydown", onKey);
  }

  grid.addEventListener("pointerdown", function (event) {
    var handle = event.target.closest(".mbw-handle");
    if (!handle || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    event.preventDefault();
    handle.focus();
    startDrag(handle.closest(".mbw-item"), event);
  });

  // Keyboard reordering on the handle.
  grid.addEventListener("keydown", function (event) {
    var handle = event.target.closest(".mbw-handle");
    if (!handle) {
      return;
    }
    var li = handle.closest(".mbw-item");
    var id = li.getAttribute("data-id");
    var at = board.images.indexOf(id);
    var to = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      to = at - 1;
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      to = at + 1;
    } else if (event.key === "Home") {
      to = 0;
    } else if (event.key === "End") {
      to = board.images.length - 1;
    }
    if (to === null) {
      return;
    }
    event.preventDefault();
    if (moveImage(id, to)) {
      touch();
      MB.save();
      renderGrid();
      renderHead();
      nodes[id].querySelector(".mbw-handle").focus();
      announce(label(id) + " moved to position " + (board.images.indexOf(id) + 1) + " of " + board.images.length + ".");
    }
  });

  // ---- Clicks on the canvas -----------------------------------------------------------
  grid.addEventListener("click", function (event) {
    var button = event.target.closest("[data-act]");
    if (!button) {
      return;
    }
    var li = button.closest(".mbw-item");
    var id = li.getAttribute("data-id");
    var act = button.getAttribute("data-act");
    if (act === "open") {
      openViewer(valid().indexOf(id), button);
    } else if (act === "menu") {
      var item = byId[id];
      var index = board.images.indexOf(id);
      openMenu(button, [
        { label: "View larger", run: function () { openViewer(valid().indexOf(id), button); }, keepFocus: true },
        { label: board.cover === id ? "This is the cover" : "Set as cover", disabled: board.cover === id, run: function () { setCover(id); } },
        { label: "View in gallery", href: "/gallery/" + item.slug + "?image=" + item.path.split("/").pop().replace(".jpg", "") },
        { separator: true },
        { label: "Move earlier", disabled: index === 0, run: function () { reorderTo(id, index - 1); } },
        { label: "Move later", disabled: index === board.images.length - 1, run: function () { reorderTo(id, index + 1); } },
        { separator: true },
        { label: "Remove from moodboard", danger: true, run: function () { removeImage(id); } }
      ]);
    }
  });

  function reorderTo(id, to) {
    if (moveImage(id, to)) {
      touch();
      MB.save();
      renderGrid();
      renderHead();
      announce(label(id) + " moved to position " + (board.images.indexOf(id) + 1) + " of " + board.images.length + ".");
      toast("Order saved.");
    }
  }

  // ---- Viewer (same look and actions as the gallery viewer) ----------------------------
  var vImg = $("mbw-v-img");
  var vCaption = $("mbw-v-caption");
  var vCount = $("mbw-v-count");
  var vIndex = 0;
  var vTrigger = null;
  var vItems = [];

  function viewerShow(index) {
    vItems = valid();
    if (!vItems.length) {
      viewer.close();
      return;
    }
    vIndex = (index + vItems.length) % vItems.length;
    var id = vItems[vIndex];
    var item = byId[id];
    var text = "Image " + (vIndex + 1) + " of " + vItems.length;
    vImg.removeAttribute("width");
    vImg.removeAttribute("height");
    if (item.width && item.height) {
      vImg.setAttribute("width", item.width);
      vImg.setAttribute("height", item.height);
    }
    vImg.alt = MB.imageLabel(item);
    vImg.src = "/static/" + item.path;
    vCount.textContent = text;
    vCaption.textContent = item.collection + " \u00b7 " + text;
    ["like", "save", "share", "download"].forEach(function (name) {
      $("mbw-v-" + name).setAttribute("data-id", id);
    });
    $("mbw-v-share").setAttribute("data-name", item.collection);
    $("mbw-v-download").setAttribute("href", "/static/" + item.path);
    $("mbw-v-download").setAttribute("download", id.replace("/", "-") + ".jpg");
    $("mbw-v-gallery").setAttribute("href", "/gallery/" + item.slug + "?image=" + id.split("/")[1]);
    if (window.CoT) {
      window.CoT.syncButtons(viewer);
    }
    if (vItems.length > 1) {
      [vIndex + 1, vIndex - 1].forEach(function (n) {
        var probe = new Image();
        probe.src = "/static/" + byId[vItems[(n + vItems.length) % vItems.length]].path;
      });
    }
  }

  function openViewer(index, trigger) {
    vTrigger = trigger || null;
    viewerShow(index);
    root.classList.add("gl-lock");
    viewer.showModal();
  }

  $("mbw-v-prev").addEventListener("click", function () { viewerShow(vIndex - 1); });
  $("mbw-v-next").addEventListener("click", function () { viewerShow(vIndex + 1); });
  $("mbw-v-close").addEventListener("click", function () { viewer.close(); });
  viewer.addEventListener("click", function (event) {
    if (!event.target.closest(".gl-lb-img, .gl-lb-btn, .gl-lb-caption, .gl-lb-count, .gl-actions, .cot-toast")) {
      viewer.close();
    }
  });
  viewer.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      viewerShow(vIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      viewerShow(vIndex + 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      viewerShow(0);
    } else if (event.key === "End") {
      event.preventDefault();
      viewerShow(vItems.length - 1);
    }
  });
  var sx = 0;
  var sy = 0;
  viewer.addEventListener("touchstart", function (event) {
    if (event.touches.length === 1) {
      sx = event.touches[0].clientX;
      sy = event.touches[0].clientY;
    }
  }, { passive: true });
  viewer.addEventListener("touchend", function (event) {
    if (!event.changedTouches.length) {
      return;
    }
    var dx = event.changedTouches[0].clientX - sx;
    var dy = event.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 60) {
      viewerShow(dx < 0 ? vIndex + 1 : vIndex - 1);
    }
  }, { passive: true });
  vImg.addEventListener("error", function () {
    vCaption.textContent = "This image could not be loaded.";
  });
  viewer.addEventListener("close", function () {
    root.classList.remove("gl-lock");
    if (vTrigger && vTrigger.isConnected) {
      vTrigger.focus();
    }
  });

  // ---- Export as an image ---------------------------------------------------------------
  function wrapText(ctx, text, maxWidth) {
    var lines = [];
    var line = "";
    text.split(" ").forEach(function (word) {
      // A single word wider than the page is broken into pieces that fit.
      while (ctx.measureText(word).width > maxWidth) {
        var cut = word.length - 1;
        while (cut > 1 && ctx.measureText(word.slice(0, cut)).width > maxWidth) {
          cut -= 1;
        }
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      var test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) {
      lines.push(line);
    }
    return lines;
  }

  function roundedClip(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function exportImage() {
    var ids = valid();
    if (!ids.length) {
      toast("Add some images first, then export.");
      return;
    }
    toast("Preparing your moodboard image\u2026");
    var serif = "Georgia, 'Times New Roman', serif";
    try {
      serif = window.getComputedStyle(titleEl).fontFamily || serif;
    } catch (error) { /* keep the default */ }
    var sans = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    var W = 1800;
    var pad = 96;
    var gap = 24;
    var cols = ids.length > 12 ? 4 : 3;
    var colW = (W - pad * 2 - gap * (cols - 1)) / cols;
    var measure = document.createElement("canvas").getContext("2d");

    measure.font = "500 92px " + serif;
    var titleLines = wrapText(measure, board.name, W - pad * 2).slice(0, 3);
    measure.font = "400 34px " + sans;
    var descLines = board.description ? wrapText(measure, board.description, 1200).slice(0, 4) : [];
    var headH = 70 + titleLines.length * 104 + (descLines.length ? 30 + descLines.length * 48 : 0) + 60;

    var heights = [];
    for (var c = 0; c < cols; c += 1) {
      heights.push(0);
    }
    var placed = ids.map(function (id) {
      var h = Math.round(colW * ratioOf(byId[id]));
      var best = 0;
      for (var i = 1; i < cols; i += 1) {
        if (heights[i] < heights[best]) {
          best = i;
        }
      }
      var spot = { id: id, col: best, y: heights[best], w: colW, h: h };
      heights[best] += h + gap;
      return spot;
    });
    var gridH = Math.max.apply(null, heights) - gap;
    var footH = 150;
    var H = headH + gridH + footH;

    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f7f2e9";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#7c5636";
    ctx.font = "600 24px " + sans;
    ctx.textBaseline = "alphabetic";
    ctx.fillText("MOODBOARD", pad, 84);
    ctx.fillStyle = "#2a2622";
    ctx.font = "500 92px " + serif;
    titleLines.forEach(function (line, n) {
      ctx.fillText(line, pad, 70 + 92 + n * 104);
    });
    var y = 70 + titleLines.length * 104;
    if (descLines.length) {
      ctx.fillStyle = "#5d554c";
      ctx.font = "400 34px " + sans;
      descLines.forEach(function (line, n) {
        ctx.fillText(line, pad, y + 30 + 34 + n * 48);
      });
    }

    var chain = Promise.resolve();
    placed.forEach(function (spot) {
      chain = chain.then(function () {
        return loadImage("/static/" + byId[spot.id].path).then(function (img) {
          var x = pad + spot.col * (colW + gap);
          var top = headH + spot.y;
          ctx.save();
          roundedClip(ctx, x, top, spot.w, spot.h, 14);
          ctx.clip();
          if (img) {
            var scale = Math.max(spot.w / img.naturalWidth, spot.h / img.naturalHeight);
            var dw = img.naturalWidth * scale;
            var dh = img.naturalHeight * scale;
            ctx.drawImage(img, x + (spot.w - dw) / 2, top + (spot.h - dh) / 2, dw, dh);
          } else {
            ctx.fillStyle = "#e6dccb";
            ctx.fillRect(x, top, spot.w, spot.h);
          }
          ctx.restore();
          if (img) {
            img.src = ""; // let the browser free the decoded photograph
          }
        });
      });
    });

    chain.then(function () {
      var baseY = headH + gridH + 90;
      ctx.fillStyle = "#c9b48a";
      ctx.fillRect(pad, headH + gridH + 40, 120, 3);
      ctx.fillStyle = "#2a2622";
      ctx.font = "500 36px " + serif;
      ctx.fillText("Chair on Top", pad, baseY + 20);
      ctx.fillStyle = "#5d554c";
      ctx.font = "400 24px " + sans;
      var stamp = "";
      try {
        stamp = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
      } catch (error) { stamp = ""; }
      var tail = plural(ids.length, "image", "images") + (stamp ? " \u00b7 " + stamp : "");
      ctx.textAlign = "right";
      ctx.fillText(tail, W - pad, baseY + 20);
      ctx.textAlign = "left";

      canvas.toBlob(function (blob) {
        if (!blob) {
          toast("Sorry, the image could not be created in this browser.");
          return;
        }
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        var slug = board.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "moodboard";
        link.href = url;
        link.download = "chair-on-top-" + slug + ".png";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        toast("Your moodboard image is ready.");
      }, "image/png");
    });
  }

  // ---- Top bar and menus ----------------------------------------------------------------------
  $("mbw-edit").addEventListener("click", function (event) { openDetails(event.currentTarget, false); });
  $("mbw-add-desc").addEventListener("click", function (event) { openDetails(event.currentTarget, true); });
  $("mbw-add").addEventListener("click", function (event) { openAdd(event.currentTarget); });
  coverChange.addEventListener("click", function (event) { openCover(event.currentTarget); });
  document.addEventListener("click", function (event) {
    var add = event.target.closest("[data-add]");
    if (add) {
      openAdd(add);
    }
  });

  $("mbw-more").addEventListener("click", function (event) {
    var has = valid().length > 0;
    openMenu(event.currentTarget, [
      { label: "Edit title and description", run: function () { openDetails($("mbw-more"), false); }, keepFocus: true },
      { label: "Change cover image", disabled: !has, run: function () { openCover($("mbw-more")); }, keepFocus: true },
      { separator: true },
      { label: "Export as image", disabled: !has, run: exportImage },
      { label: "Print or save as PDF", disabled: !has, run: function () { window.print(); } },
      { separator: true },
      { label: "Delete moodboard", danger: true, run: function () { askDelete($("mbw-more")); }, keepFocus: true }
    ]);
  });

  // Keep several open tabs in step.
  window.addEventListener("storage", function (event) {
    if (event.key !== MB.KEY) {
      return;
    }
    MB.reload();
    var fresh = MB.findBoard(boardId);
    if (!fresh) {
      app.hidden = true;
      missing.hidden = false;
      return;
    }
    board = fresh;
    renderAll();
  });

  renderAll();
})();
