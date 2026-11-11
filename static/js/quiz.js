// Chair on Top - quiz.js
// The Find My Aesthetic quiz: question flow, scoring and the personalised result.
//
// All questions, weights and result text come from content/quiz.py (the one place
// to change the rules). The server embeds them in <script id="qz-data">. This file
// only adds the points up. It uses no randomness and calls no outside service.
//
// Progress is saved in this browser only, under the localStorage key "cot.quiz.v1".
// It never touches the other site keys (cot.theme, cot.v1, cot.moodboards.v1, cot.search.v1).

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // 1. SCORING (pure functions: no page needed, easy to test)
  // ---------------------------------------------------------------------

  // Adds up the points for the answers given so far.
  // answers[i] is the chosen option number (0-3) for question i, or null.
  // Returns { scores: {slug: points}, firsts: {slug: number of 3-point answers} }.
  function computeScores(questions, order, answers) {
    var scores = {};
    var firsts = {};
    order.forEach(function (slug) {
      scores[slug] = 0;
      firsts[slug] = 0;
    });
    questions.forEach(function (question, index) {
      var choice = answers[index];
      if (choice === null || choice === undefined) {
        return;
      }
      var option = question.options[choice];
      if (!option) {
        return;
      }
      var top = 0;
      Object.keys(option.weights).forEach(function (slug) {
        top = Math.max(top, option.weights[slug]);
      });
      Object.keys(option.weights).forEach(function (slug) {
        if (!(slug in scores)) {
          return;
        }
        scores[slug] += option.weights[slug];
        if (option.weights[slug] === top && top > 0) {
          firsts[slug] += 1;
        }
      });
    });
    return { scores: scores, firsts: firsts };
  }

  // The most points each style could earn in this quiz (its best answer in every question).
  function maxPossible(questions, order) {
    var max = {};
    order.forEach(function (slug) {
      max[slug] = 0;
    });
    questions.forEach(function (question) {
      order.forEach(function (slug) {
        var best = 0;
        question.options.forEach(function (option) {
          best = Math.max(best, option.weights[slug] || 0);
        });
        max[slug] += best;
      });
    });
    return max;
  }

  // Best first. Ties: 1) more points  2) more 3-point answers  3) the order in content/quiz.py.
  function rankStyles(result, order) {
    return order.slice().sort(function (a, b) {
      if (result.scores[b] !== result.scores[a]) {
        return result.scores[b] - result.scores[a];
      }
      if (result.firsts[b] !== result.firsts[a]) {
        return result.firsts[b] - result.firsts[a];
      }
      return order.indexOf(a) - order.indexOf(b);
    });
  }

  var api = { computeScores: computeScores, maxPossible: maxPossible, rankStyles: rankStyles };
  if (typeof window !== "undefined") {
    window.CotQuiz = api;
  }
  if (typeof document === "undefined" || !document.getElementById) {
    return;
  }

  // ---------------------------------------------------------------------
  // 2. PAGE
  // ---------------------------------------------------------------------
  var dataEl = document.getElementById("qz-data");
  if (!dataEl) {
    return;
  }
  var CFG;
  try {
    CFG = JSON.parse(dataEl.textContent);
  } catch (error) {
    return;
  }
  var questions = CFG.questions || [];
  var order = CFG.order || [];
  var styleBySlug = {};
  (CFG.styles || []).forEach(function (style) {
    styleBySlug[style.slug] = style;
  });
  var TOTAL = questions.length;
  if (!TOTAL || !order.length) {
    return;
  }
  var MAX = maxPossible(questions, order);
  // One common scale for every bar: the highest maximum of any style (28 points in the
  // current configuration). Using each style's own maximum could make the runner-up
  // look higher than the winner, even though ranking is done on raw points.
  var SCALE_MAX = order.reduce(function (best, slug) {
    return Math.max(best, MAX[slug] || 0);
  }, 0);

  var STORE_KEY = "cot.quiz.v1";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(id) {
    return document.getElementById(id);
  }
  var els = {
    intro: $("qz-intro"), stage: $("qz-stage"), result: $("qz-result"), live: $("qz-live"),
    begin: $("qz-begin"), resume: $("qz-resume"), resumeText: $("qz-resume-text"),
    cont: $("qz-continue"), restart: $("qz-restart"),
    count: $("qz-count"), bar: $("qz-bar"), fill: $("qz-bar-fill"),
    card: $("qz-card"), heading: $("qz-heading"), support: $("qz-support"), options: $("qz-options"),
    prev: $("qz-prev"), next: $("qz-next"), hint: $("qz-hint")
  };

  var state = { answers: [], step: 0, done: false };
  for (var n = 0; n < TOTAL; n += 1) {
    state.answers.push(null);
  }

  // ----- saved progress (untrusted input: validate everything) -----
  function load() {
    try {
      var raw = JSON.parse(window.localStorage.getItem(STORE_KEY));
      if (!raw || typeof raw !== "object" || raw.v !== CFG.version || !Array.isArray(raw.a) || raw.a.length !== TOTAL) {
        return null;
      }
      var answers = raw.a.map(function (value, index) {
        return typeof value === "number" && value % 1 === 0 && value >= 0 && value < questions[index].options.length ? value : null;
      });
      var step = typeof raw.s === "number" && raw.s % 1 === 0 && raw.s >= 0 && raw.s < TOTAL ? raw.s : 0;
      var done = raw.d === true && answers.every(function (value) { return value !== null; });
      return { answers: answers, step: step, done: done };
    } catch (error) {
      return null;
    }
  }

  function save() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ v: CFG.version, a: state.answers, s: state.step, d: state.done }));
    } catch (error) { /* private mode or storage full: the quiz still works */ }
  }

  function clearSaved() {
    try {
      window.localStorage.removeItem(STORE_KEY);
    } catch (error) { /* ignore */ }
  }

  function answeredCount() {
    return state.answers.filter(function (value) { return value !== null; }).length;
  }

  function firstUnanswered() {
    for (var i = 0; i < TOTAL; i += 1) {
      if (state.answers[i] === null) {
        return i;
      }
    }
    return TOTAL - 1;
  }

  // ----- small helpers -----
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  function announce(message) {
    if (els.live) {
      els.live.textContent = "";
      window.setTimeout(function () { els.live.textContent = message; }, 40);
    }
  }

  function show(which) {
    els.intro.hidden = which !== "intro";
    els.stage.hidden = which !== "stage";
    els.result.hidden = which !== "result";
    window.scrollTo(0, 0);
  }

  // ----- the check mark drawn inside a selected card -----
  function checkIcon() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M5 12.5l4.5 4.5L19 7.5");
    svg.appendChild(path);
    return svg;
  }

  // ---------------------------------------------------------------------
  // 3. QUESTIONS
  // ---------------------------------------------------------------------
  var LETTERS = ["A", "B", "C", "D"];

  function buildOption(question, qIndex, option, i) {
    var label = el("label", "qz-opt" + (option.image ? "" : " qz-opt-plain"));
    var input = document.createElement("input");
    input.type = "radio";
    input.className = "qz-opt-input";
    input.name = "qz-answer";
    input.value = String(i);
    input.id = "qz-opt-" + qIndex + "-" + i;
    input.checked = state.answers[qIndex] === i;
    label.appendChild(input);

    var media = el("span", "qz-opt-media");
    if (option.image) {
      var img = document.createElement("img");
      img.src = option.image.src;
      if (option.image.width && option.image.height) {
        img.width = option.image.width;
        img.height = option.image.height;
      }
      img.alt = ""; // the card text names the answer, so the picture is decoration
      img.decoding = "async";
      media.appendChild(img);
    } else {
      media.appendChild(el("span", "qz-opt-letter", LETTERS[i]));
    }
    label.appendChild(media);

    var body = el("span", "qz-opt-body");
    body.appendChild(el("span", "qz-opt-title", option.title));
    body.appendChild(el("span", "qz-opt-text", option.text));
    if (option.swatches && option.swatches.length) {
      var strip = el("span", "qz-swatches");
      strip.setAttribute("aria-hidden", "true");
      option.swatches.forEach(function (color) {
        if (/^#[0-9a-fA-F]{6}$/.test(color)) {
          var dot = el("span", "qz-swatch");
          dot.style.backgroundColor = color;
          strip.appendChild(dot);
        }
      });
      body.appendChild(strip);
    }
    label.appendChild(body);

    var tick = el("span", "qz-opt-check");
    tick.appendChild(checkIcon());
    label.appendChild(tick);

    input.addEventListener("change", function () {
      state.answers[qIndex] = i;
      save();
      refreshNav();
    });
    return label;
  }

  function fillQuestion() {
    var q = questions[state.step];
    els.count.textContent = "Question " + (state.step + 1) + " of " + TOTAL;
    els.bar.setAttribute("aria-valuenow", String(state.step + 1));
    els.bar.setAttribute("aria-valuetext", "Question " + (state.step + 1) + " of " + TOTAL);
    els.fill.style.width = ((state.step + 1) / TOTAL) * 100 + "%";
    els.heading.textContent = q.heading;
    els.support.textContent = q.support;
    els.support.hidden = !q.support;
    els.options.textContent = "";
    q.options.forEach(function (option, i) {
      els.options.appendChild(buildOption(q, state.step, option, i));
    });
    els.options.classList.toggle("qz-options-plain", q.options.every(function (o) { return !o.image; }));
    els.next.textContent = state.step === TOTAL - 1 ? "See my result" : "Next \u2192";
    refreshNav();
  }

  function refreshNav() {
    var has = state.answers[state.step] !== null;
    els.next.disabled = !has;
    els.hint.textContent = has ? "You can change your answer at any time." : "Choose an answer to continue.";
  }

  function preloadNext() {
    var nextQ = questions[state.step + 1];
    if (!nextQ || (navigator.connection && navigator.connection.saveData)) {
      return;
    }
    var run = function () {
      nextQ.options.forEach(function (option) {
        if (option.image) {
          var img = new Image();
          img.src = option.image.src;
        }
      });
    };
    if (window.requestIdleCallback) {
      window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      window.setTimeout(run, 400);
    }
  }

  // Fades the card out, swaps the question, fades it in. Instant for reduced motion.
  function goToStep(step, focus) {
    state.step = step;
    state.done = false;
    save();
    var swap = function () {
      fillQuestion();
      els.card.classList.remove("qz-leave");
      els.card.classList.add("qz-enter");
      window.setTimeout(function () { els.card.classList.remove("qz-enter"); }, 400);
      announce("Question " + (step + 1) + " of " + TOTAL + ". " + questions[step].heading);
      if (focus) {
        els.heading.focus({ preventScroll: true });
      }
      preloadNext();
    };
    if (reduceMotion || els.stage.hidden) {
      swap();
    } else {
      els.card.classList.add("qz-leave");
      window.setTimeout(swap, 170);
    }
  }

  function openStage(step) {
    show("stage");
    els.card.classList.remove("qz-leave", "qz-enter");
    goToStep(step, true);
  }

  els.begin.addEventListener("click", function () {
    clearSaved();
    state.answers = state.answers.map(function () { return null; });
    openStage(0);
  });
  els.cont.addEventListener("click", function () {
    openStage(firstUnanswered());
  });
  els.restart.addEventListener("click", function () {
    clearSaved();
    state.answers = state.answers.map(function () { return null; });
    els.resume.hidden = true;
    openStage(0);
  });

  els.prev.addEventListener("click", function () {
    if (state.step === 0) {
      showIntro();
    } else {
      goToStep(state.step - 1, true);
    }
  });

  els.next.addEventListener("click", function () {
    if (state.answers[state.step] === null) {
      return; // cannot move on without an answer
    }
    if (state.step < TOTAL - 1) {
      goToStep(state.step + 1, true);
    } else {
      finish();
    }
  });

  // ---------------------------------------------------------------------
  // 4. RESULT
  // ---------------------------------------------------------------------
  function percent(slug, result) {
    return SCALE_MAX ? Math.round((result.scores[slug] / SCALE_MAX) * 100) : 0;
  }

  function meterRow(slug, result, strong) {
    var style = styleBySlug[slug];
    var row = el("div", "qz-row" + (strong ? " qz-row-strong" : ""));
    var head = el("div", "qz-row-head");
    head.appendChild(el("span", "qz-row-name", style.name));
    head.appendChild(el("span", "qz-row-score", result.scores[slug] + " of " + SCALE_MAX + " points \u00b7 " + percent(slug, result) + "%"));
    row.appendChild(head);
    var track = el("div", "qz-track");
    track.setAttribute("aria-hidden", "true");
    var fill = el("span", "qz-track-fill");
    fill.dataset.w = percent(slug, result) + "%";
    track.appendChild(fill);
    row.appendChild(track);
    return row;
  }

  function showResult(result, ranked) {
    var first = ranked[0];
    var second = ranked[1];
    var p1 = CFG.profiles[first];
    var p2 = second ? CFG.profiles[second] : null;
    var s1 = styleBySlug[first];
    var s2 = second ? styleBySlug[second] : null;
    if (!p1 || !s1) {
      return;
    }

    $("qz-res-title").textContent = p1.title;
    $("qz-res-name").textContent = s1.name;
    $("qz-res-summary").textContent = p1.summary;
    var hero = $("qz-res-img");
    if (p1.hero) {
      hero.src = p1.hero.src;
      if (p1.hero.width && p1.hero.height) {
        hero.width = p1.hero.width;
        hero.height = p1.hero.height;
      }
      hero.alt = "A photograph from the " + s1.name + " collection";
      hero.parentNode.hidden = false;
    } else {
      hero.parentNode.hidden = true;
    }
    var explore = $("qz-res-explore");
    explore.href = p1.href;
    explore.textContent = "Explore the full " + s1.name + " collection";

    // Compare the top two, then all eight.
    var cmp = $("qz-cmp");
    cmp.textContent = "";
    cmp.appendChild(meterRow(first, result, true));
    if (second) {
      cmp.appendChild(meterRow(second, result, false));
    }
    var all = $("qz-cmp-all");
    all.textContent = "";
    ranked.forEach(function (slug) {
      all.appendChild(meterRow(slug, result, false));
    });

    // Characteristics.
    $("qz-traits-title").textContent = s1.name + " at a glance";
    $("qz-traits-desc").textContent = s1.description;
    var traits = $("qz-traits");
    traits.textContent = "";
    (p1.traits || []).forEach(function (pair) {
      var group = el("div", "qz-trait");
      group.appendChild(el("dt", "", pair[0]));
      group.appendChild(el("dd", "", pair[1]));
      traits.appendChild(group);
    });

    // Real gallery photographs for the matching collection.
    $("qz-gal-title").textContent = s1.name + " in pictures";
    var gallery = $("qz-gallery");
    gallery.textContent = "";
    var tpl = document.getElementById("qz-gal-" + first);
    if (tpl && tpl.content) {
      gallery.appendChild(tpl.content.cloneNode(true));
      if (window.CoT && window.CoT.syncButtons) {
        window.CoT.syncButtons(gallery);
      }
    }
    var more = $("qz-gal-link");
    more.href = p1.href;
    more.textContent = "Explore all " + s1.count + " " + s1.name + " images";

    // Second match.
    var secondSection = $("qz-second-title").closest("section");
    if (p2 && s2) {
      secondSection.hidden = false;
      $("qz-second-title").textContent = s2.name;
      $("qz-second-desc").textContent = s2.description + " Your answers also pointed here, so it is worth a look.";
      var link = $("qz-second-link");
      link.href = p2.href;
      link.textContent = "View the " + s2.name + " collection";
      var img2 = $("qz-second-img");
      if (p2.hero) {
        img2.src = p2.hero.src;
        if (p2.hero.width && p2.hero.height) {
          img2.width = p2.hero.width;
          img2.height = p2.hero.height;
        }
        img2.alt = "A photograph from the " + s2.name + " collection";
        img2.parentNode.hidden = false;
      } else {
        img2.parentNode.hidden = true;
      }
    } else {
      secondSection.hidden = true;
    }

    show("result");
    announce("Your result: " + p1.title + ", " + s1.name + ".");
    $("qz-res-title").focus({ preventScroll: true });

    // Grow the score bars after the result is on screen.
    var fills = els.result.querySelectorAll(".qz-track-fill");
    var grow = function () {
      Array.prototype.forEach.call(fills, function (fill) { fill.style.width = fill.dataset.w; });
    };
    if (reduceMotion) {
      grow();
    } else {
      window.requestAnimationFrame(function () { window.requestAnimationFrame(grow); });
    }
  }

  function finish() {
    if (answeredCount() < TOTAL) {
      goToStep(firstUnanswered(), true);
      return;
    }
    state.done = true;
    save();
    var result = computeScores(questions, order, state.answers);
    showResult(result, rankStyles(result, order));
  }

  function retake() {
    clearSaved();
    state.answers = state.answers.map(function () { return null; });
    state.done = false;
    openStage(0);
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-qz-retake]"), function (button) {
    button.addEventListener("click", retake);
  });

  // ---------------------------------------------------------------------
  // 5. START
  // ---------------------------------------------------------------------
  function showIntro() {
    var count = answeredCount();
    if (count > 0 && count < TOTAL) {
      els.resumeText.textContent = "You have an unfinished quiz: " + count + " of " + TOTAL + " answered.";
      els.resume.hidden = false;
    } else {
      els.resume.hidden = true;
    }
    show("intro");
  }

  var saved = load();
  if (saved) {
    state.answers = saved.answers;
    state.step = saved.step;
    state.done = saved.done;
  }
  if (state.done) {
    finish();
  } else {
    showIntro();
  }
})();
