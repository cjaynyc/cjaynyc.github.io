/* CYUX motion: word reveal, scroll reveal, and a soft hero shader.
   Everything is skipped when the visitor prefers reduced motion. */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var root = document.documentElement;
  root.classList.add('motion');

  // 1. Headline: reveal word by word. data-mute="N" greys the last N words.
  function split(h1) {
    var words = (h1.getAttribute('aria-label') || h1.textContent).trim().split(/\s+/);
    var mute = parseInt(h1.getAttribute('data-mute') || '0', 10);
    h1.setAttribute('aria-label', words.join(' '));
    h1.textContent = '';
    words.forEach(function (w, i) {
      var outer = document.createElement('span');
      outer.className = 'word' + (i >= words.length - mute ? ' mute' : '');
      outer.setAttribute('aria-hidden', 'true');
      var inner = document.createElement('span');
      inner.textContent = w;
      inner.style.animationDelay = (i * 60) + 'ms';
      outer.appendChild(inner);
      h1.appendChild(outer);
      h1.appendChild(document.createTextNode(' '));
    });
  }
  var h1 = document.querySelector('[data-split]');
  if (h1) split(h1);
  window.cyuxSplit = split;

  // 2. Sections: fade up as they scroll into view
  var items = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  // 2b. Statement: words light up as the paragraph scrolls through the viewport
  Array.prototype.forEach.call(document.querySelectorAll('[data-fill]'), function (fill) {
    var text = fill.textContent.trim();
    fill.setAttribute('aria-label', text);
    fill.textContent = '';
    var ws = text.split(/\s+/).map(function (w) {
      var sp = document.createElement('span');
      sp.className = 'w'; sp.setAttribute('aria-hidden', 'true'); sp.textContent = w;
      fill.appendChild(sp); fill.appendChild(document.createTextNode(' '));
      return sp;
    });
    var ticking = false;
    function light() {
      ticking = false;
      var r = fill.getBoundingClientRect(), vh = window.innerHeight;
      var prog = (vh * 0.85 - r.top) / (vh * 0.5 + r.height);
      var n = Math.round(Math.max(0, Math.min(1, prog)) * ws.length);
      ws.forEach(function (sp, i) { sp.classList.toggle('lit', i < n); });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(light); } }, { passive: true });
    light();
  });

  // 3. Hero: slow flowing colour field drawn with a WebGL shader
  var canvas = document.querySelector('.hero-canvas');
  if (!canvas) return;
  var gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return;

  var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var fs = [
    'precision mediump float;uniform vec2 r;uniform float t;uniform vec3 bg,g,o;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    'return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n(p);p*=2.;a*=.5;}return s;}',
    'void main(){vec2 p=gl_FragCoord.xy/r.y*1.6;',
    'float w=fbm(p*1.2-t*.02);',
    'float a=fbm(p+vec2(t*.03,t*.02)+w);',
    'float b=fbm(p*.8+7.-vec2(t*.025,0.)+w*.5);',
    
    'vec3 c=mix(bg,g,smoothstep(.38,.75,a));',
    'c=mix(c,o,smoothstep(.58,.85,b)*.55);',
    'gl_FragColor=vec4(c,1.);}'
  ].join('');

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  var v = shader(gl.VERTEX_SHADER, vs), f = shader(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't');
  // Colours come from the CSS tokens --sh-1, --sh-2, --sh-3
  function colours() {
    var cs = getComputedStyle(root);
    ['bg', 'g', 'o'].forEach(function (name, i) {
      var hex = cs.getPropertyValue('--sh-' + (i + 1)).trim().replace('#', '');
      var n = parseInt(hex, 16);
      gl.uniform3f(gl.getUniformLocation(prog, name), (n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255);
    });
  }
  colours();
  window.cyuxColours = colours;

  function resize() {
    // Half resolution: the field is soft, so this is invisible and cheap.
    var w = Math.max(1, Math.round(canvas.clientWidth / 2));
    var h = Math.max(1, Math.round(canvas.clientHeight / 2));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h);
    }
  }
  var visible = true, raf = 0;
  function frame(ms) {
    raf = 0;
    if (!visible || document.hidden) return;
    resize();
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, ms / 1000 + 40);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf) raf = requestAnimationFrame(frame); }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) start(); }).observe(canvas);
  }
  document.addEventListener('visibilitychange', start);
  canvas.classList.add('on');
  start();
})();
