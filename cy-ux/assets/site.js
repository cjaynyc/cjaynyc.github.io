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

/* Work list: hovering, focusing or pressing a name shows its project. */
(function () {
  Array.prototype.forEach.call(document.querySelectorAll('[data-roll]'), function (roll) {
  roll.classList.add('roll-js');
  var items = Array.prototype.slice.call(roll.querySelectorAll('.roll-item'));
  function show(item) {
    items.forEach(function (it) {
      var on = it === item;
      it.classList.toggle('is-active', on);
      it.querySelector('.roll-name').setAttribute('aria-expanded', String(on));
    });
  }
  var hover = window.matchMedia('(hover: hover)').matches;
  items.forEach(function (it) {
    var b = it.querySelector('.roll-name');
    b.addEventListener('click', function () { show(it); });
    b.addEventListener('focus', function () { show(it); });
    if (hover) b.addEventListener('mouseenter', function () { show(it); });
  });
  });
})();

/* Hero: floating screens shift slightly with the pointer. */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var hero = document.querySelector('.hero-float');
  if (!hero) return;
  var tiles = Array.prototype.slice.call(hero.querySelectorAll('.ft'));
  var raf = 0, mx = 0, my = 0;
  hero.addEventListener('pointermove', function (e) {
    var r = hero.getBoundingClientRect();
    mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5;
    if (!raf) raf = requestAnimationFrame(function () {
      raf = 0;
      tiles.forEach(function (t) {
        var d = parseFloat(t.getAttribute('data-depth')) * 14;
        t.style.setProperty('--px', (-mx * d).toFixed(1)); t.style.setProperty('--py', (-my * d).toFixed(1));
      });
    });
  });
})();
