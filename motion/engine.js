/**
 * engine.js — the motion core that drives every live demo on this page.
 *
 * Zero dependencies, plain ES modules, no build step. The React port in
 * ../react/motion-core.ts is the same math with types attached.
 *
 * Two ideas carry the whole system:
 *
 *   1. Springs are solved in closed form, not integrated step by step. Position
 *      is a pure function of elapsed time, so a dropped frame can never cause
 *      drift and an interrupted animation can hand its exact velocity to its
 *      replacement.
 *   2. Nothing is linear. Every curve here has weight.
 */

/* ────────────────────────────────────────────────────────────
   Shared frame clock
   One rAF loop for the whole page. Dozens of independent loops
   is the single easiest way to make a demo page stutter.
   ──────────────────────────────────────────────────────────── */

const frameSubscribers = new Set();
let frameHandle = null;

function runFrame(now) {
  frameHandle = requestAnimationFrame(runFrame);
  // Copy first: a subscriber may unsubscribe itself while resting.
  for (const fn of [...frameSubscribers]) fn(now);
}

/** Subscribe to the shared clock. Returns an unsubscribe function. */
export function onFrame(fn) {
  frameSubscribers.add(fn);
  if (frameHandle === null) frameHandle = requestAnimationFrame(runFrame);
  return () => {
    frameSubscribers.delete(fn);
    if (frameSubscribers.size === 0 && frameHandle !== null) {
      cancelAnimationFrame(frameHandle);
      frameHandle = null;
    }
  };
}

/* ────────────────────────────────────────────────────────────
   Utilities
   ──────────────────────────────────────────────────────────── */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Map a value from one range to another, with clamping on both ends. */
export function interpolate(value, [inMin, inMax], [outMin, outMax], easing) {
  if (inMax === inMin) return outMin;
  const raw = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return lerp(outMin, outMax, easing ? easing(raw) : raw);
}

/** True when the user has asked the system to reduce motion. */
export function prefersReducedMotion() {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Subscribe to reduced-motion changes. Returns an unsubscribe function. */
export function onReducedMotionChange(fn) {
  if (typeof matchMedia !== 'function') return () => {};
  const query = matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (event) => fn(event.matches);
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}

/* ────────────────────────────────────────────────────────────
   Easing — cubic-bezier solved the way CSS defines it
   ──────────────────────────────────────────────────────────── */

const NEWTON_ITERATIONS = 8;
const NEWTON_MIN_SLOPE = 1e-3;
const EPSILON = 1e-7;
const BISECTION_ITERATIONS = 32;

function bezierCoefficients(p1, p2) {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  const a = 1 - c - b;
  return { a, b, c };
}

const sampleCurve = (a, b, c, t) => ((a * t + b) * t + c) * t;
const sampleSlope = (a, b, c, t) => (3 * a * t + 2 * b) * t + c;

/**
 * Invert x(t) to find the bezier parameter for a given progress value.
 * Newton-Raphson where the curve is well conditioned, bisection where the
 * slope collapses and Newton would diverge.
 */
function solveForT(ax, bx, cx, x) {
  let t = x;

  for (let i = 0; i < NEWTON_ITERATIONS; i++) {
    const slope = sampleSlope(ax, bx, cx, t);
    if (Math.abs(slope) < NEWTON_MIN_SLOPE) break;
    const error = sampleCurve(ax, bx, cx, t) - x;
    if (Math.abs(error) < EPSILON) return t;
    t -= error / slope;
  }

  let low = 0;
  let high = 1;
  t = clamp(x, 0, 1);

  for (let i = 0; i < BISECTION_ITERATIONS; i++) {
    const error = sampleCurve(ax, bx, cx, t) - x;
    if (Math.abs(error) < EPSILON) return t;
    if (error > 0) high = t;
    else low = t;
    t = low + (high - low) / 2;
  }

  return t;
}

/** Build an easing function from CSS-compatible cubic-bezier control points. */
export function cubicBezier(x1, y1, x2, y2) {
  const cx1 = clamp(x1, 0, 1);
  const cx2 = clamp(x2, 0, 1);
  if (cx1 === y1 && cx2 === y2) return (t) => t;

  const { a: ax, b: bx, c: cx } = bezierCoefficients(cx1, cx2);
  const { a: ay, b: by, c: cy } = bezierCoefficients(y1, y2);

  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleCurve(ay, by, cy, solveForT(ax, bx, cx, t));
  };
}

