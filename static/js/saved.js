// Chair on Top - saved.js
// The /saved page. The server lists every photograph (hidden); this script
// shows only the ones saved in this browser, newest first.

(function () {
  "use strict";

  var list = document.getElementById("sv-list");
  var empty = document.getElementById("sv-empty");
  var count = document.getElementById("sv-count");
  if (!list || !empty || !count || !window.CoT) {
    return;
  }

  var cards = Array.prototype.slice.call(list.children);
  var byId = {};
  cards.forEach(function (card) {
    byId[card.getAttribute("data-id")] = card;
  });

  function render() {
    var ids = window.CoT.list("saves").reverse();
    var shown = {};
    var total = 0;
    var active = document.activeElement;
    var hadFocusInside = false;

    ids.forEach(function (id) {
      var card = Object.prototype.hasOwnProperty.call(byId, id) ? byId[id] : null;
      if (!card) {
        return; // ignore anything that is not a real photograph
      }
      var img = card.querySelector("img[data-src]");
      if (img) {
        img.src = img.getAttribute("data-src");
        img.removeAttribute("data-src");
      }
      card.hidden = false;
      list.appendChild(card);
      shown[id] = true;
      total += 1;
    });

    cards.forEach(function (card) {
      if (!shown[card.getAttribute("data-id")]) {
        if (active && card.contains(active)) {
          hadFocusInside = true;
        }
        card.hidden = true;
      }
    });

    count.textContent = total + (total === 1 ? " saved photograph" : " saved photographs");
    empty.hidden = total > 0;
    list.hidden = total === 0;
    if (hadFocusInside) {
      count.focus(); // the button that was used just disappeared
    }
  }

  document.addEventListener("cot:change", render);
  render();
})();
