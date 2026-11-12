/* Chair on Top - video-bg.js
   A silent, crossfading, endlessly looping slideshow of four background videos.

   How it works
   - Two <video> elements take turns. One plays while the other quietly loads the
     next file, so only ONE extra file is ever downloading and nothing flashes.
   - Each video plays for its own natural length. About a second before it ends,
     the next one fades in ON TOP of it, so the background never shows through.
   - After the fourth video it starts the first again, forever.
   - Silence: every video is muted, defaultMuted and volume 0 at all times, and a
     "volumechange" guard puts it back if anything ever tries to change that.
     The code never sets muted to false.
   - It pauses when the tab is hidden or the section is off screen.
   - If autoplay is blocked, nothing is shown (the normal background stays) and
     playback starts on the visitor's first touch, click or key press.
   - Reduced motion, data saver and 2G connections: no video is loaded at all.
   If anything fails, the page simply keeps its normal background. */
(function () {
  "use strict";

  var FADE = 1.2;            /* crossfade length, seconds (keep equal to the CSS) */
  var roots = document.querySelectorAll("[data-vbg]");
  if (!roots.length) { return; }

  var reduceQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;

  function blocked() {
    if (reduceQuery && reduceQuery.matches) { return true; }
    if (conn && (conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || ""))) { return true; }
    return false;
  }

  function silence(v) {
    v.defaultMuted = true;
    v.muted = true;
    v.volume = 0;
  }

  function Slideshow(root) {
    var urls = (root.getAttribute("data-sources") || "").split(/\s+/).filter(Boolean);
    var vids = root.querySelectorAll(".vbg-video");
    if (urls.length < 1 || vids.length < 2) { return; }

    var cur = vids[0], nxt = vids[1];
    var curIdx = 0, nxtIdx = 1 % urls.length;
    var started = false, fading = false, waiting = false, gaveUp = false;
    var inView = true, errors = 0, fadeTimer = 0, gestureBound = false;

    [cur, nxt].forEach(function (v) {
      silence(v);
      v.controls = false;
      v.loop = false;
      v.addEventListener("volumechange", function () {
        if (!v.muted || v.volume !== 0 || !v.defaultMuted) { silence(v); }
      });
      v.addEventListener("timeupdate", function () { if (v === cur) { onTime(); } });
      v.addEventListener("ended", function () { if (v === cur) { advance(true); } });
      v.addEventListener("error", function () { onError(v); });
      /* Safety net: whatever started it, nothing may play while hidden, off screen or blocked. */
      v.addEventListener("play", function () { if (!wantPlay()) { try { v.pause(); } catch (e) {} } });
      v.addEventListener("playing", function () { if (!wantPlay()) { try { v.pause(); } catch (e) {} } });
    });

    function load(v, i) {
      silence(v);
      v.preload = "auto";
      v.src = urls[i];
      v.load();
    }

    function wantPlay() {
      return !blocked() && !document.hidden && inView && !gaveUp;
    }

    function safePlay(v) {
      silence(v);
      if (!wantPlay()) { return Promise.reject({ name: "AbortError" }); }
      var p;
      try { p = v.play(); } catch (e) { return Promise.reject(e); }
      return p && p.then ? p : Promise.resolve();
    }

    function onBlocked(err) {
      if (err && err.name === "AbortError") { return; }   /* a pause interrupted play: harmless */
      bindGesture();
    }

    function bindGesture() {
      if (gestureBound) { return; }
      gestureBound = true;
      var evs = ["pointerdown", "touchstart", "keydown", "click"];
      var once = function () {
        evs.forEach(function (e) { document.removeEventListener(e, once, true); });
        gestureBound = false;
        update();
      };
      evs.forEach(function (e) { document.addEventListener(e, once, true); });
    }

    /* First video: load it, play it, fade it in once frames are really moving. */
    function begin() {
      started = true;
      root.classList.add("is-started");
      load(cur, curIdx);
      cur.addEventListener("playing", function onPlaying() {
        cur.removeEventListener("playing", onPlaying);
        cur.classList.add("is-on", "is-cur");
        root.classList.add("is-playing");
        /* Only now, with the first video playing, start loading the next one. */
        load(nxt, nxtIdx);
      });
      safePlay(cur).catch(onBlocked);
    }

    function onTime() {
      if (fading || waiting || !cur.duration || !isFinite(cur.duration)) { return; }
      if (cur.duration - cur.currentTime <= FADE + 0.15) { advance(false); }
    }

    function advance(force) {
      if (fading || waiting || gaveUp) { return; }
      if (nxt.readyState >= 3) {
        crossfade();
      } else if (nxt.error) {
        return;                                            /* onError() is handling it */
      } else {
        waiting = true;                                    /* next file not ready yet: wait for it */
        var ready = function () {
          nxt.removeEventListener("canplay", ready);
          waiting = false;
          if (wantPlay()) { crossfade(); }
        };
        nxt.addEventListener("canplay", ready);
      }
    }

    function crossfade() {
      fading = true;
      try { nxt.currentTime = 0; } catch (e) {}
      var shown = false;
      var show = function () {
        if (shown) { return; }
        shown = true;
        nxt.removeEventListener("playing", show);
        nxt.classList.add("is-on", "is-top");              /* fades in on top of the current video */
        fadeTimer = window.setTimeout(finish, FADE * 1000 + 150);
      };
      nxt.addEventListener("playing", show);
      safePlay(nxt).catch(function (err) {
        nxt.removeEventListener("playing", show);
        fading = false;
        onBlocked(err);
      });
    }

    function finish() {
      var old = cur;
      cur = nxt; nxt = old;
      curIdx = nxtIdx;
      cur.classList.remove("is-top");
      cur.classList.add("is-cur");
      old.classList.remove("is-on", "is-cur", "is-top");   /* hidden only after the new one is fully opaque */
      old.pause();
      fading = false;
      nxtIdx = (curIdx + 1) % urls.length;
      load(nxt, nxtIdx);                                   /* one file at a time */
      if (!wantPlay()) { pauseAll(); }
    }

    function onError(v) {
      errors += 1;
      if (errors > urls.length * 2) { giveUp(); return; }
      if (v === nxt) {
        nxtIdx = (nxtIdx + 1) % urls.length;
        if (nxtIdx === curIdx) { cur.loop = true; return; } /* nothing else works: keep repeating this one */
        load(nxt, nxtIdx);
      } else if (!root.classList.contains("is-playing")) {
        curIdx = (curIdx + 1) % urls.length;
        load(cur, curIdx);
        safePlay(cur).catch(onBlocked);
      }
    }

    function giveUp() {
      gaveUp = true;
      pauseAll();
      root.classList.remove("is-playing", "is-started");
      vids.forEach(function (v) { v.classList.remove("is-on", "is-cur", "is-top"); });
    }

    function pauseAll() {
      window.clearTimeout(fadeTimer);
      vids.forEach(function (v) { try { v.pause(); } catch (e) {} });
      if (fading) {                                        /* keep state simple: finish a half-done fade */
        fading = false;
        nxt.classList.remove("is-on", "is-top");
      }
    }

    function update() {
      if (!wantPlay()) {
        if (started) { pauseAll(); }
        if (blocked()) { root.classList.remove("is-playing"); }
        return;
      }
      if (!started) { begin(); return; }
      if (cur.paused && cur.classList.contains("is-on")) { safePlay(cur).catch(onBlocked); }
      else if (cur.paused && !cur.classList.contains("is-on")) { safePlay(cur).catch(onBlocked); }
    }

    /* Pause when the section is off screen (the homepage hero). */
    if ("IntersectionObserver" in window && root.classList.contains("vbg--hero")) {
      new IntersectionObserver(function (entries) {
        inView = entries[entries.length - 1].isIntersecting;
        update();
      }, { threshold: 0 }).observe(root);
    }

    document.addEventListener("visibilitychange", update);
    window.addEventListener("pageshow", update);
    if (reduceQuery) {
      var onReduce = function () {
        if (reduceQuery.matches) {
          pauseAll();
          root.classList.remove("is-playing");
          vids.forEach(function (v) { v.classList.remove("is-on", "is-cur", "is-top"); });
          started = false;
        }
        update();
      };
      if (reduceQuery.addEventListener) { reduceQuery.addEventListener("change", onReduce); }
      else if (reduceQuery.addListener) { reduceQuery.addListener(onReduce); }
    }

    update();
  }

  roots.forEach(function (root) {
    try { new Slideshow(root); } catch (e) { /* the normal background stays */ }
  });
})();