/** Control points, kept separate so CSS and JS can share one source of truth. */
export const BezierCatalogue = {
  standard: [0.4, 0.0, 0.2, 1.0],
  decelerate: [0.0, 0.0, 0.2, 1.0],
  accelerate: [0.4, 0.0, 1.0, 1.0],
  emphasized: [0.2, 0.0, 0.0, 1.0],
  anticipate: [0.6, -0.28, 0.735, 0.045],
  overshoot: [0.34, 1.56, 0.64, 1.0],
  sharp: [0.4, 0.0, 0.6, 1.0],
};

export const cssEasing = (name) => `cubic-bezier(${BezierCatalogue[name].join(', ')})`;

/** Normalised exponential decay: f(0)=0, f(1)=1. */
export function exponentialDecay(lambda = 5) {
  const normaliser = 1 - Math.exp(-lambda);
  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : (1 - Math.exp(-lambda * t)) / normaliser);
}

export const Easing = Object.fromEntries(
  Object.entries(BezierCatalogue).map(([name, p]) => [name, cubicBezier(...p)]),
);
Easing.exponential = exponentialDecay(5);
/** Identity. Only for continuous carriers — spinners, seamless marquees. */
Easing.linear = (t) => t;

/* ────────────────────────────────────────────────────────────
   Spring — closed-form damped harmonic oscillator
   m·x″ + c·x′ + k·x = 0
   ──────────────────────────────────────────────────────────── */

export const SpringPresets = {
  /** No overshoot, soft arrival. Safe for anything affecting layout. */
  gentle: { mass: 1, stiffness: 120, damping: 22 },
  /** Fast, barely-there overshoot. Default for direct-manipulation feedback. */
  snappy: { mass: 1, stiffness: 260, damping: 26 },
  /** Critically damped — fastest possible approach with zero overshoot. */
  precise: { mass: 1, stiffness: 300, damping: 34.641 },
  /** Pronounced, playful overshoot. Never on text. */
  bouncy: { mass: 1, stiffness: 180, damping: 12 },
  /** Heavy and deliberate. For large surfaces where mass should read. */
  molasses: { mass: 3, stiffness: 120, damping: 50 },
};

const DEFAULT_SPRING = SpringPresets.snappy;
const REST_DISPLACEMENT = 0.01;
const REST_VELOCITY = 0.05;

export const dampingRatio = ({ mass, stiffness, damping }) =>
  damping / (2 * Math.sqrt(stiffness * mass));

export const naturalFrequency = ({ mass, stiffness }) => Math.sqrt(stiffness / mass);

/**
 * Evaluate a spring at an absolute time offset, in **seconds** since it started.
 *
 * Closed form, so callers may evaluate out of order, skip ahead, or re-evaluate
 * the same instant with identical results.
 */
