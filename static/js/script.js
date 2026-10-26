// Chair on Top - script.js (Phase 1)
// Features: mobile menu, active nav link, scroll reveals,
// style preview dialog, temporary shortlist, dev check.

(function () {
  "use strict";

  var root = document.documentElement;

  // Tell the CSS that JavaScript is running.
  root.classList.add("js");

  // ---------------------------------------------------------
  // 1. Dev check (remove the footer line in Phase 8)
  // ---------------------------------------------------------
  var devCheck = document.getElementById("dev-check");
  if (devCheck) {
    devCheck.textContent = "Dev check: JavaScript running";
    devCheck.setAttribute("data-state", "ok");
  }

  // ---------------------------------------------------------
  // 2. Mobile menu
  // ---------------------------------------------------------
  var nav = document.querySelector(".pill-nav");
  var toggle = document.querySelector(".nav-toggle");
  var navLinks = document.getElementById("nav-links");

  function setMenu(open) {
    if (!toggle || !navLinks) {
      return;
    }
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    navLinks.classList.toggle("is-open", open);
  }

  if (toggle && navLinks) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });

    // Close after choosing a link.
    navLinks.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        setMenu(false);
      }
    });

    // Close with the Escape key and return focus to the button.
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        toggle.focus();
      }
    });

    // Close when clicking outside the menu.
    document.addEventListener("click", function (event) {
      if (nav && !nav.contains(event.target)) {
        setMenu(false);
      }
    });

    // Close if the window grows to desktop size.
    window.addEventListener("resize", function () {
      if (window.innerWidth > 860) {
        setMenu(false);
      }
    });
  }

  // ---------------------------------------------------------
  // 3. Highlight the nav link for the section you are reading
  // ---------------------------------------------------------
  var links = document.querySelectorAll(".nav-links a[href^='#']");
  var linkById = {};
  links.forEach(function (link) {
    linkById[link.getAttribute("href").slice(1)] = link;
  });

  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          links.forEach(function (link) {
            link.removeAttribute("aria-current");
          });
          var active = linkById[entry.target.id];
          if (active) {
            active.setAttribute("aria-current", "location");
          }
        });
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );

    ["top", "styles", "how", "quiz", "budget"].forEach(function (id) {
      var section = document.getElementById(id);
      if (section) {
        spy.observe(section);
      }
    });
  }

  // ---------------------------------------------------------
  // 4. Gentle reveal on scroll (skipped for reduced motion)
  // ---------------------------------------------------------
  var revealItems = document.querySelectorAll(".reveal");
  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if ("IntersectionObserver" in window && !reduceMotion && revealItems.length) {
    root.classList.add("reveal-ready");
    var revealer = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealItems.forEach(function (item) {
      revealer.observe(item);
    });
  }

  // ---------------------------------------------------------
  // 5. Style cards: preview dialog and temporary shortlist
  // ---------------------------------------------------------
  var cardList = document.getElementById("style-cards");
  var dialog = document.getElementById("style-dialog");
  var dialogBody = document.getElementById("style-dialog-body");
  var statusLine = document.getElementById("shortlist-status");
  var canDialog = dialog && typeof dialog.showModal === "function";
  var shortlist = []; // lives in memory only, cleared on reload

  if (!canDialog) {
    root.classList.add("no-dialog");
  }

  function updateShortlistText() {
    if (!statusLine) {
      return;
    }
    if (shortlist.length === 0) {
      statusLine.textContent = "Your shortlist is empty. Press Save on a style to keep it here.";
    } else {
      statusLine.textContent = "Shortlist (this visit only): " + shortlist.join(", ") + ".";
    }
  }

  if (cardList) {
    cardList.addEventListener("click", function (event) {
      var saveButton = event.target.closest(".save-btn");
      var viewButton = event.target.closest(".view-btn");

      if (saveButton) {
        var name = saveButton.getAttribute("data-name");
        var wasSaved = saveButton.getAttribute("aria-pressed") === "true";
        saveButton.setAttribute("aria-pressed", wasSaved ? "false" : "true");
        saveButton.querySelector(".save-label").textContent = wasSaved ? "Save" : "Saved";
        if (wasSaved) {
          shortlist = shortlist.filter(function (item) {
            return item !== name;
          });
        } else {
          shortlist.push(name);
        }
        updateShortlistText();
      }

      if (viewButton && canDialog) {
        var card = viewButton.closest(".style-card");
        var detail = card.querySelector(".style-detail");
        if (detail) {
          dialogBody.innerHTML = detail.innerHTML;
          dialog.setAttribute("aria-label", card.getAttribute("data-name") + " style preview");
          dialog.showModal();
        }
      }
    });
  }

  if (canDialog) {
    // Close when clicking the dark backdrop or a link inside the dialog.
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog || event.target.closest("a")) {
        dialog.close();
      }
    });
  }
})();