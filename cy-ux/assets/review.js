/* Review panel: mix colour, type, corners and tagline in the preview. Not part of the final site. */
(function () {
  // id, label, page colour, accent colour
  var PAL = [
    ['studio', 'Studio', '#F4F4F2', '#3F4C7A'], ['stone', 'Stone', '#ECEAE6', '#5B6150'],
    ['slate', 'Slate', '#E9ECEF', '#4A6078'], ['graphite', 'Graphite', '#1B1C1D', '#D2C6B2'],
    ['paper', 'Paper', '#F7F5F0', '#141414'], ['moss', 'Moss', '#EDEEEC', '#2F5D50'],
    ['dusk', 'Dusk', '#17161C', '#B9B0E0'], ['clay', 'Clay', '#EFE9E2', '#8F5440'],
    ['fog', 'Fog', '#F1F3F3', '#3B6B69'], ['bone', 'Bone', '#F3F0EA', '#8A6B1F'],
    ['ink', 'Ink', '#10151F', '#9DB7D9'], ['rose', 'Rose', '#F2EEEE', '#7C4A5E']
  ];
  var TYP = [
    ['schibsted', 'Schibsted'], ['instrument', 'Instrument Serif'], ['geist', 'Geist'], ['hanken', 'Hanken'],
    ['newsreader', 'Newsreader'], ['jetbrains', 'JetBrains Mono'], ['manrope', 'Manrope'], ['figtree', 'Figtree'],
    ['fraunces', 'Fraunces'], ['space', 'Space Grotesk'], ['jakarta', 'Jakarta'], ['plex', 'IBM Plex']
  ];
  var SHP = [['round', 'Round'], ['soft', 'Soft'], ['square', 'Square']];
  var LINES = [
    ['Financial software people can actually use.', 0],
    ['Twenty years of making complex finance simple to use.', 3],
    ['I design the screens Wall Street works in.', 0],
    ['Complex finance, made clear.', 0]
  ];
  var root = document.documentElement, h1 = document.querySelector('[data-split]');
  var st = { p: 'studio', t: 'schibsted', s: 'round', l: 0 };
  try {
    var saved = JSON.parse(localStorage.getItem('cyux-mix') || 'null');
    if (saved) for (var k in st) if (saved[k] !== undefined) st[k] = saved[k];
  } catch (e) {}
  location.search.replace(/[?&]([ptsl])=([a-z0-9]+)/g, function (_, k, v) { st[k] = k === 'l' ? parseInt(v, 10) : v; });

  var el = document.createElement('div');
  el.className = 'rv';
  el.innerHTML = '<div class="rv-top"><span class="rv-now" aria-live="polite"></span><button type="button" class="rv-toggle" aria-expanded="false">Customize</button></div><div class="rv-body" hidden></div>';
  var body = el.querySelector('.rv-body'), now = el.querySelector('.rv-now'), toggle = el.querySelector('.rv-toggle');

  function group(title, key, items, cls) {
    var sec = document.createElement('div');
    var h = document.createElement('h4'); h.textContent = title; sec.appendChild(h);
    var g = document.createElement('div'); g.className = cls || 'rv-grid'; sec.appendChild(g);
    items.forEach(function (it, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'rv-opt'; b.dataset.key = key; b.dataset.val = key === 'l' ? i : it[0];
      if (key === 'p') {
        var sw = document.createElement('span'); sw.className = 'rv-sw';
        sw.style.background = 'linear-gradient(135deg,' + it[2] + ' 50' + '%,' + it[3] + ' 50' + '%)';
        b.appendChild(sw);
      }
      b.appendChild(document.createTextNode(key === 'l' ? it[0] : it[1]));
      b.addEventListener('click', function () { st[key] = key === 'l' ? i : it[0]; apply(); });
      g.appendChild(b);
    });
    body.appendChild(sec);
  }
  group('Colour', 'p', PAL); group('Typeface', 't', TYP); group('Corners', 's', SHP); group('Tagline', 'l', LINES, 'rv-lines');

  function name(list, id) { for (var i = 0; i < list.length; i++) if (list[i][0] === id) return list[i][1]; return id; }
  function apply() {
    root.setAttribute('data-palette', st.p); root.setAttribute('data-type', st.t); root.setAttribute('data-shape', st.s);
    var line = LINES[st.l] || LINES[0];
    if (h1 && (h1.getAttribute('aria-label') !== line[0] || h1.getAttribute('data-mute') !== String(line[1]))) {
      h1.setAttribute('data-mute', line[1]);
      if (window.cyuxSplit) { h1.setAttribute('aria-label', line[0]); window.cyuxSplit(h1); } else { h1.textContent = line[0]; }
    }
    if (window.cyuxColours) window.cyuxColours();
    Array.prototype.forEach.call(body.querySelectorAll('.rv-opt'), function (b) {
      b.setAttribute('aria-pressed', String(String(st[b.dataset.key]) === b.dataset.val));
    });
    now.textContent = name(PAL, st.p) + ' · ' + name(TYP, st.t) + ' · ' + name(SHP, st.s);
    try { localStorage.setItem('cyux-mix', JSON.stringify(st)); } catch (e) {}
  }
  toggle.addEventListener('click', function () {
    var open = body.hidden; body.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open)); toggle.textContent = open ? 'Done' : 'Customize';
  });
  document.body.appendChild(el);
  apply();
})();