export function springAt(time, options = {}) {
  const mass = options.mass ?? DEFAULT_SPRING.mass;
  const stiffness = options.stiffness ?? DEFAULT_SPRING.stiffness;
  const damping = options.damping ?? DEFAULT_SPRING.damping;
  const from = options.from ?? 0;
  const to = options.to ?? 1;
  const v0 = options.velocity ?? 0;
  const restDisplacement = options.restDisplacement ?? REST_DISPLACEMENT;
  const restVelocity = options.restVelocity ?? REST_VELOCITY;

  const t = Math.max(0, time);
  const omega = naturalFrequency({ mass, stiffness });
  const zeta = dampingRatio({ mass, stiffness, damping });

  // Solve in displacement-from-target space.
  const u0 = from - to;
  let u;
  let du;

  if (zeta < 1) {
    // Underdamped — decaying sinusoid.
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * omega * t);
    const A = u0;
    const B = (v0 + zeta * omega * u0) / omegaD;
    const cos = Math.cos(omegaD * t);
    const sin = Math.sin(omegaD * t);
    u = envelope * (A * cos + B * sin);
    du = envelope * (-zeta * omega * (A * cos + B * sin) + omegaD * (B * cos - A * sin));
  } else if (zeta === 1) {
    // Critically damped — repeated root, linear term in t.
    const envelope = Math.exp(-omega * t);
    const A = u0;
    const B = v0 + omega * u0;
    u = envelope * (A + B * t);
    du = envelope * (B - omega * (A + B * t));
  } else {
    // Overdamped — two real roots, no oscillation.
    const rad = omega * Math.sqrt(zeta * zeta - 1);
    const r1 = -zeta * omega + rad;
    const r2 = -zeta * omega - rad;
    const c1 = (v0 - u0 * r2) / (r1 - r2);
    const c2 = u0 - c1;
    const e1 = Math.exp(r1 * t);
    const e2 = Math.exp(r2 * t);
    u = c1 * e1 + c2 * e2;
    du = c1 * r1 * e1 + c2 * r2 * e2;
  }

  const isResting = Math.abs(u) < restDisplacement && Math.abs(du) < restVelocity;

  return isResting
    ? { value: to, velocity: 0, isResting: true }
    : { value: to + u, velocity: du, isResting: false };
}

/**
 * Seconds for a spring to settle inside its rest thresholds. Derived from the
 * exponential envelope rather than simulated — use it to size sequences and
 * schedule follow-on stagger steps without guessing.
 */
export function springSettlingTime(options = {}) {
  const mass = options.mass ?? DEFAULT_SPRING.mass;
  const stiffness = options.stiffness ?? DEFAULT_SPRING.stiffness;
  const damping = options.damping ?? DEFAULT_SPRING.damping;
  const from = options.from ?? 0;
  const to = options.to ?? 1;
  const v0 = options.velocity ?? 0;
  const restDisplacement = options.restDisplacement ?? REST_DISPLACEMENT;

  const u0 = from - to;
  if (u0 === 0 && v0 === 0) return 0;

  const omega = naturalFrequency({ mass, stiffness });
  const zeta = dampingRatio({ mass, stiffness, damping });
  if (zeta === 0) return Infinity;

  const amplitude =
    zeta < 1
      ? Math.hypot(u0, (v0 + zeta * omega * u0) / (omega * Math.sqrt(1 - zeta * zeta)))
      : Math.max(Math.abs(u0), Math.abs(v0) / omega, restDisplacement);

  if (amplitude <= restDisplacement) return 0;

  const decayRate = zeta < 1 ? zeta * omega : omega * (zeta - Math.sqrt(zeta * zeta - 1));
  return Math.log(amplitude / restDisplacement) / decayRate;
}

/**
 * Build a spring from perceptual parameters instead of physical ones.
 *
 * @param {number} duration Approximate settling time in seconds.
 * @param {number} bounce   0 = critically damped, 0.3 = lively, negative = sluggish.
 */
export function springFromDurationAndBounce(duration, bounce = 0) {
  const omega = (2 * Math.PI) / duration;
  const zeta = 1 - bounce;
  return { mass: 1, stiffness: omega * omega, damping: 2 * zeta * omega };
}

/* ────────────────────────────────────────────────────────────
   Spring value — an interruptible, velocity-carrying scalar
   ──────────────────────────────────────────────────────────── */

/**
 * A scalar driven by a spring. Retargeting mid-flight hands the *current*
 * velocity to the new solve, so a redirected animation continues its arc
 * instead of restarting from zero. That continuity is the whole difference
 * between motion that feels physical and motion that feels scripted.
 *
 * @returns {{
 *   get: () => number,
 *   getVelocity: () => number,
 *   set: (target: number) => void,
 *   jump: (value: number) => void,
 *   nudge: (velocity: number) => void,
 *   isResting: () => boolean,
 *   stop: () => void,
 * }}
 */
