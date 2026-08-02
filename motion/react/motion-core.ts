/**
 * motion-core.ts — framework-agnostic motion math.
 *
 * The TypeScript twin of ../engine.js. Copy this file and hooks.ts into a
 * project and every code sample in the catalogue compiles as written.
 *
 * Zero dependencies. Nothing here touches React or the DOM except the shared
 * frame clock and the reduced-motion query.
 */

/* ────────────────────────────────────────────────────────────
   Shared frame clock
   ──────────────────────────────────────────────────────────── */

type FrameCallback = (now: number) => void;

const frameSubscribers = new Set<FrameCallback>();
let frameHandle: number | null = null;

function runFrame(now: number): void {
  frameHandle = requestAnimationFrame(runFrame);
  // Copy first: a subscriber may unsubscribe itself while resting.
  for (const fn of [...frameSubscribers]) fn(now);
}

/**
 * Subscribe to the shared clock. Returns an unsubscribe function.
 *
 * One rAF loop for the whole app. N independent loops is the easiest way to
 * make a page judder under load.
 */
export function onFrame(fn: FrameCallback): () => void {
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

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Map a value from one range to another, clamped at both ends. */
export function interpolate(
  value: number,
  [inMin, inMax]: readonly [number, number],
  [outMin, outMax]: readonly [number, number],
  easing?: EasingFunction,
): number {
  if (inMax === inMin) return outMin;
  const raw = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return lerp(outMin, outMax, easing ? easing(raw) : raw);
}

/** True when the user has asked the system to reduce motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Subscribe to reduced-motion changes. Returns an unsubscribe function. */
export function onReducedMotionChange(fn: (reduced: boolean) => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const query = matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (event: MediaQueryListEvent) => fn(event.matches);
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}

/* ────────────────────────────────────────────────────────────
   Easing — cubic-bezier solved the way CSS defines it
   ──────────────────────────────────────────────────────────── */

export type EasingFunction = (t: number) => number;

const NEWTON_ITERATIONS = 8;
const NEWTON_MIN_SLOPE = 1e-3;
const EPSILON = 1e-7;
const BISECTION_ITERATIONS = 32;

function bezierCoefficients(p1: number, p2: number): { a: number; b: number; c: number } {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  return { a: 1 - c - b, b, c };
}

const sampleCurve = (a: number, b: number, c: number, t: number): number =>
  ((a * t + b) * t + c) * t;

const sampleSlope = (a: number, b: number, c: number, t: number): number =>
  (3 * a * t + 2 * b) * t + c;

/**
 * Invert x(t) to recover the bezier parameter for a progress value.
 *
 * Newton-Raphson where the curve is well conditioned; bisection where the slope
 * collapses and Newton would diverge. Skipping the fallback is what makes
 * hand-rolled solvers wrong at near-vertical control handles.
 */
function solveForT(ax: number, bx: number, cx: number, x: number): number {
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
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  // x must stay monotonic to be invertible; y stays free so overshoot works.
  const cx1 = clamp(x1, 0, 1);
  const cx2 = clamp(x2, 0, 1);
  if (cx1 === y1 && cx2 === y2) return (t) => t;

  const X = bezierCoefficients(cx1, cx2);
  const Y = bezierCoefficients(y1, y2);

  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleCurve(Y.a, Y.b, Y.c, solveForT(X.a, X.b, X.c, t));
  };
}

