// Chair on Top - actions.js
// Like, Save, Share and Download for photographs. Loaded on every page that
// shows photographs. Likes and saves live in this browser only (localStorage):
// they do not sync between devices or browsers.

(function () {
  "use strict";

  var KEY = "cot.v1";
  // An image id is "<collection-slug>/img<number>", for example "japandi/img3".
  var ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*\/img\d+$/;

  var persistent = true;
  try {
    window.localStorage.setItem("cot.test", "1");
    window.localStorage.removeItem("cot.test");
  } catch (error) {
    persistent = false;
  }

  // Storage is untrusted: keep only well-formed, unique ids.
  function clean(list) {
    var out = [];
    var seen = {};
    if (Array.isArray(list)) {
      list.forEach(function (value) {
        if (typeof value === "string" && value.length < 80 && ID_RE.test(value) && !seen[value]) {
          seen[value] = true;
          out.push(value);
        }
      });
    }
    return out;
  }

  function load() {
    var data = null;
    if (persistent) {
      try {
        data = JSON.parse(window.localStorage.getItem(KEY));
      } catch (error) {
        data = null; // corrupted: start fresh
      }
    }
    data = data && typeof data === "object" ? data : {};
    return { likes: clean(data.likes), saves: clean(data.saves) };
  }

  var state = load();

  function write() {
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

  function has(kind, id) {
    return state[kind].indexOf(id) !== -1;
  }

  function syncButtons(root) {
    var scope = root || document;
    var buttons = scope.querySelectorAll('[data-act="like"], [data-act="save"]');
    Array.prototype.forEach.call(buttons, function (button) {
      var kind = button.getAttribute("data-act") === "like" ? "likes" : "saves";
      button.setAttribute("aria-pressed", has(kind, button.getAttribute("data-id")) ? "true" : "false");
    });
  }

  function changed() {
    syncButtons(document);
    document.dispatchEvent(new CustomEvent("cot:change"));
  }

  // Returns { on: true|false, kept: true|false } or null for a bad id.
  function toggle(kind, id) {
    if (typeof id !== "string" || !ID_RE.test(id)) {
      return null;
    }
    var index = state[kind].indexOf(id);
    if (index === -1) {
      state[kind].push(id);
    } else {
      state[kind].splice(index, 1);
    }
    var kept = write();
    changed();
    return { on: index === -1, kept: kept };
  }

  // ---- Small message at the bottom of the screen -------------------------
  var toastEl = null;
  var toastTimer = null;

  function toast(message, href, linkText) {
    // A modal <dialog> makes everything outside it unreachable, so the message
    // must live inside the open dialog (the image viewer) when there is one.
    var host = document.querySelector("dialog[open]") || document.body;
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "cot-toast";
      toastEl.setAttribute("role", "status");
    }
    if (toastEl.parentNode !== host) {
      host.appendChild(toastEl);
    }
    toastEl.textContent = "";
    var text = document.createElement("span");
    text.textContent = message;
    toastEl.appendChild(text);
    if (href) {
      var link = document.createElement("a");
      link.href = href;
      link.textContent = linkText;
      toastEl.appendChild(link);
    }
    toastEl.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, href ? 5000 : 3200);
  }

  // ---- Share --------------------------------------------------------------
  function shareUrl(id) {
    var parts = id.split("/");
    return window.location.origin + "/gallery/" + parts[0] + "?image=" + parts[1];
  }

  function copyFallback(url) {
    var done = false;
    try {
      var box = document.createElement("textarea");
      box.value = url;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      (document.querySelector("dialog[open]") || document.body).appendChild(box);
      box.select();
      done = document.execCommand("copy");
      box.parentNode.removeChild(box);
    } catch (error) {
      done = false;
    }
    toast(done ? "Link copied" : "Could not copy. The link is: " + url);
  }

  function copy(url) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(
        function () { toast("Link copied"); },
        function () { copyFallback(url); }
      );
    } else {
      copyFallback(url);
    }
  }

  function share(id, name) {
    if (typeof id !== "string" || !ID_RE.test(id)) {
      return;
    }
    var url = shareUrl(id);
    if (navigator.share) {
      navigator.share({ title: (name || "Interior photograph") + " | Chair on Top", url: url }).catch(function (error) {
        if (!error || error.name !== "AbortError") {
          copy(url);
        }
      });
      return;
    }
    copy(url);
  }

  // ---- One click handler for every action button on the page -------------
  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-act]");
    if (!button) {
      return;
    }
    var act = button.getAttribute("data-act");
    var id = button.getAttribute("data-id") || "";
    var result;

    if (act === "like") {
      event.preventDefault();
      result = toggle("likes", id);
      if (result) {
        toast((result.on ? "Added to your likes" : "Removed from your likes") + (result.kept ? "" : ". Not kept: this browser blocks storage."));
      }
    } else if (act === "save") {
      event.preventDefault();
      result = toggle("saves", id);
      if (result) {
        if (!result.kept) {
          toast((result.on ? "Saved" : "Removed from saved") + ". Not kept: this browser blocks storage.");
        } else if (result.on) {
          toast("Saved.", "/saved", "View saved photographs");
        } else {
          toast("Removed from saved");
        }
      }
    } else if (act === "remove") {
      event.preventDefault();
      if (has("saves", id) && toggle("saves", id)) {
        toast("Removed from saved");
      }
    } else if (act === "share") {
      event.preventDefault();
      share(id, button.getAttribute("data-name"));
    } else if (act === "download") {
      // The link itself downloads the file. We only confirm that it started.
      toast("Download started");
    }
  });

  // Keep several open tabs in step.
  window.addEventListener("storage", function (event) {
    if (event.key === KEY || event.key === null) {
      state = load();
      changed();
    }
  });

  window.CoT = {
    has: has,
    toggle: toggle,
    list: function (kind) { return state[kind].slice(); },
    syncButtons: syncButtons,
    toast: toast,
    shareUrl: shareUrl,
    persistent: function () { return persistent; }
  };

  syncButtons(document);
})();
