// Chair on Top - theme.js
// The light/dark toggle. The first choice is made by a tiny script in the
// <head> of base.html (so the page never flashes the wrong theme). This file
// handles the button, remembers the choice and follows the device setting
// until the visitor chooses for themselves.

(function () {
  "use strict";

  var KEY = "cot.theme"; // "light" or "dark". Missing means: follow the device.
  var root = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var timer = null;

  function stored() {
    try {
      var value = window.localStorage.getItem(KEY);
      return value === "light" || value === "dark" ? value : null;
    } catch (error) {
      return null;
    }
  }

  function systemTheme() {
    return media && media.matches ? "dark" : "light";
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    if (meta) {
      meta.setAttribute("content", theme === "dark" ? "#14110e" : "#221e1a");
    }
    var buttons = document.querySelectorAll("[data-theme-toggle]");
    Array.prototype.forEach.call(buttons, function (button) {
      var label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
    });
  }

  function current() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-theme-toggle]");
    if (!button) {
      return;
    }
    var next = current() === "dark" ? "light" : "dark";
    if (!reduce) {
      root.classList.add("theme-anim");
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        root.classList.remove("theme-anim");
      }, 450);
    }
    apply(next);
    try {
      window.localStorage.setItem(KEY, next); // a manual choice always wins
    } catch (error) {
      /* storage blocked: the choice lasts until the page is closed */
    }
  });

  // No manual choice yet: follow the device when it changes.
  if (media) {
    var follow = function () {
      if (!stored()) {
        apply(systemTheme());
      }
    };
    if (media.addEventListener) {
      media.addEventListener("change", follow);
    } else if (media.addListener) {
      media.addListener(follow);
    }
  }

  // Another tab changed the choice.
  window.addEventListener("storage", function (event) {
    if (event.key === KEY) {
      apply(stored() || systemTheme());
    }
  });

  apply(current());
})();