/** Control points, kept separate so CSS and JS share one source of truth. */
export const BezierCatalogue = {
  /** Symmetric in-out. Layout-safe default. */
  standard: [0.4, 0.0, 0.2, 1.0],
  /** Entrances — arriving from off-screen or from nothing. */
  decelerate: [0.0, 0.0, 0.2, 1.0],
  /** Exits — leaving permanently. Fast tail, no lingering. */
  accelerate: [0.4, 0.0, 1.0, 1.0],
  /** Hero moments and long travel. */
  emphasized: [0.2, 0.0, 0.0, 1.0],
  /** Pulls back before committing — telegraphs direction. */
  anticipate: [0.6, -0.28, 0.735, 0.045],
  /** Passes the target and returns. Cheap spring for non-interruptible UI. */
  overshoot: [0.34, 1.56, 0.64, 1.0],
  /** Dense, high-frequency feedback — toggles, checkboxes. */
  sharp: [0.4, 0.0, 0.6, 1.0],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type BezierCurveName = keyof typeof BezierCatalogue;

/** Emit the CSS `cubic-bezier(...)` string for a named curve. */
export const cssEasing = (name: BezierCurveName): string =>
  `cubic-bezier(${BezierCatalogue[name].join(', ')})`;

/** Normalised exponential decay: f(0)=0, f(1)=1. */
export function exponentialDecay(lambda = 5): EasingFunction {
  if (lambda <= 0) throw new RangeError(`exponentialDecay: lambda must be > 0, got ${lambda}`);
  const normaliser = 1 - Math.exp(-lambda);
  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : (1 - Math.exp(-lambda * t)) / normaliser);
}

function fromCatalogue(name: BezierCurveName): EasingFunction {
  const [x1, y1, x2, y2] = BezierCatalogue[name];
  return cubicBezier(x1, y1, x2, y2);
}

export const Easing = {
  standard: fromCatalogue('standard'),
  decelerate: fromCatalogue('decelerate'),
  accelerate: fromCatalogue('accelerate'),
  emphasized: fromCatalogue('emphasized'),
  anticipate: fromCatalogue('anticipate'),
  overshoot: fromCatalogue('overshoot'),
  sharp: fromCatalogue('sharp'),
  exponential: exponentialDecay(5),
  /**
   * Identity. Not a UI curve — reserve it for continuous carriers such as a
   * spinner or a seamless marquee, where any acceleration would stutter at the
   * loop seam.
   */
  linear: ((t: number) => t) as EasingFunction,
} as const;

/* ────────────────────────────────────────────────────────────
   Spring — closed-form damped harmonic oscillator
   m·x″ + c·x′ + k·x = 0
   ──────────────────────────────────────────────────────────── */

export interface SpringConfig {
  /** Inertia. Higher mass overshoots further and settles slower. */
  readonly mass: number;
  /** Restoring force per unit displacement. Higher is faster and tighter. */
  readonly stiffness: number;
  /** Velocity-proportional resistance. Sets how much overshoot survives. */
  readonly damping: number;
}

export interface SpringOptions extends Partial<SpringConfig> {
  readonly from?: number;
  readonly to?: number;
  /** Units per second. Pass the previous velocity to interrupt gracefully. */
  readonly velocity?: number;
  readonly restDisplacement?: number;
  readonly restVelocity?: number;
}

export interface SpringState {
  readonly value: number;
  readonly velocity: number;
  readonly isResting: boolean;
}

/** Presets named for felt behaviour, not for their parameters. */
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
} as const satisfies Record<string, SpringConfig>;

export type SpringPresetName = keyof typeof SpringPresets;

const DEFAULT_SPRING: SpringConfig = SpringPresets.snappy;
const REST_DISPLACEMENT = 0.01;
const REST_VELOCITY = 0.05;

/** Damping ratio ζ. < 1 underdamped, = 1 critical, > 1 overdamped. */
export const dampingRatio = ({ mass, stiffness, damping }: SpringConfig): number =>
  damping / (2 * Math.sqrt(stiffness * mass));

/** Undamped natural frequency ωₙ, radians per second. */
export const naturalFrequency = ({ mass, stiffness }: SpringConfig): number =>
  Math.sqrt(stiffness / mass);

function resolveConfig(options: SpringOptions): SpringConfig {
  const config: SpringConfig = {
    mass: options.mass ?? DEFAULT_SPRING.mass,
    stiffness: options.stiffness ?? DEFAULT_SPRING.stiffness,
    damping: options.damping ?? DEFAULT_SPRING.damping,
  };
  if (config.mass <= 0) throw new RangeError(`spring: mass must be > 0, got ${config.mass}`);
  if (config.stiffness <= 0) {
    throw new RangeError(`spring: stiffness must be > 0, got ${config.stiffness}`);
  }
  if (config.damping < 0) {
    throw new RangeError(`spring: damping must be >= 0, got ${config.damping}`);
  }
  return config;
}

