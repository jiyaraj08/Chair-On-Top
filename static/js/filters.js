// Chair on Top - filters.js
// The filter bar (/explore and /search) is a normal GET form that works without
// JavaScript. With JavaScript it simply submits itself when a control changes,
// so the page always shows a shareable address that matches what is selected.

(function () {
  "use strict";

  var forms = document.querySelectorAll("[data-filter-form]");
  Array.prototype.forEach.call(forms, function (form) {
    form.classList.add("fb-js"); // hides the Apply button
    form.addEventListener("change", function () {
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        form.submit();
      }
    });
  });
})();
