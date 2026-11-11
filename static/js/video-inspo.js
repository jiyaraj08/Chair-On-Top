// Chair on Top - video-inspo.js
// "Watch <Style> in Motion" on the gallery pages.
// The cards are plain links, so they work without JavaScript. This file only
// hides a thumbnail that fails to load, so the colour placeholder and the
// play icon show instead of a broken-picture icon.
(function () {
  "use strict";

  var SELECTOR = ".vi-thumb img";

  // The error event does not bubble, so listen while it travels down.
  document.addEventListener(
    "error",
    function (event) {
      var el = event.target;
      if (el && el.tagName === "IMG" && el.closest(".vi-thumb")) {
        el.classList.add("is-broken");
      }
    },
    true
  );

  // A picture that failed before this script started.
  Array.prototype.forEach.call(document.querySelectorAll(SELECTOR), function (img) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("loading") !== "lazy") {
      img.classList.add("is-broken");
    }
  });
})();
