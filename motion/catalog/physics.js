import {
  BezierCatalogue,
  Easing,
  SpringPresets,
  animateValue,
  createDragGesture,
  createSpringValue,
  dampingRatio,
  nearestSnapPoint,
  onFrame,
  projectMomentum,
  rubberBand,
  springAt,
  springSettlingTime,
} from '../engine.js';

export const category = {
  id: 'physics',
  index: '02',
  title: 'Acceleration & physics',
  blurb:
    'The engine underneath everything else. Springs solved in closed form, curves you can compare side by side, and the two gesture behaviours — momentum projection and rubber-band resistance — that make dragging feel like handling an object.',
};

export const entries = [
  {
    id: 'spring-lab',
    title: 'Spring solver',
    summary:
      'Move the sliders and watch the damping ratio move with them. The curve is sampled from the same closed-form solution that drives the puck, so plot and motion cannot disagree.',
    chips: ['closed form', 'zeta readout', 'interactive'],
    hint: 'Drag the sliders, then replay',
    stage: { tall: true },
    prompt: `Implement a closed-form spring solver. Do not integrate step by step.

Model: m*x'' + c*x' + k*x = 0, solved in displacement-from-target space so the
solution is a pure function of elapsed time.

  omega = sqrt(k / m)                  natural frequency, rad/s
  zeta  = c / (2 * sqrt(k * m))        damping ratio

Three regimes, all three required:
  zeta < 1  underdamped     u(t) = e^(-zeta*omega*t) * (A*cos(wd*t) + B*sin(wd*t))
                            where wd = omega * sqrt(1 - zeta^2),
                            A = u0, B = (v0 + zeta*omega*u0) / wd
  zeta = 1  critically damped  u(t) = e^(-omega*t) * (A + B*t)
                            where A = u0, B = v0 + omega*u0
  zeta > 1  overdamped      u(t) = C1*e^(r1*t) + C2*e^(r2*t)
                            where r = -zeta*omega +/- omega*sqrt(zeta^2 - 1),
                            C1 = (v0 - u0*r2) / (r1 - r2), C2 = u0 - C1

Return { value: to + u, velocity: u', isResting }. Rest when |u| < 0.01 AND
|u'| < 0.05; snap exactly to the target when resting so the value never
asymptotes at 0.9999.

Why closed form rather than a per-frame integrator:
- A dropped frame cannot cause drift. Position depends on elapsed time, not on
  an accumulator that assumed 16.7ms steps.
- Retargeting mid-flight is exact: read the current velocity, start a new solve
  with it as v0. Continuous, no discontinuity at the seam.
- The same function serves a real-time rAF loop and a deterministic frame
  renderer with no changes.

Also implement springSettlingTime(): solve the exponential envelope for the
moment amplitude drops below the rest threshold,
t = ln(amplitude / restDisplacement) / (zeta * omega). Use it to size
sequences instead of guessing durations.`,
    code: `export function springAt(time: number, options: SpringOptions = {}): SpringState {
  const { mass = 1, stiffness = 260, damping = 26, from = 0, to = 1, velocity: v0 = 0 } = options;

  const t = Math.max(0, time);
  const omega = Math.sqrt(stiffness / mass);        // natural frequency
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));  // damping ratio

  const u0 = from - to;   // solve in displacement-from-target space
  let u: number, du: number;

  if (zeta < 1) {
    // Underdamped — decaying sinusoid, overshoots and rings.
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * omega * t);
    const A = u0;
    const B = (v0 + zeta * omega * u0) / wd;
    const cos = Math.cos(wd * t), sin = Math.sin(wd * t);
    u = envelope * (A * cos + B * sin);
    du = envelope * (-zeta * omega * (A * cos + B * sin) + wd * (B * cos - A * sin));
  } else if (zeta === 1) {
    // Critically damped — fastest approach with zero overshoot.
    const envelope = Math.exp(-omega * t);
    const A = u0, B = v0 + omega * u0;
    u = envelope * (A + B * t);
    du = envelope * (B - omega * (A + B * t));
  } else {
    // Overdamped — two real roots, sluggish, never crosses the target.
    const rad = omega * Math.sqrt(zeta * zeta - 1);
    const r1 = -zeta * omega + rad, r2 = -zeta * omega - rad;
    const C1 = (v0 - u0 * r2) / (r1 - r2), C2 = u0 - C1;
    const e1 = Math.exp(r1 * t), e2 = Math.exp(r2 * t);
    u = C1 * e1 + C2 * e2;
    du = C1 * r1 * e1 + C2 * r2 * e2;
  }

  // Snap on rest so the value never asymptotes at 0.9999.
  const resting = Math.abs(u) < 0.01 && Math.abs(du) < 0.05;
  return resting
    ? { value: to, velocity: 0, isResting: true }
    : { value: to + u, velocity: du, isResting: false };
}`,
    notes: `<strong>Read the zeta value as you drag.</strong> It is the single number that predicts how the motion will feel, and it is worth more than any preset name.
<ul>
<li><strong>ζ &lt; 1</strong> — overshoots and rings. Below about 0.5 it reads as bouncy; around 0.8 it reads as responsive.</li>
<li><strong>ζ = 1</strong> — critically damped. The fastest possible arrival with no overshoot. Correct for anything that reflows layout, because overshoot there means the page moves twice.</li>
<li><strong>ζ &gt; 1</strong> — overdamped. Never crosses the target; approaches slowly. Reads as heavy or, past ~1.5, as broken.</li>
</ul>
The settling time is derived from the exponential envelope, not measured by simulating — which is why you can size a sequence before you run it.`,
    mount(stage) {
      stage.innerHTML = `
        <div class="d-lab">
          <div class="d-lab-controls">
            <div class="d-lab-control">
              <span class="d-label">stiffness</span>
              <input class="d-slider" type="range" min="40" max="600" step="5" value="260" data-k>
              <span class="d-readout" data-k-out>260</span>
            </div>
            <div class="d-lab-control">
              <span class="d-label">damping</span>
              <input class="d-slider" type="range" min="2" max="80" step="1" value="26" data-c>
              <span class="d-readout" data-c-out>26</span>
            </div>
            <div class="d-lab-control">
              <span class="d-label">mass</span>
              <input class="d-slider" type="range" min="0.4" max="5" step="0.1" value="1" data-m>
              <span class="d-readout" data-m-out>1.0</span>
            </div>
            <div class="d-lab-stageline">
              <div class="d-lab-puck"></div>
            </div>
            <div class="d-readout">
              ζ <b data-zeta>0.81</b> · <b data-regime>underdamped</b> · settles <b data-settle>0.42</b>s
            </div>
          </div>
          <svg class="d-lab-plot" width="232" height="132" viewBox="0 0 232 132" aria-hidden="true">
            <line class="d-plot-grid" x1="0" y1="100" x2="232" y2="100"></line>
            <line class="d-plot-target" x1="0" y1="32" x2="232" y2="32"></line>
            <path class="d-plot-curve" data-curve d=""></path>
          </svg>
        </div>`;

      const q = (sel) => stage.querySelector(sel);
      const puck = q('.d-lab-puck');
      const curve = q('[data-curve]');
      const inputs = { k: q('[data-k]'), c: q('[data-c]'), m: q('[data-m]') };
      const outputs = {
        k: q('[data-k-out]'),
        c: q('[data-c-out]'),
        m: q('[data-m-out]'),
        zeta: q('[data-zeta]'),
        regime: q('[data-regime]'),
        settle: q('[data-settle]'),
      };

      const TRAVEL = 232 - 12 - 28;
      // Plot mapping: y=100 is the start value, y=32 is the target.
      const PLOT_BASE = 100;
      const PLOT_TARGET = 32;

      const config = () => ({
        mass: Number(inputs.m.value),
        stiffness: Number(inputs.k.value),
        damping: Number(inputs.c.value),
      });

      function redraw() {
        const cfg = config();
        const zeta = dampingRatio(cfg);
        const settle = springSettlingTime({ ...cfg, from: 0, to: 1 });
        const span = Math.min(Math.max(settle * 1.15, 0.3), 4);

        outputs.k.textContent = String(cfg.stiffness);
        outputs.c.textContent = String(cfg.damping);
        outputs.m.textContent = cfg.mass.toFixed(1);
        outputs.zeta.textContent = zeta.toFixed(2);
        outputs.regime.textContent =
          zeta < 0.995 ? 'underdamped' : zeta > 1.005 ? 'overdamped' : 'critical';
        outputs.settle.textContent = Number.isFinite(settle) ? settle.toFixed(2) : '∞';

        const SAMPLES = 116;
        let path = '';
        for (let i = 0; i <= SAMPLES; i++) {
          const t = (i / SAMPLES) * span;
          const { value } = springAt(t, { ...cfg, from: 0, to: 1 });
          const x = (i / SAMPLES) * 232;
          const y = PLOT_BASE - value * (PLOT_BASE - PLOT_TARGET);
          path += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${Math.max(-8, Math.min(140, y)).toFixed(2)}`;
        }
        curve.setAttribute('d', path);
        return span;
      }

      let position = createSpringValue(0, {
        ...config(),
        onChange: (v) => {
          puck.style.transform = `translateX(${v * TRAVEL}px)`;
        },
      });
      let atEnd = false;

      function rebuild() {
        position.stop();
        const current = position.get();
        position = createSpringValue(current, {
          ...config(),
          onChange: (v) => {
            puck.style.transform = `translateX(${v * TRAVEL}px)`;
          },
        });
      }

      for (const input of Object.values(inputs)) {
        input.addEventListener('input', () => {
          redraw();
          rebuild();
        });
      }

      redraw();

      const replay = () => {
        atEnd = !atEnd;
        position.set(atEnd ? 1 : 0);
      };

      // Kick it once so the card is not inert on arrival.
      const timer = setTimeout(replay, 260);

      return {
        replay,
        destroy() {
          clearTimeout(timer);
          position.stop();
        },
      };
    },
  },

  {
    id: 'easing-lab',
    title: 'Curve catalogue',
    summary:
      'Seven curves, plotted and running at once. Comparison is the point — a curve only means something next to the ones you did not pick.',
    chips: ['cubic-bezier', 'Newton-Raphson', 'CSS parity'],
    hint: 'Replay to run all seven',
    stage: { tall: true },
    prompt: `Implement a cubic-bezier easing solver matching the CSS definition, then
build a comparison grid.

Solver
- CSS cubic-bezier(x1, y1, x2, y2) fixes P0 at (0,0) and P3 at (1,1).
- For one axis, B(t) = 3*p1*t*(1-t)^2 + 3*p2*t^2*(1-t) + t^3. Rewrite in
  polynomial form: c = 3*p1, b = 3*(p2 - p1) - c, a = 1 - c - b, so
  B(t) = ((a*t + b)*t + c)*t.
- Easing is y(x), but the curve is parameterised by t, so you must INVERT x(t)
  first. Newton-Raphson using dx/dt = (3a*t + 2b)*t + c, 8 iterations,
  epsilon 1e-7.
- Newton diverges where the slope collapses (near-vertical handles). Guard on
  |slope| < 1e-3 and fall back to bisection over [0,1], 32 iterations. Skipping
  the fallback is what makes hand-rolled solvers wrong at the extremes.
- Clamp x1 and x2 to [0,1] since x(t) must be monotonic to invert. Leave y1/y2
  unclamped so overshoot and anticipation curves stay expressible.

Catalogue - name them by role, not by shape:
  standard   (0.4, 0, 0.2, 1)          symmetric in-out, layout-safe default
  decelerate (0, 0, 0.2, 1)            entrances, arriving from off-screen
  accelerate (0.4, 0, 1, 1)            exits, leaving permanently
  emphasized (0.2, 0, 0, 1)            hero moments, long travel
  anticipate (0.6, -0.28, 0.735, 0.045) pulls back before committing
  overshoot  (0.34, 1.56, 0.64, 1)     passes the target and returns
  sharp      (0.4, 0, 0.6, 1)          dense high-frequency feedback

Export the control points separately from the solved functions so the same
numbers can be emitted as a CSS cubic-bezier() string. JS and the compositor
must not drift apart.

Never default to linear. Reserve it for continuous carriers only - spinners,
seamless marquees - where any acceleration would stutter at the loop seam.`,
    code: `const NEWTON_ITERATIONS = 8;
const MIN_SLOPE = 1e-3;
const EPSILON = 1e-7;

function coefficients(p1: number, p2: number) {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  return { a: 1 - c - b, b, c };
}

const sample = (a: number, b: number, c: number, t: number) => ((a * t + b) * t + c) * t;
const slope  = (a: number, b: number, c: number, t: number) => (3 * a * t + 2 * b) * t + c;

/** Invert x(t). Newton where it converges, bisection where it would not. */
function solveForT(ax: number, bx: number, cx: number, x: number): number {
  let t = x;
  for (let i = 0; i < NEWTON_ITERATIONS; i++) {
    const s = slope(ax, bx, cx, t);
    if (Math.abs(s) < MIN_SLOPE) break;          // near-vertical: Newton diverges
    const error = sample(ax, bx, cx, t) - x;
    if (Math.abs(error) < EPSILON) return t;
    t -= error / s;
  }
  let low = 0, high = 1;
  t = Math.min(Math.max(x, 0), 1);
  for (let i = 0; i < 32; i++) {                 // bisection cannot diverge
    const error = sample(ax, bx, cx, t) - x;
    if (Math.abs(error) < EPSILON) return t;
    if (error > 0) high = t; else low = t;
    t = low + (high - low) / 2;
  }
  return t;
}

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  const cx1 = Math.min(Math.max(x1, 0), 1);      // x must stay monotonic to invert
  const cx2 = Math.min(Math.max(x2, 0), 1);
  if (cx1 === y1 && cx2 === y2) return (t) => t;

  const X = coefficients(cx1, cx2);
  const Y = coefficients(y1, y2);                // y stays free — overshoot allowed

  return (t) => (t <= 0 ? 0 : t >= 1 ? 1
    : sample(Y.a, Y.b, Y.c, solveForT(X.a, X.b, X.c, t)));
}`,
    notes: `<strong>Easing is y(x), but a bezier is parameterised by t.</strong> You cannot read the output directly — you have to invert x(t) first to find the parameter, then evaluate y at it. That inversion is the entire implementation, and the bisection fallback is what keeps it correct when the control handles go near-vertical and Newton-Raphson would fly off.
<ul>
<li><strong>anticipate</strong> dips below zero before departing — it telegraphs direction, and it is the one curve that reliably makes a movement feel intentional rather than triggered.</li>
<li><strong>overshoot</strong> exceeds 1 and returns. Cheap spring feel for motion nobody can interrupt.</li>
<li><strong>Control points ship separately</strong> from the solved functions, so the same four numbers can be handed to CSS. One source of truth.</li>
</ul>`,
    mount(stage) {
      const names = Object.keys(BezierCatalogue);

      stage.innerHTML = `<div class="d-ease-grid">${names
        .map((name) => {
          const p = BezierCatalogue[name];
          return `
          <div class="d-ease-cell">
            <div class="d-ease-name"><span>${name}</span><span>${p[1]}, ${p[3]}</span></div>
            <svg class="d-ease-plot" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path class="d-plot-curve" data-plot="${name}" vector-effect="non-scaling-stroke" d=""></path>
            </svg>
            <div class="d-ease-track"><div class="d-ease-ball" data-ball="${name}"></div></div>
          </div>`;
        })
        .join('')}</div>`;

      // Plot each curve once — the shape never changes.
      for (const name of names) {
        const easing = Easing[name];
        const path = stage.querySelector(`[data-plot="${name}"]`);
        const SAMPLES = 60;
        let d = '';
        for (let i = 0; i <= SAMPLES; i++) {
          const t = i / SAMPLES;
          const x = t * 100;
          // Leave headroom top and bottom so overshoot and anticipation stay visible.
          const y = 80 - easing(t) * 60;
          d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
        }
        path.setAttribute('d', d);
      }

      const balls = names.map((name) => ({
        easing: Easing[name],
        node: stage.querySelector(`[data-ball="${name}"]`),
      }));

      let cancel = null;
      let forward = true;

      const replay = () => {
        cancel?.();
        const travel = () => {
          const track = stage.querySelector('.d-ease-track');
          return track.clientWidth - 12 - 4;
        };
        const distance = travel();
        const from = forward ? 0 : 1;
        const to = forward ? 1 : 0;
        forward = !forward;

        cancel = animateValue({
          from: 0,
          to: 1,
          duration: 900,
          easing: Easing.linear, // carrier — each ball applies its own curve below
          onUpdate: (progress) => {
            for (const { easing, node } of balls) {
              const eased = easing(progress);
              const value = from + (to - from) * eased;
              node.style.transform = `translateX(${value * distance}px)`;
            }
          },
        });
      };

      const timer = setTimeout(replay, 300);

      return {
        replay,
        destroy() {
          clearTimeout(timer);
          cancel?.();
        },
      };
    },
  },

  {
    id: 'flick',
    title: 'Momentum projection',
    summary:
      'Release velocity is projected forward under exponential decay, and the puck snaps to whichever detent is nearest the projection — not nearest the finger. The dashed ghost marks where the throw was headed.',
    chips: ['velocity window', 'projection', 'snap'],
    hint: 'Drag and flick the puck',
    prompt: `Implement flick-to-snap with momentum projection.

Velocity sampling
- Do NOT compute velocity from the last two pointer events. Pointer deltas are
  noisy, and a single stationary frame right before release reads as zero
  velocity, which kills the throw entirely.
- Keep a ring buffer of {value, time} samples over a trailing ~100ms window.
  Velocity = (last.value - first.value) / (last.time - first.time) * 1000,
  in units per second.

Projection
- Under exponential deceleration with per-millisecond retention rate d, total
  remaining travel is v * d / (1 - d), with v in units per millisecond:
    projected = (velocity / 1000) * (d / (1 - d))
- d = 0.99 is a short toss (~10x velocity in seconds). d = 0.998 is full
  momentum scrolling (~50x). Pick per surface; a drawer is not a scroll view.
- Resting point = releaseOffset + projected.

Snapping
- Snap to the detent nearest the PROJECTION, not nearest the release point.
  This is the difference between a control that respects a throw and one that
  ignores it. A fast flick from just past detent 1 should land on detent 3.
- Hand the release velocity to the settling spring as v0 so the snap continues
  the throw instead of restarting from rest.

Gesture plumbing
- Pointer Events with setPointerCapture, so the drag survives the cursor
  leaving the element. Without capture the puck drops when you throw fast.
- touch-action: none on the draggable element or the browser steals the gesture.
- During drag, write position directly (the finger is the source of truth).
  Only hand control to the spring on release.`,
    code: `import { VelocityTracker, projectMomentum, nearestSnapPoint } from './motion-core';

const DETENTS = [0, 120, 240, 360];

function attachFlick(el: HTMLElement, spring: SpringValue) {
  const tracker = new VelocityTracker(100);   // trailing window, not last-two-events
  let origin = 0, base = 0;

  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);         // survives the cursor leaving
    origin = e.clientX;
    base = spring.get();
    tracker.reset();
    tracker.add(0, e.timeStamp);
    spring.stop();                             // finger takes over
  });

  el.addEventListener('pointermove', (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    const delta = e.clientX - origin;
    tracker.add(delta, e.timeStamp);
    spring.jump(base + delta);                 // direct write while dragging
  });

  el.addEventListener('pointerup', (e) => {
    const velocity = tracker.velocity();                  // units/second
    const projected = spring.get() + projectMomentum(velocity, 0.99);
    const target = nearestSnapPoint(projected, DETENTS);  // nearest the PROJECTION

    spring.stop();
    spring.setWithVelocity(target, velocity);  // carry the throw into the settle
  });
}

// projected travel under exponential decay: v * d / (1 - d)
export function projectMomentum(velocity: number, decelerationRate = 0.99) {
  return (velocity / 1000) * (decelerationRate / (1 - decelerationRate));
}`,
    notes: `<strong>Snap to the projection, not to the finger.</strong> This one decision separates controls that feel like they have mass from controls that feel like they ignore you. Flick hard from just past the first detent and the puck should sail to the third — because that is where the throw was going.
<ul>
<li><strong>The 100ms window matters.</strong> Sampling the last two events means one stationary frame before release reports zero velocity and eats the throw entirely.</li>
<li><strong>Pointer capture</strong> is not optional. Throw fast without it and the pointer leaves the element mid-gesture, the events stop, and the puck drops where it stood.</li>
<li><strong>Release velocity becomes the spring's v₀</strong>, so the snap is a continuation of the throw rather than a new animation that happens to start nearby.</li>
</ul>`,
    mount(stage) {
      stage.innerHTML = `
        <div class="d-stack" style="width:100%">
          <div class="d-flick-track">
            <div class="d-flick-ghost"></div>
            <div class="d-flick-puck">DRAG</div>
          </div>
          <div class="d-readout">
            velocity <b data-v>0</b> px/s · projected <b data-p>0</b>px · detent <b data-d>0</b>
          </div>
        </div>`;

      const track = stage.querySelector('.d-flick-track');
      const puck = stage.querySelector('.d-flick-puck');
      const ghost = stage.querySelector('.d-flick-ghost');
      const vOut = stage.querySelector('[data-v]');
      const pOut = stage.querySelector('[data-p]');
      const dOut = stage.querySelector('[data-d]');

      let detents = [];
      const measure = () => {
        const span = track.clientWidth - puck.offsetWidth - 16;
        detents = [0, 1, 2, 3].map((i) => 8 + (span * i) / 3);
        // Redraw detent guides.
        track.querySelectorAll('.d-flick-detent').forEach((n) => n.remove());
        for (const d of detents) {
          const line = document.createElement('div');
          line.className = 'd-flick-detent';
          line.style.left = `${d + puck.offsetWidth / 2}px`;
          track.insertBefore(line, ghost);
        }
      };

      const position = createSpringValue(8, {
        ...SpringPresets.gentle,
        onChange: (v) => {
          puck.style.transform = `translateX(${v}px)`;
        },
      });

      const observer = new ResizeObserver(() => {
        measure();
        position.jump(nearestSnapPoint(position.get(), detents));
      });
      observer.observe(track);
      measure();
      position.jump(detents[0]);

      let base = 0;

      const detach = createDragGesture(puck, {
        axis: 'x',
        onStart() {
          base = position.get();
          position.stop();
          ghost.style.opacity = '0';
        },
        onMove(delta) {
          const min = detents[0];
          const max = detents[detents.length - 1];
          const raw = base + delta;
          // Resistance past the ends, so the track edges read as real.
          const bounded =
            raw < min
              ? min + rubberBand(raw - min, 90)
              : raw > max
                ? max + rubberBand(raw - max, 90)
                : raw;
          position.jump(bounded);
        },
        onEnd(delta, velocity) {
          const projected = position.get() + projectMomentum(velocity, 0.99);
          const target = nearestSnapPoint(projected, detents);

          vOut.textContent = velocity.toFixed(0);
          pOut.textContent = projected.toFixed(0);
          dOut.textContent = String(detents.indexOf(target));

          // Show where the throw was actually headed.
          ghost.style.opacity = '0.9';
          ghost.style.transform = `translateX(${Math.max(
            -40,
            Math.min(track.clientWidth, projected),
          )}px)`;
          setTimeout(() => (ghost.style.opacity = '0'), 700);

          // Carry the release velocity into the settle.
          position.jump(position.get(), velocity);
          position.set(target);
        },
      });

      return {
        destroy() {
          detach();
          observer.disconnect();
          position.stop();
        },
      };
    },
  },

  {
    id: 'rubber-band',
    title: 'Rubber-band resistance',
    summary:
      'Past the boundary, travel becomes asymptotic — pull as hard as you like and the card approaches a ceiling it never crosses. That ceiling is what communicates "edge" without hard-stopping your finger.',
    chips: ['asymptotic', 'boundary', 'gentle return'],
    hint: 'Drag the card past either edge',
    prompt: `Implement rubber-band overscroll resistance for drag gestures.

Formula (the one iOS uses):
  f(x) = (1 - 1 / (x * c / d + 1)) * d
where x is raw overshoot distance past the boundary, d is the dimension governing
resistance (typically the container's size along the drag axis), and c ~ 0.55.

Properties that matter:
- f(0) = 0, and f is continuous at the boundary. No visible seam at the moment
  resistance engages.
- f'(0) = c, so the first pixels past the edge move at roughly 55% of finger
  speed - resistance is felt immediately, not after a dead zone.
- f is asymptotic to d. No matter how hard the user pulls, travel approaches d
  and never exceeds it. THIS is what makes the edge read as real. A linear
  divisor (x * 0.5) has no ceiling and just feels like sluggish dragging.

Application
- Only apply past the boundary. Inside bounds, track the finger 1:1 - any
  resistance in the valid range feels like input lag.
- Compute against RAW accumulated delta, not the already-resisted value.
  Feeding the output back in compounds the resistance and the element stalls.
- On release, spring back to the boundary with a gentle preset
  (stiffness 120 / damping 22, zeta ~ 1.0). Do not use a bouncy spring here;
  the rubber band already supplied the elasticity, and bouncing on top of it
  reads as a glitch.

Same function handles pull-to-refresh, sheet over-drag, and carousel ends.`,
    code: `/**
 * Asymptotic resistance past a boundary.
 *   f(x) = (1 - 1/(x·c/d + 1)) · d
 * f(0)=0, f'(0)=c, and f -> d as x -> infinity.
 */
export function rubberBand(offset: number, dimension: number, constant = 0.55) {
  if (offset === 0 || dimension <= 0) return 0;
  const sign = Math.sign(offset);
  const distance = Math.abs(offset);
  return sign * (1 - 1 / ((distance * constant) / dimension + 1)) * dimension;
}

function onDragMove(rawDelta: number) {
  const next = base + rawDelta;

  // Track 1:1 inside bounds; resist only past them. Always compute from the
  // RAW value — feeding the resisted value back in compounds the resistance.
  const bounded =
    next < MIN ? MIN + rubberBand(next - MIN, container.clientWidth)
  : next > MAX ? MAX + rubberBand(next - MAX, container.clientWidth)
  : next;

  position.jump(bounded);
}

function onDragEnd() {
  // The band already provided the elasticity — settle, do not bounce.
  position.set(clamp(position.get(), MIN, MAX));   // gentle: stiffness 120, damping 22
}`,
    notes: `<strong>The asymptote is the message.</strong> Linear resistance (<code>x * 0.5</code>) just feels like a laggy drag — there is no ceiling, so nothing tells you an edge exists. The hyperbolic form approaches <code>d</code> and never passes it, so pulling harder returns visibly less, and your hand learns where the boundary is without ever being stopped.
<ul>
<li><strong>f′(0) = c ≈ 0.55</strong> — resistance engages on the very first pixel past the edge. No dead zone, no seam.</li>
<li><strong>Always compute from the raw delta.</strong> Passing the already-resisted value back through compounds it and the element grinds to a halt.</li>
<li><strong>Settle, don't bounce.</strong> A bouncy return spring on top of rubber-band elasticity reads as a bug — the band was already the spring.</li>
</ul>`,
    mount(stage) {
      stage.innerHTML = `
        <div class="d-stack" style="width:100%">
          <div class="d-rb-track">
            <div class="d-rb-bound" style="left:16px"></div>
            <div class="d-rb-bound" data-max></div>
            <div class="d-rb-card"></div>
          </div>
          <div class="d-readout">
            raw <b data-raw>0</b>px · resisted <b data-res>0</b>px · returning <b data-ret>0.55</b>
          </div>
        </div>`;

      const track = stage.querySelector('.d-rb-track');
      const card = stage.querySelector('.d-rb-card');
      const maxBound = stage.querySelector('[data-max]');
      const rawOut = stage.querySelector('[data-raw]');
      const resOut = stage.querySelector('[data-res]');
      const retOut = stage.querySelector('[data-ret]');

      let MIN = 0;
      let MAX = 0;
      const measure = () => {
        MIN = 0;
        MAX = track.clientWidth - card.offsetWidth - 32;
        maxBound.style.left = `${16 + MAX + card.offsetWidth}px`;
      };

      const position = createSpringValue(0, {
        ...SpringPresets.gentle,
        onChange: (v) => {
          card.style.transform = `translateX(${v}px)`;
        },
      });

      const observer = new ResizeObserver(measure);
      observer.observe(track);
      measure();

      let base = 0;

      const detach = createDragGesture(card, {
        axis: 'x',
        onStart() {
          base = position.get();
          position.stop();
        },
        onMove(delta) {
          const raw = base + delta;
          const dimension = track.clientWidth;

          // Resist only past the bounds; always measure from the raw value.
          const bounded =
            raw < MIN
              ? MIN + rubberBand(raw - MIN, dimension)
              : raw > MAX
                ? MAX + rubberBand(raw - MAX, dimension)
                : raw;

          position.jump(bounded);

          const overshoot = raw < MIN ? raw - MIN : raw > MAX ? raw - MAX : 0;
          const resisted = bounded < MIN ? bounded - MIN : bounded > MAX ? bounded - MAX : 0;
          rawOut.textContent = overshoot.toFixed(0);
          resOut.textContent = resisted.toFixed(0);
          retOut.textContent = overshoot === 0 ? '1.00' : (resisted / overshoot).toFixed(2);
        },
        onEnd() {
          position.set(Math.max(MIN, Math.min(MAX, position.get())));
        },
      });

      return {
        destroy() {
          detach();
          observer.disconnect();
          position.stop();
        },
      };
    },
  },
];
