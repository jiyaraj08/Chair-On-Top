// Chair on Top - motion.js
// Adds: image-missing fallback, scrolled header, sliding nav indicator,
// scroll reveals, hero parallax and the hero light selector (sun in a window).
// Needs script.js to load first (base.html already does this).

(function () {
  "use strict";

  var root = document.documentElement;
  var hasObserver = "IntersectionObserver" in window;
  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Tells the safety timer in base.html that this file started.
  root.classList.add("motion-ready");

  // Runs a feature on its own, so one failure cannot break the others.
  function safely(name, fn) {
    try {
      fn();
    } catch (error) {
      if (window.console) {
        console.warn("motion.js: " + name + " failed", error);
      }
    }
  }

  // ---------------------------------------------------------
  // 0. Dev check line in the footer (remove with the line in Phase 8)
  // ---------------------------------------------------------
  safely("dev check", function () {
    var devCheck = document.getElementById("dev-check");
    if (devCheck) {
      var on = root.classList.contains("motion-on");
      devCheck.textContent = "Dev check: JavaScript running, motion " + (on ? "on" : "off");
      devCheck.setAttribute("data-state", "ok");
    }
  });

  // ---------------------------------------------------------
  // 1. Missing images: hide the broken <img>, keep the placeholder
  //    (the error event does not bubble, so we listen while it travels down)
  // ---------------------------------------------------------
  safely("image fallback", function () {
    var BOXES = ".card-media, .hero-media, .img-reveal";

    document.addEventListener(
      "error",
      function (event) {
        var el = event.target;
        if (el && el.tagName === "IMG" && el.parentElement && el.parentElement.matches(BOXES)) {
          el.parentElement.classList.add("img-missing");
        }
      },
      true
    );

    // Images that had already failed before this script ran.
    document
      .querySelectorAll(".card-media > img, .hero-media > img, .img-reveal > img")
      .forEach(function (img) {
        if (img.complete && img.naturalWidth === 0) {
          img.parentElement.classList.add("img-missing");
        }
      });
  });

  // ---------------------------------------------------------
  // 2. Header gets a stronger shadow after you scroll a little
  // ---------------------------------------------------------
  safely("scrolled header", function () {
    var header = document.querySelector(".site-header");
    if (!header || !hasObserver) {
      return;
    }
    var sentinel = document.createElement("div");
    sentinel.className = "scroll-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    document.body.appendChild(sentinel);

    new IntersectionObserver(function (entries) {
      header.classList.toggle("is-scrolled", !entries[0].isIntersecting);
    }).observe(sentinel);
  });

  // ---------------------------------------------------------
  // 3. Sliding pill behind the active nav link (desktop only)
  //    script.js sets aria-current; we just watch for changes.
  // ---------------------------------------------------------
  safely("nav indicator", function () {
    var list = document.getElementById("nav-links");
    if (!list || !("MutationObserver" in window)) {
      return;
    }

    var mobileQuery = window.matchMedia("(max-width: 860px)");
    var indicator = document.createElement("li");
    indicator.className = "nav-indicator";
    indicator.setAttribute("aria-hidden", "true");
    list.insertBefore(indicator, list.firstChild);
    root.classList.add("nav-has-indicator");

    var shown = false;
    var pending = false;

    function place() {
      pending = false;
      var current = list.querySelector("a[aria-current]");

      if (!current || mobileQuery.matches) {
        indicator.style.opacity = "0";
        shown = false;
        return;
      }

      if (!shown) {
        indicator.style.transition = "none"; // jump into place the first time
      }
      indicator.style.width = current.offsetWidth + "px";
      indicator.style.transform = "translateX(" + current.offsetLeft + "px)";
      if (!shown) {
        void indicator.offsetWidth; // make the browser apply the jump
        indicator.style.transition = "";
        shown = true;
      }
      indicator.style.opacity = "1";
    }

    function schedule() {
      if (!pending) {
        pending = true;
        window.requestAnimationFrame(place);
      }
    }

    new MutationObserver(schedule).observe(list, {
      attributes: true,
      attributeFilter: ["aria-current"],
      subtree: true
    });
    window.addEventListener("resize", schedule);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(schedule);
    }
    schedule();
  });

  // ---------------------------------------------------------
  // 4. Scroll reveals: each group animates once, then stays visible
  // ---------------------------------------------------------
  safely("scroll reveals", function () {
    if (!root.classList.contains("motion-on")) {
      return;
    }

    // root = the element we watch, items = what gets .is-in, step = stagger in ms
    var GROUPS = [
      { root: ".section-head",   items: ":scope > *",                  step: 90 },
      { root: ".steps",          items: ".step",                       step: 140 },
      { root: ".style-scroller", items: ".style-card",                 step: 90 },
      { root: ".quiz-plate",     items: ".quiz-copy > *, .quiz-sample", step: 110 },
      { root: ".budget-copy",    items: ":scope > *",                  step: 90 },
      { root: ".plan-card",      items: null,                          step: 0 },
      { root: ".cta-plate",      items: ":scope > *",                  step: 110 },
      { root: ".img-reveal",     items: null,                          step: 0 }
    ];

    var records = [];

    GROUPS.forEach(function (group) {
      document.querySelectorAll(group.root).forEach(function (el) {
        var items = group.items
          ? Array.prototype.slice.call(el.querySelectorAll(group.items))
          : [el];
        items.forEach(function (item, index) {
          item.style.setProperty("--d", index * group.step + "ms");
        });
        records.push({ el: el, items: items });
      });
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          var record = records.filter(function (r) {
            return r.el === entry.target;
          })[0];
          if (record) {
            record.items.forEach(function (item) {
              item.classList.add("is-in");
            });
          }
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );

    records.forEach(function (record) {
      observer.observe(record.el);
    });
  });

  // If the reveal code ever fails, never leave content hidden.
  window.addEventListener("error", function (event) {
    if (event && event.filename && event.filename.indexOf("motion.js") !== -1) {
      root.classList.remove("motion-on");
    }
  });

  // ---------------------------------------------------------
  // 5. Hero parallax: large mouse screens only, only while the hero is visible
  // ---------------------------------------------------------
  safely("hero parallax", function () {
    var hero = document.querySelector(".hero");
    var media = document.querySelector(".hero-media");
    if (!hero || !media || !hasObserver || reduceMotion) {
      return;
    }

    var bigScreen = window.matchMedia("(min-width: 901px) and (hover: hover) and (pointer: fine)");
    var weakDevice = typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2;
    if (!bigScreen.matches || weakDevice) {
      return;
    }

    root.classList.add("m-parallax");
    var ticking = false;

    function update() {
      ticking = false;
      var shift = Math.min(40, Math.max(0, window.scrollY * 0.08));
      media.style.setProperty("--py", shift.toFixed(1));
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
      } else {
        window.removeEventListener("scroll", onScroll);
      }
    }).observe(hero);
  });

  // ---------------------------------------------------------
  // 6. The light selector: a small arched window with a sun in it.
  //    Tap it to open a four-option menu (Morning, Midday, Afternoon, Golden
  //    Hour). The choice sets data-light on <html>, which hero-lighting.css
  //    turns into the hero's light, warmth, brightness and shadows. The
  //    choice is saved in localStorage under cot.light.v1.
  // ---------------------------------------------------------
  safely("light selector", function () {
    var host = document.querySelector(".hero-media");
    var hero = document.querySelector(".hero");
    if (!host || !hero) {
      return;
    }

    var KEY = "cot.light.v1";
    var MODES = [
      { id: "morning",   name: "Morning",     x: 28, y: 90, color: "#f6d9a0" },
      { id: "midday",    name: "Midday",      x: 50, y: 48, color: "#fff3c4" },
      { id: "afternoon", name: "Afternoon",   x: 78, y: 52, color: "#f2c98a" },
      { id: "golden",    name: "Golden Hour", x: 94, y: 88, color: "#e8914f" }
    ];

    var ARCH = "M12 140V60A48 48 0 0 1 108 60V140Z";

    var optionHtml = "";
    MODES.forEach(function (mode) {
      optionHtml +=
        '<button class="lp-opt" type="button" role="radio" aria-checked="false" tabindex="-1" data-mode="' + mode.id + '">' +
          '<span class="lp-dot" style="--dot:' + mode.color + '" aria-hidden="true"></span>' +
          '<span class="lp-name">' + mode.name + '</span>' +
        '</button>';
    });

    var html =
      '<div class="motif is-fresh">' +
        '<button class="motif-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="light-menu" aria-label="Lighting. Open the time-of-day menu">' +
          '<svg class="motif-svg" viewBox="0 0 120 150" aria-hidden="true" focusable="false">' +
            '<defs><clipPath id="motif-clip"><path d="' + ARCH + '"/></clipPath></defs>' +
            '<path class="motif-fill" d="' + ARCH + '"/>' +
            '<g clip-path="url(#motif-clip)">' +
              '<polygon class="motif-patch" points="40,128 72,128 84,140 30,140"/>' +
              '<g class="motif-sun">' +
                '<circle class="motif-halo" r="24"/>' +
                '<circle class="motif-disc" r="11"/>' +
              '</g>' +
            '</g>' +
            '<path class="motif-pane" d="M60 12V140M12 76H108"/>' +
            '<line class="motif-floor" x1="12" y1="128" x2="108" y2="128"/>' +
            '<path class="motif-frame" d="' + ARCH + '" pathLength="1"/>' +
          '</svg>' +
        '</button>' +
        '<p class="motif-caption"></p>' +
        '<span class="visually-hidden" role="status" aria-live="polite"></span>' +
      '</div>';

    var holder = document.createElement("div");
    holder.innerHTML = html;
    var motif = holder.firstChild;

    var button = motif.querySelector(".motif-btn");
    var svg = motif.querySelector(".motif-svg");
    var sun = motif.querySelector(".motif-sun");
    var patch = motif.querySelector(".motif-patch");
    var caption = motif.querySelector(".motif-caption");
    var status = motif.querySelector("[role=status]");

    // The menu lives in the hero (not inside the window), so the light tint
    // never covers it. It is placed above the window each time it opens.
    var menuHolder = document.createElement("div");
    menuHolder.innerHTML =
      '<div class="light-menu" id="light-menu" role="radiogroup" aria-label="Time of day" hidden>' + optionHtml + '</div>';
    var menu = menuHolder.firstChild;
    var options = Array.prototype.slice.call(menu.querySelectorAll(".lp-opt"));

    var index = 0;
    var nudgeX = 0;
    var nudgeY = 0;
    var box = null;

    function indexOfMode(id) {
      for (var i = 0; i < MODES.length; i += 1) {
        if (MODES[i].id === id) {
          return i;
        }
      }
      return 0;
    }

    function render() {
      var stop = MODES[index];
      var x = (stop.x + nudgeX).toFixed(1);
      var y = (stop.y + nudgeY).toFixed(1);
      sun.style.transform = "translate(" + x + "px," + y + "px)";
      patch.style.transform = "translateX(" + Math.round((60 - stop.x) * 0.5) + "px)";
      svg.style.setProperty("--sun", stop.color);
    }

    // Applies a mode to the page. fromUser = true also saves it and announces it.
    function setMode(i, fromUser) {
      index = i;
      var mode = MODES[i];
      root.setAttribute("data-light", mode.id);
      caption.textContent = mode.name;
      button.setAttribute("aria-label", "Lighting: " + mode.name + ". Open the time-of-day menu");
      options.forEach(function (opt, n) {
        var on = n === i;
        opt.setAttribute("aria-checked", on ? "true" : "false");
        opt.tabIndex = on ? 0 : -1;
      });
      render();

      if (fromUser) {
        motif.classList.remove("is-fresh");
        try {
          window.localStorage.setItem(KEY, mode.id);
        } catch (error) {
          // Private mode or blocked storage: the light still changes, it just is not remembered.
        }
        status.textContent = mode.name + " lighting";
        document.dispatchEvent(new CustomEvent("cot:light", { detail: { mode: mode.id } }));
      }
    }

    // Start from what the page already shows (the saved choice, set before first paint).
    index = indexOfMode(root.getAttribute("data-light"));
    setMode(index, false);

    // Place the window BEFORE adding it to the page, so it does not slide in from the corner.
    host.appendChild(motif);
    hero.appendChild(menu);

    // ---- the menu ----
    function placeMenu() {
      var heroBox = hero.getBoundingClientRect();
      var motifBox = motif.getBoundingClientRect();
      menu.style.right = Math.max(0, heroBox.right - motifBox.right) + "px";
      menu.style.bottom = Math.max(0, heroBox.bottom - motifBox.top + 8) + "px";
    }

    function isOpen() {
      return !menu.hidden;
    }

    function openMenu() {
      placeMenu();
      menu.hidden = false;
      // Next frame, so the open animation can start from the hidden state.
      window.requestAnimationFrame(function () {
        menu.classList.add("is-open");
      });
      button.setAttribute("aria-expanded", "true");
      document.dispatchEvent(new CustomEvent("cot:lightmenu-open"));
      options[index].focus({ preventScroll: true });
    }

    function closeMenu(returnFocus) {
      if (!isOpen()) {
        return;
      }
      menu.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
      var done = function () {
        if (!menu.classList.contains("is-open")) {
          menu.hidden = true;
        }
      };
      if (reduceMotion) {
        done();
      } else {
        window.setTimeout(done, 220);
      }
      if (returnFocus) {
        button.focus({ preventScroll: true });
      }
    }

    // Tap, click, Enter and Space on the window all end up here.
    button.addEventListener("click", function () {
      if (isOpen()) {
        closeMenu(false);
      } else {
        openMenu();
      }
    });

    // The caption under the window is part of the control, so it is easy to hit on a phone.
    caption.addEventListener("click", function () {
      button.click();
    });

    options.forEach(function (opt, n) {
      opt.addEventListener("click", function () {
        setMode(n, true);
        closeMenu(true);
      });
    });

    menu.addEventListener("keydown", function (event) {
      var current = options.indexOf(document.activeElement);
      if (current < 0) {
        current = index;
      }
      var next = null;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        next = (current + 1) % options.length;
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        next = (current - 1 + options.length) % options.length;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = options.length - 1;
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      } else if (event.key === "Tab") {
        closeMenu(false);
        return;
      }
      if (next !== null) {
        event.preventDefault();
        options[next].focus({ preventScroll: true });
      }
    });

    // Tap outside, or open the squirrel's speech bubble: close the menu.
    document.addEventListener("pointerdown", function (event) {
      if (isOpen() && !menu.contains(event.target) && !motif.contains(event.target)) {
        closeMenu(false);
      }
    });

    document.addEventListener("cot:bubble-open", function () {
      closeMenu(false);
    });

    window.addEventListener("resize", function () {
      if (isOpen()) {
        placeMenu();
      }
    });

    // Another tab changed the saved light: follow it.
    window.addEventListener("storage", function (event) {
      if (event.key === KEY && event.newValue) {
        setMode(indexOfMode(event.newValue), false);
      }
    });

    // Mouse only: the sun leans toward the pointer and settles back.
    if (!reduceMotion) {
      button.addEventListener("pointerenter", function (event) {
        if (event.pointerType === "mouse") {
          box = button.getBoundingClientRect();
        }
      });

      button.addEventListener("pointermove", function (event) {
        if (event.pointerType !== "mouse" || !box) {
          return;
        }
        nudgeX = ((event.clientX - box.left) / box.width - 0.5) * 10;
        nudgeY = ((event.clientY - box.top) / box.height - 0.5) * 8;
        render();
      });

      var settle = function () {
        nudgeX = 0;
        nudgeY = 0;
        box = null;
        render();
      };
      button.addEventListener("pointerleave", settle);
      button.addEventListener("pointercancel", settle);
    }
  });
})();