export function createSpringValue(initial, options = {}) {
  const { onChange, onRest, ...config } = options;

  let current = initial;
  let velocity = 0;
  let target = initial;
  let startValue = initial;
  let startVelocity = 0;
  let startTime = 0;
  let unsubscribe = null;

  const emit = () => onChange?.(current, velocity);

  function stop() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  function tick(now) {
    const elapsed = (now - startTime) / 1000;
    const state = springAt(elapsed, {
      ...config,
      from: startValue,
      to: target,
      velocity: startVelocity,
    });

    current = state.value;
    velocity = state.velocity;
    emit();

    if (state.isResting) {
      stop();
      onRest?.(current);
    }
  }

  function start() {
    startValue = current;
    startVelocity = velocity;
    startTime = performance.now();
    if (!unsubscribe) unsubscribe = onFrame(tick);
  }

  return {
    get: () => current,
    getVelocity: () => velocity,
    isResting: () => unsubscribe === null,

    /** Retarget. Carries current velocity into the new solve. */
    set(next) {
      if (next === target && unsubscribe) return;
      target = next;
      if (prefersReducedMotion()) {
        stop();
        current = next;
        velocity = 0;
        emit();
        onRest?.(current);
        return;
      }
      start();
    },

    /** Snap without animating — for drag frames, where the finger is the source of truth. */
    jump(value, nextVelocity = 0) {
      stop();
      current = value;
      target = value;
      velocity = nextVelocity;
      emit();
    },

    /** Inject velocity without changing the target — a flick, a bump, a throw. */
    nudge(addedVelocity) {
      velocity += addedVelocity;
      if (prefersReducedMotion()) return;
      start();
    },

    stop,
  };
}

/* ────────────────────────────────────────────────────────────
   Duration-based driver — for value changes with no physics
   ──────────────────────────────────────────────────────────── */

/**
 * Animate a scalar over a fixed duration. Use for counters and progress, where
 * a predictable arrival time matters more than interruption behaviour.
 * Returns a cancel function.
 */
export function animateValue({ from, to, duration = 400, easing = Easing.standard, onUpdate, onComplete }) {
  if (prefersReducedMotion() || duration <= 0) {
    onUpdate(to, 1);
    onComplete?.();
    return () => {};
  }

  const startTime = performance.now();
  let stopped = false;

  const unsubscribe = onFrame((now) => {
    if (stopped) return;
    const progress = clamp((now - startTime) / duration, 0, 1);
    onUpdate(lerp(from, to, easing(progress)), progress);
    if (progress >= 1) {
      stopped = true;
      unsubscribe();
      onComplete?.();
    }
  });

  return () => {
    if (stopped) return;
    stopped = true;
    unsubscribe();
  };
}

/* ────────────────────────────────────────────────────────────
   Gesture physics — push and pull
   ──────────────────────────────────────────────────────────── */

/**
 * Tracks pointer velocity over a trailing time window.
 *
 * Sampling only the last two events is the common mistake: pointer deltas are
 * noisy, and a single stationary frame right before release reads as zero
 * velocity, killing the throw. A ~100ms window smooths that out.
 */
export class VelocityTracker {
  constructor(windowMs = 100) {
    this.windowMs = windowMs;
    this.samples = [];
  }

  add(value, time = performance.now()) {
    this.samples.push({ value, time });
    const cutoff = time - this.windowMs;
    while (this.samples.length > 2 && this.samples[0].time < cutoff) this.samples.shift();
  }

  /** Velocity in units per second. */
  velocity() {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dt = last.time - first.time;
    if (dt <= 0) return 0;
    return ((last.value - first.value) / dt) * 1000;
  }

  reset() {
    this.samples.length = 0;
  }
}

/**
 * Rubber-band resistance past a boundary.
 *
 * Asymptotic: no matter how hard the user pulls, travel approaches `dimension`
 * and never exceeds it. That ceiling is what communicates "this edge is real"
 * without hard-stopping the finger.
 *
 *   f(x) = (1 − 1/(x·c/d + 1)) · d
 */
export function rubberBand(offset, dimension, constant = 0.55) {
  if (offset === 0 || dimension <= 0) return 0;
  const sign = Math.sign(offset);
  const distance = Math.abs(offset);
  return sign * (1 - 1 / ((distance * constant) / dimension + 1)) * dimension;
}

