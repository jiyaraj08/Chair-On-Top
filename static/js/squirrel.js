// Chair on Top - squirrel.js
// Builds a small squirrel on a wall shelf inside the hero and animates it.
// Everything here is decoration, so if this file fails the page is unchanged.

(function () {
  "use strict";

  var hero = document.querySelector(".hero");
  if (!hero) {
    return;
  }

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasObserver = "IntersectionObserver" in window;
  var animate = !reduceMotion;
  var willArrive = animate && hasObserver;

  // ---------------------------------------------------------
  // 1. The drawing (original SVG, no image file needed)
  //    Palette: chestnut fur, ivory chest and face, gold rim light and acorn.
  //    Every part that sticks out gets a two-line rim (ivory inside, gold
  //    outside) drawn BEHIND the fur, so the squirrel reads clearly against
  //    the busy gold, copper and wood background.
  // ---------------------------------------------------------
  var P = {
    chestnut: "#8c3f1c",
    chestnutLight: "#bd6b36",
    chestnutDark: "#74311a",
    deep: "#4a200e",
    ink: "#2a1309",
    ivory: "#fbf1dc",
    ivoryShade: "#e9d5ae",
    gold: "#e9b04a",
    goldLight: "#f8dc94"
  };

  var TAIL = "M96 101 C122 106 134 84 126 58 C121 41 107 33 98 40 C93 44 97 50 101 55 C107 63 104 77 92 83 Z";
  var BODY = "M70 104 C66 88 70 68 86 64 C100 62 111 76 109 92 C108 98 106 104 101 104 Z";
  var EAR_L = "M67 47 L65 33 C70 35 74 39 76 45 Z";
  var EAR_R = "M82 45 C84 39 87 35 91 33 C91 39 90 45 88 49 Z";

  // Two-line rim for one shape. 'shape' is the tag and its geometry only.
  function rim(shape) {
    return '<' + shape + ' class="sq-rim" fill="' + P.gold + '" stroke="' + P.gold + '" stroke-width="6.6" stroke-linejoin="round"/>' +
           '<' + shape + ' fill="' + P.ivory + '" stroke="' + P.ivory + '" stroke-width="3.8" stroke-linejoin="round"/>';
  }

  var SVG =
    '<svg class="sq-svg" viewBox="0 0 140 130" aria-hidden="true" focusable="false">' +
      '<g class="sq-furniture">' +
        '<ellipse class="sq-ground" cx="70" cy="121" rx="54" ry="4" fill="#221e1a" opacity="0.18"/>' +
        '<rect x="4" y="104" width="132" height="9" rx="2.5" fill="#8a6240"/>' +
        '<rect x="4" y="104" width="132" height="2.6" rx="1.3" fill="#a67d57"/>' +
        '<rect x="12" y="97" width="26" height="7" rx="1" fill="#d9c7a8"/>' +
        '<rect x="14" y="90.5" width="21" height="6.5" rx="1" fill="#5f6743"/>' +
      '</g>' +
      '<g class="sq-actor">' +
        // Tail: rim, fur, then lighter and darker strands for depth.
        '<g class="sq-tail-react"><g class="sq-tail">' +
          rim('path d="' + TAIL + '"') +
          '<path d="' + TAIL + '" fill="' + P.chestnut + '" stroke="' + P.deep + '" stroke-width="1.1" stroke-linejoin="round"/>' +
          '<path d="M111 99 C122 93 125.5 79 121.5 64 C119.5 56 114.5 49 108 46" fill="none" stroke="' + P.chestnutLight + '" stroke-width="3.2" stroke-linecap="round" opacity="0.85"/>' +
          '<path d="M118 66 C116 53 109 45 101.5 44.5" fill="none" stroke="' + P.goldLight + '" stroke-width="2.2" stroke-linecap="round" opacity="0.95"/>' +
          '<path d="M105 92 C112 88 115 80 114 70" fill="none" stroke="' + P.deep + '" stroke-width="2" stroke-linecap="round" opacity="0.5"/>' +
          '<path d="M110 60 C108 53 104 49 100 48" fill="none" stroke="' + P.deep + '" stroke-width="1.6" stroke-linecap="round" opacity="0.45"/>' +
        '</g></g>' +
        '<g class="sq-breath">' +
          // Head rim first, so the body fur covers it where they overlap.
          '<g class="sq-head"><g class="sq-nod">' +
            '<g class="sq-ear sq-ear-l">' + rim('path d="' + EAR_L + '"') + '</g>' +
            '<g class="sq-ear sq-ear-r">' + rim('path d="' + EAR_R + '"') + '</g>' +
            rim('ellipse cx="76" cy="56" rx="15" ry="13"') +
            rim('ellipse cx="64" cy="60.5" rx="7.5" ry="5.5"') +
          '</g></g>' +
          // Body rim: body, haunch, foot, paws, acorn.
          rim('path d="' + BODY + '"') +
          rim('ellipse cx="98" cy="94" rx="11" ry="10"') +
          rim('ellipse cx="80" cy="102.6" rx="11" ry="2.8"') +
          rim('circle cx="68.5" cy="83" r="2.9"') +
          rim('ellipse cx="72" cy="83" rx="4.6" ry="5.6"') +
          // Body fur.
          '<path d="' + BODY + '" fill="' + P.chestnut + '" stroke="' + P.deep + '" stroke-width="1.1" stroke-linejoin="round"/>' +
          '<path d="M87 66 C99 65 108 74 108.5 86" fill="none" stroke="' + P.chestnutLight + '" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>' +
          '<ellipse cx="98" cy="94" rx="11" ry="10" fill="' + P.chestnutDark + '" stroke="' + P.deep + '" stroke-width="0.9"/>' +
          '<path d="M92 90 C95 86 101 86 104 90" fill="none" stroke="' + P.chestnutLight + '" stroke-width="1.4" stroke-linecap="round" opacity="0.6"/>' +
          '<ellipse cx="77" cy="87" rx="9" ry="15" fill="' + P.ivory + '"/>' +
          '<ellipse cx="80" cy="102.6" rx="11" ry="2.8" fill="' + P.ivoryShade + '" stroke="' + P.deep + '" stroke-width="0.7"/>' +
          // The golden acorn it is holding.
          '<ellipse cx="72" cy="83" rx="4.6" ry="5.6" fill="' + P.gold + '" stroke="#a8731f" stroke-width="0.7"/>' +
          '<ellipse cx="70.4" cy="82" rx="1.1" ry="2" fill="' + P.goldLight + '" opacity="0.9"/>' +
          '<path d="M66.8 80.5 C67 75 77 75 77.2 80.5 Z" fill="' + P.deep + '"/>' +
          '<path d="M72 75.4 L72.4 73.2" stroke="' + P.deep + '" stroke-width="1" stroke-linecap="round"/>' +
          '<circle cx="75" cy="81" r="2.9" fill="' + P.chestnutLight + '" stroke="' + P.deep + '" stroke-width="0.8"/>' +
          '<circle cx="68.5" cy="83" r="2.9" fill="' + P.chestnutLight + '" stroke="' + P.deep + '" stroke-width="0.8"/>' +
          // Head.
          '<g class="sq-head"><g class="sq-nod">' +
            '<g class="sq-ear sq-ear-l">' +
              '<path d="' + EAR_L + '" fill="' + P.chestnutDark + '" stroke="' + P.deep + '" stroke-width="1" stroke-linejoin="round"/>' +
              '<path d="M67.8 45 L66.8 37.5 C70 39 72.4 41.5 73.6 45 Z" fill="' + P.ivoryShade + '"/>' +
            '</g>' +
            '<g class="sq-ear sq-ear-r">' +
              '<path d="' + EAR_R + '" fill="' + P.chestnutDark + '" stroke="' + P.deep + '" stroke-width="1" stroke-linejoin="round"/>' +
              '<path d="M83.4 44.5 C85 40 87 37.5 89.4 36 C89.4 40 88.8 43.6 87.4 46.4 Z" fill="' + P.ivoryShade + '"/>' +
            '</g>' +
            '<ellipse cx="76" cy="56" rx="15" ry="13" fill="' + P.chestnut + '" stroke="' + P.deep + '" stroke-width="1.1"/>' +
            '<ellipse cx="80" cy="49.5" rx="7.5" ry="3.8" fill="' + P.chestnutLight + '" opacity="0.6"/>' +
            '<ellipse cx="73" cy="62" rx="7.5" ry="4.8" fill="' + P.ivory + '"/>' +
            '<ellipse cx="64" cy="60.5" rx="7.5" ry="5.5" fill="' + P.ivory + '" stroke="' + P.ivoryShade + '" stroke-width="0.6"/>' +
            '<circle cx="58.6" cy="59" r="2.2" fill="' + P.ink + '"/>' +
            '<path d="M60 63 Q63.5 65.5 67 63" fill="none" stroke="' + P.ink + '" stroke-width="0.9" stroke-linecap="round" opacity="0.6"/>' +
            '<path d="M57 61 L47 59.5 M57 62.4 L47.5 64.5" fill="none" stroke="' + P.ivoryShade + '" stroke-width="0.8" stroke-linecap="round"/>' +
            '<g class="sq-eye-look"><g class="sq-eye">' +
              '<circle cx="69.5" cy="53.5" r="4.1" fill="' + P.ivory + '" opacity="0.9"/>' +
              '<circle cx="69.5" cy="53.5" r="2.9" fill="' + P.ink + '"/>' +
              '<circle cx="68.6" cy="52.6" r="1" fill="#ffffff"/>' +
            '</g></g>' +
          '</g></g>' +
        '</g>' +
      '</g>' +
    '</svg>';

  var MARKUP =
    '<div class="sq">' +
      '<button class="sq-btn" type="button" aria-label="Say hello to the squirrel on the shelf" aria-controls="sq-bubble" aria-expanded="false">' +
        SVG +
      '</button>' +
      '<div class="sq-bubble" id="sq-bubble" role="group" aria-label="Message from the squirrel">' +
        '<p class="sq-bubble-text">Shall we find your style?</p>' +
        '<a class="sq-bubble-link" href="#styles">Browse all eight styles</a>' +
        '<button class="sq-bubble-close" type="button" aria-label="Dismiss message">&times;</button>' +
      '</div>' +
    '</div>';

  var holder = document.createElement("div");
  holder.innerHTML = MARKUP;
  var sq = holder.firstElementChild;

  if (animate) {
    sq.classList.add("sq-anim");
  }
  if (willArrive) {
    sq.classList.add("sq-pre"); // hidden until the arrival hop
  }
  hero.appendChild(sq);

  var button = sq.querySelector(".sq-btn");
  var actor = sq.querySelector(".sq-actor");
  var eyeLook = sq.querySelector(".sq-eye-look");
  var bubble = sq.querySelector(".sq-bubble");
  var closeButton = sq.querySelector(".sq-bubble-close");
  var bubbleLink = sq.querySelector(".sq-bubble-link");

  var live = false;       // is the hero on screen?
  var arrived = false;
  var autoShown = false;
  var dismissed = false;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // ---------------------------------------------------------
  // 2. Speech bubble
  // ---------------------------------------------------------
  function openBubble() {
    bubble.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
    document.dispatchEvent(new CustomEvent("cot:bubble-open"));
  }

  function closeBubble(byUser) {
    bubble.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
    if (byUser) {
      dismissed = true; // do not pop up again on its own
    }
  }

  function showBubbleOnce() {
    if (!dismissed && !autoShown) {
      autoShown = true;
      openBubble();
    }
  }

  closeButton.addEventListener("click", function () {
    closeBubble(true);
    button.focus();
  });

  bubbleLink.addEventListener("click", function () {
    closeBubble(true);
  });

  sq.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && bubble.classList.contains("is-open")) {
      closeBubble(true);
      button.focus();
    }
  });

  // ---------------------------------------------------------
  // 3. Head and eyes (used by the glance and the pointer look)
  // ---------------------------------------------------------
  function setHead(tilt, shiftX, eyeX, eyeY) {
    // Set on the root: both head layers (rim and fur) inherit it and turn together.
    sq.style.setProperty("--tilt", tilt + "deg");
    sq.style.setProperty("--hx", shiftX + "px");
    eyeLook.style.setProperty("--ex", eyeX + "px");
    eyeLook.style.setProperty("--ey", eyeY + "px");
  }

  // ---------------------------------------------------------
  // 4. Click or tap reaction
  // ---------------------------------------------------------
  function restart(className) {
    sq.classList.remove(className);
    void sq.offsetWidth; // lets the animation start again
    sq.classList.add(className);
  }

  button.addEventListener("click", function () {
    if (animate) {
      restart("sq-hop");
      restart("sq-flick");
    }
    if (bubble.classList.contains("is-open")) {
      closeBubble(true);
    } else {
      openBubble();
    }
  });

  // Remove one-shot classes when their animation ends.
  actor.addEventListener("animationend", function (event) {
    if (event.animationName === "sq-arrive") {
      sq.classList.remove("sq-arrive");
      window.setTimeout(showBubbleOnce, 800);
    } else if (event.animationName === "sq-hop") {
      sq.classList.remove("sq-hop");
    }
  });

  sq.addEventListener("animationend", function (event) {
    if (event.animationName === "sq-flick") {
      sq.classList.remove("sq-flick");
    }
  });

  // ---------------------------------------------------------
  // 5. Arrival: one gentle hop, after the hero's opening finishes
  // ---------------------------------------------------------
  function onFirstVisible() {
    if (arrived) {
      return;
    }
    arrived = true;

    if (!willArrive) {
      sq.classList.remove("sq-pre");
      window.setTimeout(showBubbleOnce, 1500);
      return;
    }

    var elapsed = window.performance && performance.now ? performance.now() : 0;
    var wait = Math.max(250, 2500 - elapsed);
    window.setTimeout(function () {
      sq.classList.remove("sq-pre");
      sq.classList.add("sq-arrive");
    }, wait);
  }

  // ---------------------------------------------------------
  // 6. Occasional head glance (every 9 to 16 seconds, only while visible)
  // ---------------------------------------------------------
  var glanceTimer = null;
  var glanceIndex = 0;

  function glance() {
    if (sq.classList.contains("sq-arrive") || sq.classList.contains("sq-hop") ||
        sq.classList.contains("sq-pre")) {
      return;
    }
    if (glanceIndex % 2 === 0) {
      setHead(5, 0, -0.6, -0.6);   // looks up
    } else {
      setHead(-3, 2.4, 1, 0.2);    // glances back over its shoulder
    }
    glanceIndex += 1;
    window.setTimeout(function () {
      setHead(0, 0, 0, 0);
    }, 1700);
  }

  function scheduleGlance() {
    window.clearTimeout(glanceTimer);
    if (!animate || !live) {
      return;
    }
    glanceTimer = window.setTimeout(function () {
      glance();
      scheduleGlance();
    }, 9000 + Math.random() * 7000);
  }

  // ---------------------------------------------------------
  // 7. Pointer look: mouse only, reacts after the pointer pauses
  // ---------------------------------------------------------
  var finePointer =
    window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (animate && finePointer) {
    var pointerX = 0;
    var pointerY = 0;
    var lastStamp = 0;
    var lookTimer = null;
    var restTimer = null;

    var applyLook = function () {
      var rect = button.getBoundingClientRect();
      var dx = clamp((pointerX - (rect.left + rect.width / 2)) / (window.innerWidth / 2), -1, 1);
      var dy = clamp((pointerY - (rect.top + rect.height / 2)) / (window.innerHeight / 2), -1, 1);
      setHead(-dy * 6, dx > 0 ? dx * 2 : 0, dx, dy * 0.7);
    };

    var relax = function () {
      setHead(0, 0, 0, 0);
    };

    hero.addEventListener("pointermove", function (event) {
      if (event.pointerType !== "mouse" || !live) {
        return;
      }
      pointerX = event.clientX;
      pointerY = event.clientY;

      var now = window.performance ? performance.now() : Date.now();
      if (now - lastStamp < 150) {
        return; // do not do any work on every tiny movement
      }
      lastStamp = now;

      window.clearTimeout(lookTimer);
      window.clearTimeout(restTimer);
      lookTimer = window.setTimeout(applyLook, 400);
      restTimer = window.setTimeout(relax, 3600);
    });
  }

  // ---------------------------------------------------------
  // 7b. Lighting menu: close the speech bubble while the menu is open, and
  //     glance toward the window when the light changes.
  // ---------------------------------------------------------
  document.addEventListener("cot:lightmenu-open", function () {
    closeBubble(false);
  });

  document.addEventListener("cot:light", function () {
    if (!animate || !live) {
      return;
    }
    setHead(4, 0, 0.9, -0.7);
    window.setTimeout(function () {
      setHead(0, 0, 0, 0);
    }, 1400);
  });

  // ---------------------------------------------------------
  // 8. Only run while the hero is on screen and the tab is visible
  // ---------------------------------------------------------
  function updateLive(visible) {
    live = visible && !document.hidden;
    sq.classList.toggle("is-live", live);
    if (live) {
      onFirstVisible();
      scheduleGlance();
    } else {
      window.clearTimeout(glanceTimer);
    }
  }

  if (hasObserver) {
    var heroVisible = false;
    new IntersectionObserver(
      function (entries) {
        heroVisible = entries[0].isIntersecting;
        updateLive(heroVisible);
      },
      { threshold: 0.2 }
    ).observe(hero);

    document.addEventListener("visibilitychange", function () {
      updateLive(heroVisible);
    });
  } else {
    updateLive(true);
  }
})();