/**
 * Evaluate a spring at an absolute time offset, in **seconds** since it started.
 *
 * Closed form rather than integrated, which buys three things: a dropped frame
 * cannot cause drift, retargeting mid-flight is exact, and the same function
 * serves a real-time loop and a deterministic frame renderer unchanged.
 */
export function springAt(time: number, options: SpringOptions = {}): SpringState {
  const config = resolveConfig(options);
  const from = options.from ?? 0;
  const to = options.to ?? 1;
  const v0 = options.velocity ?? 0;
  const restDisplacement = options.restDisplacement ?? REST_DISPLACEMENT;
  const restVelocity = options.restVelocity ?? REST_VELOCITY;

  const t = Math.max(0, time);
  const omega = naturalFrequency(config);
  const zeta = dampingRatio(config);

  // Solve in displacement-from-target space.
  const u0 = from - to;
  let u: number;
  let du: number;

  if (zeta < 1) {
    // Underdamped — decaying sinusoid, overshoots and rings.
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
    // Overdamped — two real roots, never crosses the target.
    const rad = omega * Math.sqrt(zeta * zeta - 1);
    const r1 = -zeta * omega + rad;
    const r2 = -zeta * omega - rad;
    const C1 = (v0 - u0 * r2) / (r1 - r2);
    const C2 = u0 - C1;
    const e1 = Math.exp(r1 * t);
    const e2 = Math.exp(r2 * t);
    u = C1 * e1 + C2 * e2;
    du = C1 * r1 * e1 + C2 * r2 * e2;
  }

  // Snap on rest so the value never asymptotes at 0.9999.
  const isResting = Math.abs(u) < restDisplacement && Math.abs(du) < restVelocity;

  return isResting
    ? { value: to, velocity: 0, isResting: true }
    : { value: to + u, velocity: du, isResting: false };
}

/**
 * Seconds for a spring to settle inside its rest thresholds.
 *
 * Derived from the exponential envelope rather than simulated, so you can size
 * a sequence before running it.
 */
