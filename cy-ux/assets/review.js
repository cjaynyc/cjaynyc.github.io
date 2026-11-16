/* Review panel: mix colour, type, corners and tagline in the preview. Not part of the final site. */
(function () {
  // id, label, page colour, accent colour
  var PAL = [
    ['gallery', 'Gallery', '#F4F3F1', '#0A0A0A'],
    ['chalk', 'Chalk', '#F2F1EE', '#3A3835'],
    ['putty', 'Putty', '#E8E4DD', '#6F675A'],
    ['mushroom', 'Mushroom', '#E9E4E1', '#7A6A66'],
    ['oat', 'Oat', '#EEE8DC', '#7A6E55'],
    ['sage', 'Sage', '#E6E9E3', '#5F6E5C'],
    ['lichen', 'Lichen', '#E4E9E7', '#56706B'],
    ['mist', 'Mist', '#E6E9EC', '#5C6B7D'],
    ['pewter', 'Pewter', '#E7E8E8', '#4C5151'],
    ['heather', 'Heather', '#E8E6EA', '#6D6478'],
    ['ash', 'Ash', '#1E1F1F', '#CFCDC6'],
    ['peat', 'Peat', '#211E1B', '#C9BBA6'],
    ['deep', 'Deep', '#1A1E22', '#B4C0CB']
  ];
  var TYP = [
    ['tight', 'Inter Tight'],     ['schibsted', 'Schibsted'], ['instrument', 'Instrument Serif'], ['geist', 'Geist'], ['hanken', 'Hanken'],
    ['newsreader', 'Newsreader'], ['jetbrains', 'JetBrains Mono'], ['manrope', 'Manrope'], ['figtree', 'Figtree'],
    ['fraunces', 'Fraunces'], ['space', 'Space Grotesk'], ['jakarta', 'Jakarta'], ['plex', 'IBM Plex']
  ];
  var LAY = [['float', 'Float', {p:'gallery',t:'tight',s:'soft'}], ['index', 'Index', {p:'chalk',t:'instrument',s:'square'}], ['editorial', 'Editorial', {p:'gallery',t:'newsreader',s:'square'}], ['cinema', 'Cinema', {p:'ash',t:'tight',s:'soft'}], ['sentence', 'Sentence', {p:'gallery',t:'tight',s:'soft'}], ['poster', 'Poster', {p:'gallery',t:'tight',s:'square'}], ['ledger', 'Ledger', {p:'deep',t:'newsreader',s:'square'}], ['halo', 'Halo', {p:'chalk',t:'fraunces',s:'soft'}], ['profile', 'Profile', {p:'gallery',t:'tight',s:'soft'}], ['letter', 'Letter', {p:'chalk',t:'plex',s:'square'}], ['timeline', 'Timeline', {p:'putty',t:'instrument',s:'square'}], ['split', 'Split', {p:'chalk',t:'geist',s:'soft'}], ['name', 'Name', {p:'gallery',t:'tight',s:'square'}], ['bento', 'Bento', {p:'pewter',t:'jakarta',s:'round'}], ['stack', 'Stack', {p:'gallery',t:'tight',s:'round'}], ['ticker', 'Ticker', {p:'deep',t:'tight',s:'square'}]];
  var CON = [['ai', 'AI partner'], ['firm', 'By firm'], ['street', 'Wall Street']];
  var SHP = [['round', 'Round'], ['soft', 'Soft'], ['square', 'Square']];
  var TEX = [['none', 'None'], ['grain', 'Grain'], ['paper', 'Paper'], ['linen', 'Linen'], ['grid', 'Grid'], ['dots', 'Dots']];
  var LINES = [
    ['Financial software people can actually use.', 0],
    ['Twenty years of making complex finance simple to use.', 3],
    ['I design the screens Wall Street works in.', 0],
    ['Complex finance, made clear.', 0],
    ['I design financial software with AI as a partner.', 0],
    ['Twenty years of design judgment. Now at AI speed.', 4]
  ];
  var root = document.documentElement, h1 = document.querySelector('[data-split]');
  var st = { c: 'ai', y: 'float', p: 'gallery', t: 'tight', s: 'soft', x: 'none', l: 4 };
  try {
    var saved = JSON.parse(localStorage.getItem('cyux-mix6') || 'null');
    if (saved) for (var k in st) if (saved[k] !== undefined) st[k] = saved[k];
  } catch (e) {}
  location.search.replace(/[?&]([cyptsxl])=([a-z0-9]+)/g, function (_, k, v) { st[k] = k === 'l' ? parseInt(v, 10) : v; });

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
      b.addEventListener('click', function () { st[key] = key === 'l' ? i : it[0]; if (key === 'y') { for (var q in it[2]) st[q] = it[2][q]; } if (key === 'c') { st.l = it[0] === 'street' ? 2 : (it[0] === 'ai' ? 4 : 0); } apply(); });
      g.appendChild(b);
    });
    body.appendChild(sec);
  }
  group('Content', 'c', CON); group('Layout', 'y', LAY); group('Colour', 'p', PAL); group('Typeface', 't', TYP); group('Texture', 'x', TEX); group('Corners', 's', SHP); group('Tagline', 'l', LINES, 'rv-lines');

  function name(list, id) { for (var i = 0; i < list.length; i++) if (list[i][0] === id) return list[i][1]; return id; }
  function apply() {
    root.setAttribute('data-content', st.c);
    var wf = document.querySelector('section[data-c~="firm"].work-roll'), ws = document.querySelector('section[data-c="street"].work-roll');
    if (wf && ws) { wf.id = st.c === 'street' ? 'work-firm' : 'work'; ws.id = st.c === 'street' ? 'work' : 'work-street'; } root.setAttribute('data-layout', st.y); root.setAttribute('data-palette', st.p); root.setAttribute('data-type', st.t); root.setAttribute('data-shape', st.s); root.setAttribute('data-texture', st.x);
    var line = LINES[st.l] || LINES[0];
    if (h1 && (h1.getAttribute('aria-label') !== line[0] || h1.getAttribute('data-mute') !== String(line[1]))) {
      h1.setAttribute('data-mute', line[1]);
      if (window.cyuxSplit) { h1.setAttribute('aria-label', line[0]); window.cyuxSplit(h1); } else { h1.textContent = line[0]; }
    }
    if (window.cyuxColours) window.cyuxColours();
    Array.prototype.forEach.call(body.querySelectorAll('.rv-opt'), function (b) {
      b.setAttribute('aria-pressed', String(String(st[b.dataset.key]) === b.dataset.val));
    });
    now.textContent = name(CON, st.c) + ' · ' + name(LAY, st.y) + ' · ' + name(PAL, st.p) + ' · ' + name(TYP, st.t) + ' · ' + name(SHP, st.s) + (st.x !== 'none' ? ' · ' + name(TEX, st.x) : '');
    try { localStorage.setItem('cyux-mix6', JSON.stringify(st)); } catch (e) {}
  }
  toggle.addEventListener('click', function () {
    var open = body.hidden; body.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open)); toggle.textContent = open ? 'Done' : 'Customize';
  });
  document.body.appendChild(el);
  apply();
})();
