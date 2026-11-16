/* Services band: one card open at a time; the band takes the open card's colour. */
(function () {
  var band = document.querySelector('[data-band]');
  if (!band) return;
  var tabs = Array.prototype.slice.call(band.querySelectorAll('.tab'));
  function open(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.classList.toggle('is-open', on);
      t.querySelector('button').setAttribute('aria-expanded', String(on));
      t.querySelector('p').hidden = !on;
    });
    band.setAttribute('data-tone', tab.getAttribute('data-tone'));
  }
  tabs.forEach(function (t) {
    t.querySelector('button').addEventListener('click', function () { open(t); });
  });
  open(tabs[0]);
})();