export function springSettlingTime(options: SpringOptions = {}): number {
  const config = resolveConfig(options);
  const from = options.from ?? 0;
  const to = options.to ?? 1;
  const v0 = options.velocity ?? 0;
  const restDisplacement = options.restDisplacement ?? REST_DISPLACEMENT;

  const u0 = from - to;
  if (u0 === 0 && v0 === 0) return 0;

  const omega = naturalFrequency(config);
  const zeta = dampingRatio(config);
  if (zeta === 0) return Number.POSITIVE_INFINITY;

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
 * @param duration Approximate settling time in seconds.
 * @param bounce   0 = critically damped, 0.3 = lively, negative = sluggish.
 */
export function springFromDurationAndBounce(duration: number, bounce = 0): SpringConfig {
  if (duration <= 0) {
    throw new RangeError(`springFromDurationAndBounce: duration must be > 0, got ${duration}`);
  }
  if (bounce >= 1 || bounce <= -1) {
    throw new RangeError(`springFromDurationAndBounce: bounce must be in (-1, 1), got ${bounce}`);
  }
  const omega = (2 * Math.PI) / duration;
  const zeta = 1 - bounce;
  return { mass: 1, stiffness: omega * omega, damping: 2 * zeta * omega };
}

/* ────────────────────────────────────────────────────────────
   Spring value — interruptible, velocity-carrying scalar
   ──────────────────────────────────────────────────────────── */

export interface SpringValue {
  get(): number;
  getVelocity(): number;
  isResting(): boolean;
  /** Retarget, carrying the current velocity into the new solve. */
  set(target: number): void;
  /** Retarget with an explicit release velocity — for gesture handoff. */
  setWithVelocity(target: number, velocity: number): void;
  /** Snap without animating. Use while a finger is driving the value. */
  jump(value: number, velocity?: number): void;
  /** Inject velocity without changing the target — a flick or a bump. */
  nudge(velocity: number): void;
  stop(): void;
}

export interface SpringValueOptions extends Partial<SpringConfig> {
  onChange?: (value: number, velocity: number) => void;
  onRest?: (value: number) => void;
}

/**
 * A scalar driven by a spring.
 *
 * Retargeting mid-flight hands the current velocity to the new solve, so a
 * redirected animation continues its arc instead of restarting from rest. That
 * continuity is the difference between motion that feels physical and motion
 * that feels scripted.
 */
export function createSpringValue(initial: number, options: SpringValueOptions = {}): SpringValue {
  const { onChange, onRest, ...config } = options;

  let current = initial;
  let velocity = 0;
  let target = initial;
  let startValue = initial;
  let startVelocity = 0;
  let startTime = 0;
  let unsubscribe: (() => void) | null = null;

  const emit = () => onChange?.(current, velocity);

  function stop(): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  function tick(now: number): void {
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

  function start(): void {
    startValue = current;
    startVelocity = velocity;
    startTime = performance.now();
    if (!unsubscribe) unsubscribe = onFrame(tick);
  }

  function settle(next: number): void {
    stop();
    current = next;
    velocity = 0;
    emit();
    onRest?.(current);
  }

  return {
    get: () => current,
    getVelocity: () => velocity,
    isResting: () => unsubscribe === null,

    set(next) {
      if (next === target && unsubscribe) return;
      target = next;
      if (prefersReducedMotion()) return settle(next);
      start();
    },

    setWithVelocity(next, releaseVelocity) {
      target = next;
      velocity = releaseVelocity;
      if (prefersReducedMotion()) return settle(next);
      start();
    },

    jump(value, nextVelocity = 0) {
      stop();
      current = value;
      target = value;
      velocity = nextVelocity;
      emit();
    },

    nudge(addedVelocity) {
      velocity += addedVelocity;
      if (prefersReducedMotion()) return;
      start();
    },

    stop,
  };
}

/* ────────────────────────────────────────────────────────────
   Duration-based driver — value changes with no physics
   ──────────────────────────────────────────────────────────── */

export interface AnimateValueOptions {
  from: number;
  to: number;
  duration?: number;
  easing?: EasingFunction;
  onUpdate: (value: number, progress: number) => void;
  onComplete?: () => void;
}

/**
 * Animate a scalar over a fixed duration. Use for counters and progress, where
 * a predictable arrival time matters more than interruption behaviour.
 *
 * @returns a cancel function.
 */
export function animateValue({
  from,
  to,
  duration = 400,
  easing = Easing.standard,
  onUpdate,
  onComplete,
}: AnimateValueOptions): () => void {
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
 * noisy, and one stationary frame right before release reads as zero velocity,
 * killing the throw entirely.
 */
export class VelocityTracker {
  private readonly samples: { value: number; time: number }[] = [];

  constructor(private readonly windowMs = 100) {}

  add(value: number, time: number = performance.now()): void {
    this.samples.push({ value, time });
    const cutoff = time - this.windowMs;
    while (this.samples.length > 2 && (this.samples[0]?.time ?? 0) < cutoff) {
      this.samples.shift();
    }
  }

  /** Velocity in units per second. */
  velocity(): number {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    if (!first || !last) return 0;
    const dt = last.time - first.time;
    if (dt <= 0) return 0;
    return ((last.value - first.value) / dt) * 1000;
  }

  reset(): void {
    this.samples.length = 0;
  }
}

/**
 * Rubber-band resistance past a boundary.
 *
 *   f(x) = (1 − 1/(x·c/d + 1)) · d
 *
 * f(0)=0, f′(0)=c, and f is asymptotic to `dimension`: no matter how hard the
 * user pulls, travel approaches d and never exceeds it. That ceiling is what
 * communicates "this edge is real" without hard-stopping the finger.
 */
export function rubberBand(offset: number, dimension: number, constant = 0.55): number {
  if (offset === 0 || dimension <= 0) return 0;
  const sign = Math.sign(offset);
  const distance = Math.abs(offset);
  return sign * (1 - 1 / ((distance * constant) / dimension + 1)) * dimension;
}

/**
 * Where a flick would come to rest under exponential deceleration.
 *
 * Snap to the detent nearest the *projection*, not nearest the finger — that
 * single decision is what makes a control respect a throw.
 *
 * @param velocity Units per second.
 * @param decelerationRate Per-ms retention. 0.99 ≈ a short toss,
 *                         0.998 ≈ full momentum scrolling.
 */
export function projectMomentum(velocity: number, decelerationRate = 0.99): number {
  return (velocity / 1000) * (decelerationRate / (1 - decelerationRate));
}

/** Nearest value in `points` to `value`. */
export function nearestSnapPoint(value: number, points: readonly number[]): number {
  let best = points[0] ?? 0;
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

export interface DragGestureOptions {
  axis?: 'x' | 'y';
  onStart?: () => void;
  onMove?: (delta: number) => void;
  /** `velocity` is in px/second, sampled over the trailing window. */
  onEnd?: (delta: number, velocity: number) => void;
}

/**
 * Attach a drag gesture using Pointer Events.
 *
 * Pointer capture means the drag survives the cursor leaving the element, which
 * is the difference between a sheet you can throw and one that drops out from
 * under you halfway.
 *
 * The element also needs `touch-action: none` or the browser claims the gesture.
 *
 * @returns detach function.
 */
export function createDragGesture(
  element: HTMLElement,
  { axis = 'y', onStart, onMove, onEnd }: DragGestureOptions = {},
): () => void {
  const tracker = new VelocityTracker();
  let pointerId: number | null = null;
  let origin = 0;

  const coordinate = (event: PointerEvent): number =>
    axis === 'y' ? event.clientY : event.clientX;

  function handleDown(event: PointerEvent): void {
    if (pointerId !== null || event.button !== 0) return;
    pointerId = event.pointerId;
    origin = coordinate(event);
    tracker.reset();
    tracker.add(0, event.timeStamp);
    element.setPointerCapture(pointerId);
    onStart?.();
  }

  function handleMove(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return;
    const delta = coordinate(event) - origin;
    tracker.add(delta, event.timeStamp);
    onMove?.(delta);
  }

  function handleUp(event: PointerEvent): void {
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

export type StaggerOrigin = 'first' | 'last' | 'center' | 'edges' | number;

export interface StaggerOptions {
  /** Milliseconds between consecutive steps. */
  each?: number;
  from?: StaggerOrigin;
  /** Ceiling for the whole sequence; the offset compresses to respect it. */
  maxTotal?: number;
}

/**
 * Delay in milliseconds for item `index` of `count`.
 *
 * `maxTotal` caps the tail so a long list does not turn a 40ms offset into a
 * three-second wait — past the cap the offset compresses instead.
 */
export function stagger(
  index: number,
  count: number,
  { each = 40, from = 'first', maxTotal = 500 }: StaggerOptions = {},
): number {
  if (count <= 1) return 0;

  let distance: number;
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
    case 'first':
      distance = index;
      break;
    default:
      distance = Math.abs(index - from);
  }

  const maxDistance = from === 'center' || from === 'edges' ? (count - 1) / 2 : count - 1;
  const effectiveEach = Math.min(each, maxTotal / Math.max(maxDistance, 1));
  return distance * effectiveEach;
}

export type GridOrigin = 'top-left' | 'top-right' | 'center';

/**
 * Grid-aware stagger — a wave travelling across a dashboard of tiles.
 *
 * Distance-based rather than index-based: index delay produces a row-by-row
 * sweep that visibly restarts at each wrap, distance produces a clean diagonal
 * wavefront.
 */
export function staggerGrid(
  index: number,
  columns: number,
  count: number,
  { each = 40, origin = 'top-left' }: { each?: number; origin?: GridOrigin } = {},
): number {
  const rows = Math.ceil(count / columns);
  const row = Math.floor(index / columns);
  const column = index % columns;

  switch (origin) {
    case 'center':
      return Math.hypot(row - (rows - 1) / 2, column - (columns - 1) / 2) * each;
    case 'top-right':
      return (row + (columns - 1 - column)) * each;
    default:
      return (row + column) * each;
  }
}
