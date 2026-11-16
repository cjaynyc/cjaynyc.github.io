/* Review bar: lets Chris compare looks in the preview. Not part of the final site. */
(function () {
  var looks = [
    { id: 'stone', label: 'Stone', line: 'Twenty years of making complex finance simple to use.', mute: 3 },
    { id: 'slate', label: 'Slate', line: 'Financial software people can actually use.', mute: 0 },
    { id: 'graphite', label: 'Graphite', line: 'I design the screens Wall Street works in.', mute: 0 }
  ];
  var root = document.documentElement;
  var h1 = document.querySelector('[data-split]');
  var bar = document.createElement('div');
  bar.className = 'review-bar';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Compare looks');
  var tag = document.createElement('span');
  tag.textContent = 'Look';
  bar.appendChild(tag);

  function apply(look) {
    if (look.id) root.setAttribute('data-theme', look.id); else root.removeAttribute('data-theme');
    if (h1) {
      h1.setAttribute('data-mute', look.mute);
      if (window.cyuxSplit) { h1.setAttribute('aria-label', look.line); window.cyuxSplit(h1); }
      else { h1.textContent = look.line; }
    }
    if (window.cyuxColours) window.cyuxColours();
    Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.id === look.id));
    });
    try { localStorage.setItem('cyux-look', look.id); } catch (e) {}
  }
  looks.forEach(function (look) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = look.label; b.dataset.id = look.id;
    b.addEventListener('click', function () { apply(look); });
    bar.appendChild(b);
  });
  document.body.appendChild(bar);
  var saved = 'stone';
  try { var v = localStorage.getItem('cyux-look'); if (v !== null) saved = v; } catch (e) {}
  var q = /[?&]look=([a-z]*)/.exec(location.search); if (q) saved = q[1];
  apply(looks.filter(function (l) { return l.id === saved; })[0] || looks[0]);
})();