/**
 * Where a flick would come to rest under exponential deceleration.
 *
 * With a per-millisecond retention rate `d`, total remaining travel is
 * v·d/(1−d). Project the release point through this, then snap to whichever
 * detent is nearest the *projection* — not nearest the finger. Snapping to the
 * finger ignores the throw and feels broken.
 *
 * @param {number} velocity Units per second.
 * @param {number} decelerationRate Per-ms retention. 0.99 ≈ a short toss,
 *                                  0.998 ≈ full momentum scrolling.
 */
export function projectMomentum(velocity, decelerationRate = 0.99) {
  return (velocity / 1000) * (decelerationRate / (1 - decelerationRate));
}

/** Nearest value in `points` to `value`. */
export function nearestSnapPoint(value, points) {
  let best = points[0];
  let bestDistance = Math.abs(value - best);
  for (const point of points) {
    const distance = Math.abs(value - point);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Attach a drag gesture to an element using Pointer Events.
 *
 * Pointer capture means the drag survives the cursor leaving the element, which
 * is the difference between a sheet you can throw and a sheet that drops out
 * from under you halfway.
 *
 * @returns {() => void} detach
 */
export function createDragGesture(element, { axis = 'y', onStart, onMove, onEnd } = {}) {
  const tracker = new VelocityTracker();
  let pointerId = null;
  let origin = 0;

  const coordinate = (event) => (axis === 'y' ? event.clientY : event.clientX);

  function handleDown(event) {
    if (pointerId !== null || event.button !== 0) return;
    pointerId = event.pointerId;
    origin = coordinate(event);
    tracker.reset();
    tracker.add(0, event.timeStamp);
    element.setPointerCapture(pointerId);
    onStart?.();
  }

  function handleMove(event) {
    if (event.pointerId !== pointerId) return;
    const delta = coordinate(event) - origin;
    tracker.add(delta, event.timeStamp);
    onMove?.(delta);
  }

  function handleUp(event) {
    if (event.pointerId !== pointerId) return;
    const delta = coordinate(event) - origin;
    const velocity = tracker.velocity();
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    pointerId = null;
    onEnd?.(delta, velocity);
  }

  element.addEventListener('pointerdown', handleDown);
  element.addEventListener('pointermove', handleMove);
  element.addEventListener('pointerup', handleUp);
  element.addEventListener('pointercancel', handleUp);

  return () => {
    element.removeEventListener('pointerdown', handleDown);
    element.removeEventListener('pointermove', handleMove);
    element.removeEventListener('pointerup', handleUp);
    element.removeEventListener('pointercancel', handleUp);
  };
}

/* ────────────────────────────────────────────────────────────
   Stagger — offset and delay
   ──────────────────────────────────────────────────────────── */

/**
 * Delay in milliseconds for item `index` of `count`.
 *
 * `from` sets the origin the wave travels out from. `maxTotal` caps the tail so
 * a long list does not turn a 40ms offset into a three-second wait — past the
 * cap the offset compresses instead of the sequence growing.
 */
export function stagger(index, count, { each = 40, from = 'first', maxTotal = 500 } = {}) {
  if (count <= 1) return 0;

  let distance;
  switch (from) {
    case 'last':
      distance = count - 1 - index;
      break;
    case 'center':
      distance = Math.abs(index - (count - 1) / 2);
      break;
    case 'edges':
      distance = (count - 1) / 2 - Math.abs(index - (count - 1) / 2);
      break;
    default:
      distance = typeof from === 'number' ? Math.abs(index - from) : index;
  }

  const maxDistance = from === 'center' || from === 'edges' ? (count - 1) / 2 : count - 1;
  const effectiveEach = Math.min(each, maxTotal / Math.max(maxDistance, 1));
  return distance * effectiveEach;
}

/** Grid-aware stagger — a wave travelling across a dashboard of tiles. */
export function staggerGrid(index, columns, count, { each = 40, origin = 'top-left' } = {}) {
  const rows = Math.ceil(count / columns);
  const row = Math.floor(index / columns);
  const column = index % columns;

  let distance;
  switch (origin) {
    case 'center': {
      const cy = (rows - 1) / 2;
      const cx = (columns - 1) / 2;
      distance = Math.hypot(row - cy, column - cx);
      break;
    }
    case 'top-right':
      distance = row + (columns - 1 - column);
      break;
    default:
      distance = row + column;
  }

  return distance * each;
}
