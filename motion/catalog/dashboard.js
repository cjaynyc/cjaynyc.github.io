import {
  Easing,
  SpringPresets,
  animateValue,
  clamp,
  createSpringValue,
  prefersReducedMotion,
  stagger,
  staggerGrid,
} from '../engine.js';

export const category = {
  id: 'dashboard',
  index: '05',
  title: 'Dashboard & data',
  blurb:
    'Numbers that change are the hardest thing to animate honestly. The motion has to make a delta legible without ever implying a value that was never true — which rules out most of what looks impressive in a demo.',
};

export const entries = [
  {
    id: 'counter',
    title: 'Animated counter',
    summary:
      'Counts on an exponential-decay curve so most of the distance is covered early and the last digits settle. Formatting is applied per frame, so grouping separators never flicker.',
    chips: ['value change', 'tabular-nums', 'Intl'],
    hint: 'Roll a new value',
    prompt: `Build a React <AnimatedNumber> for dashboard metrics.

Curve
- Exponential decay, f(t) = (1 - e^(-5t)) / (1 - e^(-5)), NOT linear and NOT a
  spring. Linear counting reads as a slot machine. A spring overshoots, which
  means displaying a number the metric never actually reached - unacceptable
  for anything a user might screenshot or act on.
- Duration 900ms for a headline figure, 500ms for a tile. Scale slightly with
  the magnitude of the change, but cap it - a huge delta should not take
  proportionally longer.

Formatting
- Format INSIDE the frame callback with Intl.NumberFormat, not once at the end.
- Use font-variant-numeric: tabular-nums. Without it, proportional digits
  change width as they cycle and the whole row jitters horizontally. This is
  the single most common bug in animated counters.
- Reserve width with ch units or a min-width so grouping separators appearing
  ("999" -> "1,000") do not shift neighbouring layout.

Honesty rules
- Always land EXACTLY on the target. Never leave a value asymptotically close.
- Animate from the previous real value, not from 0. Counting up from zero on
  every re-render implies the metric was zero, which is false.
- Skip the animation entirely when the delta is below a threshold (say 1%) -
  micro-animations on every poll are noise.

Accessibility
- aria-live="polite" on the container but render ONLY the final value to the
  accessibility tree. Announcing every intermediate frame floods the screen
  reader. Simplest approach: aria-hidden on the animating span, plus a visually
  hidden span holding the settled value.
- Under prefers-reduced-motion: reduce, set the value directly.`,
    code: `import { useEffect, useRef } from 'react';
import { animateValue, Easing, prefersReducedMotion } from './motion-core';

export function AnimatedNumber({ value, format, duration = 900 }: AnimatedNumberProps) {
  const el = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;   // from the LAST REAL VALUE, never from 0
    previous.current = value;

    // Below 1% change, animation is noise.
    if (prefersReducedMotion() || Math.abs(value - from) / (Math.abs(from) || 1) < 0.01) {
      el.current!.textContent = format(value);
      return;
    }

    return animateValue({
      from, to: value, duration,
      easing: Easing.exponential,    // decay: most distance early, digits settle
      onUpdate: (v) => {
        // Format per frame so separators never flicker mid-count.
        el.current!.textContent = format(v);
      },
      onComplete: () => { el.current!.textContent = format(value); }, // land exactly
    });
  }, [value, duration, format]);

  return (
    <span aria-live="polite">
      {/* tabular-nums is not optional — proportional digits jitter the row */}
      <span ref={el} aria-hidden style={{ fontVariantNumeric: 'tabular-nums' }} />
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}`,
    notes: `<strong>Never spring a number.</strong> Overshoot means rendering a figure the metric never held. On a revenue tile that is not a charming flourish — it is a value someone might screenshot. Exponential decay covers most of the distance early and settles into the final digits without ever passing them.
<ul>
<li><strong><code>tabular-nums</code> or the row jitters.</strong> Proportional digits have different widths, so an animating counter shoves its neighbours sideways on every frame. This is the most common counter bug there is.</li>
<li><strong>Animate from the last real value.</strong> Counting from zero on every re-render tells the user the metric was zero a moment ago. It was not.</li>
<li><strong>Announce once.</strong> <code>aria-hidden</code> on the animating span and a visually hidden span with the settled value — otherwise the screen reader reads every frame.</li>
</ul>`,
    mount(stage) {
      stage.innerHTML = `
        <div class="d-stack">
          <div class="d-counter" data-count>0</div>
          <div class="d-counter-delta" data-delta>&nbsp;</div>
          <div class="d-row">
            <button class="d-btn d-btn--sm" data-roll type="button">Roll new value</button>
            <button class="d-btn d-btn--sm d-btn--ghost" data-small type="button">Tiny change (skipped)</button>
          </div>
        </div>`;

      const display = stage.querySelector('[data-count]');
      const delta = stage.querySelector('[data-delta]');
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });

      let current = 48250;
      let cancel = null;
      display.textContent = formatter.format(current);

      function setValue(next) {
        const from = current;
        current = next;

        const change = Math.abs(next - from) / (Math.abs(from) || 1);
        delta.textContent = `${next >= from ? '+' : '−'}${formatter.format(
          Math.abs(next - from),
        )}  ·  ${(change * 100).toFixed(1)}%`;

        cancel?.();

        if (prefersReducedMotion() || change < 0.01) {
          display.textContent = formatter.format(next);
          delta.textContent += change < 0.01 ? '  · skipped' : '';
          return;
        }

        cancel = animateValue({
          from,
          to: next,
          duration: 900,
          easing: Easing.exponential,
          onUpdate: (v) => {
            display.textContent = formatter.format(v);
          },
          onComplete: () => {
            display.textContent = formatter.format(next);
          },
        });
      }

      stage.querySelector('[data-roll]').addEventListener('click', () => {
        setValue(Math.round(12000 + Math.random() * 180000));
      });
      stage.querySelector('[data-small]').addEventListener('click', () => {
        setValue(Math.round(current * (1 + (Math.random() - 0.5) * 0.008)));
      });

      const timer = setTimeout(() => setValue(126400), 400);

      return {
        replay: () => setValue(Math.round(12000 + Math.random() * 180000)),
        destroy() {
          clearTimeout(timer);
          cancel?.();
        },
      };
    },
  },

  {
    id: 'tile-grid',
    title: 'Staggered tile reveal',
    summary:
      'A diagonal wave across the grid, distance-based rather than index-based. The offset compresses as the grid grows so the last tile never lags the first by more than half a second.',
    chips: ['offset & delay', 'grid distance', 'capped total'],
    hint: 'Replay the reveal',
    prompt: `Build a staggered reveal for a dashboard tile grid.

Distance, not index
- Delay must come from the tile's grid DISTANCE from an origin corner, not from
  its flat array index. Index-based delay produces a row-by-row sweep that
  visibly restarts at each row wrap. Distance produces a clean diagonal wavefront.
    delay = (row + column) * each                   // top-left origin
    delay = hypot(row - cy, column - cx) * each     // radial from centre
- Offer top-left, top-right and centre origins. Choose based on where the user's
  attention already is - after a filter change the origin should be the control
  they just touched.

Cap the total
- Never let the sequence exceed ~500ms end to end. A 40ms offset across a 6x4
  grid is 8 steps of distance = 320ms, fine. Across 12x8 it is 760ms, which
  means the last tile arrives long after the user started reading the first.
- Compress the offset rather than dropping the stagger:
    effectiveEach = min(each, maxTotal / maxDistance)

Per-tile motion
- translateY 12px -> 0, opacity 0 -> 1, over 320ms on a decelerate curve.
- Do not scale tiles. Scaling text-bearing surfaces makes the type resample and
  look soft for the duration.
- Only transform and opacity, so all of it stays off the main thread.

When NOT to stagger
- Only on first paint of the grid, or on a genuine dataset change. Re-staggering
  on every poll or filter tweak turns a dashboard into a light show and makes
  values unreadable while they animate.
- Under prefers-reduced-motion: reduce, render everything immediately at rest.`,
    code: `import { staggerGrid, Easing } from './motion-core';

const COLUMNS = 3;
const EACH = 45;
const MAX_TOTAL = 500;

export function TileGrid({ tiles }: { tiles: Tile[] }) {
  const maxDistance = (Math.ceil(tiles.length / COLUMNS) - 1) + (COLUMNS - 1);
  // Compress the offset instead of letting the tail grow unbounded.
  const each = Math.min(EACH, MAX_TOTAL / Math.max(maxDistance, 1));

  return (
    <div className="tiles">
      {tiles.map((tile, i) => (
        <div
          key={tile.id}
          className="tile"
          style={{
            // Distance from the origin corner — a diagonal wavefront, not a row sweep.
            animationDelay: staggerGrid(i, COLUMNS, tiles.length, { each }) + 'ms',
            animationDuration: '320ms',
            animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
            animationFillMode: 'both',
            animationName: 'tile-in',
          }}
        >
          <div className="tile-label">{tile.label}</div>
          <div className="tile-value">{tile.value}</div>
        </div>
      ))}
    </div>
  );
}

/* translateY and opacity only — never scale a surface carrying text.
@keyframes tile-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .tile { animation: none !important; }
}
*/`,
    notes: `<strong>Distance, not index.</strong> Delay by array position and the reveal sweeps left-to-right and visibly restarts at every row wrap. Delay by grid distance and you get a single diagonal wavefront crossing the whole grid at once.
<ul>
<li><strong>Cap the total, compress the offset.</strong> 40ms per step is fine on a 3×3 and awful on a 12×8. Shrink the step so the tail stays under ~500ms rather than letting the sequence grow.</li>
<li><strong>Don't scale tiles.</strong> Scaling resamples the type inside them and it looks soft for the whole animation. Translate and fade.</li>
<li><strong>Stagger on arrival, not on every update.</strong> Re-running this on each poll makes a dashboard unreadable exactly when someone is trying to read it.</li>
</ul>`,
    mount(stage) {
      const TILES = [
        ['Revenue', '$126.4k'],
        ['Sessions', '48,210'],
        ['Conversion', '3.42%'],
        ['Avg order', '$84.10'],
        ['Refunds', '1.08%'],
        ['New users', '9,145'],
        ['Churn', '2.1%'],
        ['LTV', '$412'],
        ['NPS', '61'],
      ];
      const COLUMNS = 3;

      stage.innerHTML = `
        <div class="d-stack" style="width:100%">
          <div class="d-tiles">
            ${TILES.map(
              ([label, value]) => `
              <div class="d-tile">
                <div class="d-tile-label">${label}</div>
                <div class="d-tile-value">${value}</div>
              </div>`,
            ).join('')}
          </div>
          <div class="d-row" style="gap:14px">
            <label class="d-readout" style="display:flex;align-items:center;gap:6px;cursor:pointer">
              origin
              <select class="d-readout" data-origin style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:3px 6px">
                <option value="top-left">top-left</option>
                <option value="top-right">top-right</option>
                <option value="center">centre</option>
              </select>
            </label>
            <span class="d-readout">step <b data-each>45</b>ms · tail <b data-tail>0</b>ms</span>
          </div>
        </div>`;

      const tiles = [...stage.querySelectorAll('.d-tile')];
      const originSelect = stage.querySelector('[data-origin]');
      const eachOut = stage.querySelector('[data-each]');
      const tailOut = stage.querySelector('[data-tail]');
      const timers = [];
      const springs = new Set();

      function reveal() {
        for (const timer of timers) clearTimeout(timer);
        timers.length = 0;
        for (const spring of springs) spring.stop();
        springs.clear();

        const origin = originSelect.value;
        const rows = Math.ceil(tiles.length / COLUMNS);
        const maxDistance =
          origin === 'center'
            ? Math.hypot((rows - 1) / 2, (COLUMNS - 1) / 2)
            : rows - 1 + (COLUMNS - 1);
        const each = Math.min(45, 500 / Math.max(maxDistance, 1));

        eachOut.textContent = each.toFixed(0);
        tailOut.textContent = (maxDistance * each).toFixed(0);

        if (prefersReducedMotion()) {
          for (const tile of tiles) {
            tile.style.opacity = '1';
            tile.style.transform = 'none';
          }
          return;
        }

        tiles.forEach((tile, index) => {
          tile.style.opacity = '0';
          tile.style.transform = 'translateY(12px)';

          const delay = staggerGrid(index, COLUMNS, tiles.length, { each, origin });
          timers.push(
            setTimeout(() => {
              const cancel = animateValue({
                from: 0,
                to: 1,
                duration: 320,
                easing: Easing.decelerate,
                onUpdate: (p) => {
                  tile.style.opacity = String(p);
                  tile.style.transform = `translateY(${12 * (1 - p)}px)`;
                },
              });
              springs.add({ stop: cancel });
            }, delay),
          );
        });
      }

      originSelect.addEventListener('change', reveal);
      const initial = setTimeout(reveal, 240);

      return {
        replay: reveal,
        destroy() {
          clearTimeout(initial);
          for (const timer of timers) clearTimeout(timer);
          for (const spring of springs) spring.stop();
        },
      };
    },
  },

  {
    id: 'bars',
    title: 'Bar chart draw-in',
    summary:
      'Bars scale from their baseline, not their centre, so they grow out of the axis. Labels stay unscaled — the inverse-scale trick that keeps type crisp while its container animates.',
    chips: ['transform-origin', 'scaleY', 'axis-anchored'],
    hint: 'Replay, or roll new data',
    prompt: `Build an animated bar chart draw-in.

Growth direction
- transform-origin: bottom center and animate scaleY from 0 to 1. Bars must grow
  OUT OF the axis. Default centre origin makes them expand in both directions,
  which reads as bars materialising in mid-air rather than being measured up
  from a baseline.
- Use scaleY, not height. Height animation triggers layout on every frame for
  every bar; scaleY is compositor-only.

The scale/type problem
- scaleY on a bar also scales anything inside it. If a value label sits on the
  bar, apply the inverse transform to the label: scaleY(1 / barScale). Otherwise
  the text stretches vertically through the entire animation.
- Simpler alternative: keep labels OUTSIDE the scaled element as siblings. Take
  this option unless the design genuinely requires labels on the bar.

Stagger
- 45ms per bar, left to right. Reading order. Do not stagger from the centre on
  a time-series axis - it fights the direction the data is read in.
- Duration 420ms per bar on a decelerate curve.

Honesty
- Scale must map linearly to value. A bar animating on an eased curve is fine;
  a bar whose FINAL height is non-linear in its value is a lie.
- Animate only on mount and on genuine data change. Re-animating on hover or
  tooltip open makes comparison impossible.
- Under prefers-reduced-motion: reduce, render final heights immediately.`,
    code: `import { animateValue, Easing, stagger } from './motion-core';

export function BarChart({ data, max }: BarChartProps) {
  const bars = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const cancels = data.map((_, i) =>
      setTimeout(() => {
        animateValue({
          from: 0, to: 1, duration: 420, easing: Easing.decelerate,
          onUpdate: (p) => {
            const bar = bars.current[i];
            if (!bar) return;
            // Grows out of the axis, not out of its own centre.
            bar.style.transform = 'scaleY(' + p + ')';
            // Undo the stretch on the label riding the bar.
            const label = bar.querySelector<HTMLElement>('.bar-label');
            if (label) label.style.transform = 'scaleY(' + 1 / Math.max(p, 0.001) + ')';
          },
        });
      }, stagger(i, data.length, { each: 45 })),   // left to right: reading order
    );

    return () => cancels.forEach(clearTimeout);
  }, [data]);

  return (
    <div className="bars">
      {data.map((d, i) => (
        <div key={d.label} className="bar-col">
          <div
            ref={(el) => { bars.current[i] = el; }}
            className="bar"
            style={{ height: (d.value / max) * 100 + '%', transformOrigin: 'bottom center' }}
          />
          {/* label as a SIBLING — never inside the scaled element */}
          <span className="bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}`,
    notes: `<strong>transform-origin: bottom center</strong> is the whole difference between bars that grow out of the axis and bars that expand in both directions from thin air. Default centre origin is wrong for every bar chart.
<ul>
<li><strong>scaleY, not height.</strong> Height animation lays out every frame for every bar; scaleY stays on the compositor.</li>
<li><strong>Labels as siblings.</strong> Anything inside a <code>scaleY</code>'d element stretches with it. Either apply <code>scaleY(1/p)</code> to undo it, or keep labels outside — take the second option unless the design forces the first.</li>
<li><strong>Scale must be linear in value.</strong> Easing the animation is fine. A final height that is non-linear in the number is a lie about the data.</li>
</ul>`,
    mount(stage) {
      const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      let data = [0.42, 0.68, 0.55, 0.91, 0.74, 0.38, 0.6];

      stage.innerHTML = `
        <div class="d-stack" style="width:100%">
          <div class="d-bars">
            ${LABELS.map(
              (label) => `
              <div class="d-bar-col">
                <div class="d-bar"></div>
                <span class="d-bar-label">${label}</span>
              </div>`,
            ).join('')}
          </div>
          <div class="d-row">
            <button class="d-btn d-btn--sm d-btn--ghost" data-roll type="button">Roll new data</button>
            <span class="d-readout">origin <b>bottom center</b> · 45ms stagger</span>
          </div>
        </div>`;

      const bars = [...stage.querySelectorAll('.d-bar')];
      const timers = [];
      const cancels = [];

      function draw() {
        for (const timer of timers) clearTimeout(timer);
        for (const cancel of cancels) cancel?.();
        timers.length = 0;
        cancels.length = 0;

        bars.forEach((bar, index) => {
          bar.style.height = `${data[index] * 100}%`;

          if (prefersReducedMotion()) {
            bar.style.transform = 'scaleY(1)';
            return;
          }

          bar.style.transform = 'scaleY(0)';
          timers.push(
            setTimeout(
              () => {
                cancels.push(
                  animateValue({
                    from: 0,
                    to: 1,
                    duration: 420,
                    easing: Easing.decelerate,
                    onUpdate: (p) => {
                      bar.style.transform = `scaleY(${p})`;
                    },
                  }),
                );
              },
              stagger(index, bars.length, { each: 45 }),
            ),
          );
        });
      }

      stage.querySelector('[data-roll]').addEventListener('click', () => {
        data = LABELS.map(() => 0.25 + Math.random() * 0.75);
        draw();
      });

      const initial = setTimeout(draw, 240);

      return {
        replay: draw,
        destroy() {
          clearTimeout(initial);
          for (const timer of timers) clearTimeout(timer);
          for (const cancel of cancels) cancel?.();
        },
      };
    },
  },

  {
    id: 'ring',
    title: 'Progress ring',
    summary:
      'One stroke-dashoffset drives the arc while the same progress value drives the readout, so the number and the geometry can never disagree.',
    chips: ['stroke-dashoffset', 'SVG', 'single source'],
    hint: 'Set a new target',
    prompt: `Build an SVG progress ring.

Geometry
- Circumference C = 2 * PI * r. Set stroke-dasharray = C and animate
  stroke-dashoffset from C (empty) down to C * (1 - progress).
- Rotate the arc -90 degrees with transform-origin: center so it starts at
  12 o'clock. Without it the arc begins at 3 o'clock, which nobody reads as
  the start.
- stroke-linecap: round looks better but adds half a stroke-width of visual
  length at each end. At low percentages the cap alone can imply ~4% progress
  when the true value is 0. Use butt caps below ~5%, or accept the bias
  knowingly.

Single source of truth
- The numeric readout and the arc must both be derived from ONE animated
  progress value in the same frame callback. Two separate animations with
  matching durations will drift, and a ring reading 71% next to an arc drawn at
  68% destroys trust in the whole dashboard.

Motion
- 800ms on a decelerate curve. Spring is wrong here for the same reason it is
  wrong for counters: overshoot would draw an arc past the real value.
- Animate from the previous value, not from 0.

Accessibility
- role="progressbar" with aria-valuenow / aria-valuemin / aria-valuemax on the
  wrapper. Update aria-valuenow only on settle, not per frame.
- SVG itself gets aria-hidden="true"; the accessible name lives on the wrapper.
- Under prefers-reduced-motion: reduce, set the offset directly.`,
    code: `import { useEffect, useRef } from 'react';
import { animateValue, Easing, prefersReducedMotion } from './motion-core';

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProgressRing({ value }: { value: number }) {
  const arc = useRef<SVGCircleElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;

    const apply = (p: number) => {
      // ONE value drives both. Two animations would drift and the ring would
      // read a different number than it draws.
      arc.current!.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - p));
      label.current!.textContent = Math.round(p * 100) + '%';
    };

    if (prefersReducedMotion()) return apply(value);

    return animateValue({
      from, to: value, duration: 800, easing: Easing.decelerate, onUpdate: apply,
      onComplete: () => apply(value),
    });
  }, [value]);

  return (
    <div role="progressbar" aria-valuenow={Math.round(value * 100)}
         aria-valuemin={0} aria-valuemax={100} aria-label="Quota used">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={RADIUS} className="track" strokeWidth="10" />
        <circle
          ref={arc} cx="60" cy="60" r={RADIUS} className="arc" strokeWidth="10"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
          /* -90deg so the arc starts at 12 o'clock, not 3 */
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
      </svg>
      <span ref={label} />
    </div>
  );
}`,
    notes: `<strong>One value, two consumers.</strong> The arc geometry and the percentage readout come off the same progress number inside the same frame callback. Run them as two animations and they drift — a ring reading 71% beside an arc drawn at 68% quietly destroys trust in everything else on the dashboard.
<ul>
<li><strong>Rotate −90°</strong> or the arc starts at 3 o'clock, which nobody reads as the beginning.</li>
<li><strong>Round caps lie at low values.</strong> The cap adds half a stroke-width at each end — enough to imply ~4% when the true value is 0. Use butt caps under ~5%.</li>
<li><strong>No spring.</strong> Overshoot would draw an arc past the real number, same objection as animated counters.</li>
</ul>`,
    mount(stage) {
      const RADIUS = 52;
      const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

      stage.innerHTML = `
        <div class="d-stack">
          <div class="d-ring-wrap" role="progressbar" aria-valuemin="0" aria-valuemax="100"
               aria-valuenow="0" aria-label="Quota used">
            <svg width="132" height="132" viewBox="0 0 120 120" aria-hidden="true">
              <circle class="d-ring-track" cx="60" cy="60" r="${RADIUS}" stroke-width="10"></circle>
              <circle class="d-ring-arc" data-arc cx="60" cy="60" r="${RADIUS}" stroke-width="10"
                      stroke-dasharray="${CIRCUMFERENCE.toFixed(2)}"
                      stroke-dashoffset="${CIRCUMFERENCE.toFixed(2)}"></circle>
            </svg>
            <span class="d-ring-value" data-value>0%</span>
          </div>
          <div class="d-row">
            <button class="d-btn d-btn--sm d-btn--ghost" data-set="0.24" type="button">24%</button>
            <button class="d-btn d-btn--sm d-btn--ghost" data-set="0.68" type="button">68%</button>
            <button class="d-btn d-btn--sm d-btn--ghost" data-set="0.94" type="button">94%</button>
          </div>
        </div>`;

      const wrap = stage.querySelector('.d-ring-wrap');
      const arc = stage.querySelector('[data-arc]');
      const label = stage.querySelector('[data-value]');

      let current = 0;
      let cancel = null;

      // One value drives geometry and readout together.
      const apply = (p) => {
        arc.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - p));
        label.textContent = `${Math.round(p * 100)}%`;
        // Round caps overstate low values; switch to butt below 5%.
        arc.style.strokeLinecap = p < 0.05 ? 'butt' : 'round';
      };

      function setValue(next) {
        const from = current;
        current = next;
        cancel?.();

        if (prefersReducedMotion()) {
          apply(next);
          wrap.setAttribute('aria-valuenow', String(Math.round(next * 100)));
          return;
        }

        cancel = animateValue({
          from,
          to: next,
          duration: 800,
          easing: Easing.decelerate,
          onUpdate: apply,
          onComplete: () => {
            apply(next);
            // Announce only on settle, never per frame.
            wrap.setAttribute('aria-valuenow', String(Math.round(next * 100)));
          },
        });
      }

      for (const button of stage.querySelectorAll('[data-set]')) {
        button.addEventListener('click', () => setValue(Number(button.dataset.set)));
      }

      const initial = setTimeout(() => setValue(0.68), 300);

      return {
        replay: () => setValue(Math.random() * 0.95 + 0.03),
        destroy() {
          clearTimeout(initial);
          cancel?.();
        },
      };
    },
  },

  {
    id: 'tab-indicator',
    title: 'Shared tab indicator',
    summary:
      'One pill travels between tabs instead of each tab fading its own background. Position and width animate together, so it stretches slightly as it moves.',
    chips: ['shared element', 'FLIP-lite', 'measured'],
    hint: 'Switch tabs',
    prompt: `Build a tab bar with a single shared indicator that travels between tabs.

The core idea
- ONE indicator element, absolutely positioned, that animates its transform and
  width to match the selected tab. Do not fade a separate background in and out
  per tab: independent fades read as two unrelated events, while a travelling
  pill reads as one object moving, which is what tells the user the tabs are a
  single control.

Measurement
- Read the selected tab's offsetLeft and offsetWidth, then apply
  translateX(offsetLeft) and width. Measure in a layout effect, before paint,
  or the indicator will show one frame at the wrong position.
- Re-measure on resize and when tab labels change. A ResizeObserver on the
  container is the reliable way; window resize alone misses font loading and
  container-driven reflow.

Motion
- Spring on BOTH position and width, stiffness 300 / damping 30. Because width
  settles marginally after position, the pill stretches slightly in the
  direction of travel and compresses on arrival. That squash is the entire
  character of the effect - matching them exactly makes it feel rigid.
- Duration equivalent ~220ms. Longer and the tab bar feels sluggish, which is
  bad because tabs are usually a wayfinding control people use quickly.

Panels
- Cross-fade panel content over 160ms with a 4px directional slide matching the
  travel direction. Do not slide the full width; that implies a carousel the
  user cannot actually swipe.

Accessibility
- role="tablist" / role="tab" / role="tabpanel", aria-selected, and roving
  tabindex with arrow-key navigation. The indicator is decorative:
  aria-hidden="true".`,
    code: `import { useLayoutEffect, useRef, useState } from 'react';
import { useSpringValue } from './hooks';

export function Tabs({ tabs }: { tabs: Tab[] }) {
  const list = useRef<HTMLDivElement>(null);
  const ink = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);

  const write = () => {
    if (ink.current) {
      ink.current.style.transform = 'translateX(' + x.get() + 'px)';
      ink.current.style.width = w.get() + 'px';
    }
  };

  // Two springs, same config. Width settles a hair after position, which is
  // what produces the stretch-then-settle. Matching them exactly feels rigid.
  const x = useSpringValue(0, { stiffness: 300, damping: 30, onChange: write });
  const w = useSpringValue(0, { stiffness: 300, damping: 30, onChange: write });

  // Measure BEFORE paint or the indicator flashes at the wrong position.
  useLayoutEffect(() => {
    const tab = list.current?.children[selected] as HTMLElement | undefined;
    if (!tab) return;
    x.set(tab.offsetLeft);
    w.set(tab.offsetWidth);
  }, [selected, x, w]);

  // Font loading and container reflow both move tabs without a window resize.
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => {
      const tab = list.current?.children[selected] as HTMLElement | undefined;
      if (tab) { x.jump(tab.offsetLeft); w.jump(tab.offsetWidth); }
    });
    if (list.current) observer.observe(list.current);
    return () => observer.disconnect();
  }, [selected, x, w]);

  return (
    <div ref={list} role="tablist">
      <div ref={ink} className="ink" aria-hidden="true" />
      {tabs.map((tab, i) => (
        <button key={tab.id} role="tab" aria-selected={i === selected}
                tabIndex={i === selected ? 0 : -1}
                onClick={() => setSelected(i)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}`,
    notes: `<strong>One object moving, not two things fading.</strong> Independent per-tab background fades read as two unrelated events. A single pill travelling between positions reads as one control with a current state — which is what a tab bar actually is.
<ul>
<li><strong>The squash is a feature.</strong> Springing position and width with the same config lets width settle a fraction later, so the pill stretches toward its destination and compresses on arrival. Lock them together and it feels rigid.</li>
<li><strong>Measure before paint.</strong> A plain effect leaves one frame at the old position, which shows up as a flicker on every switch.</li>
<li><strong>ResizeObserver, not window resize.</strong> Web font loading reflows the tabs without ever firing a resize event.</li>
</ul>`,
    mount(stage) {
      const TABS = ['Overview', 'Traffic', 'Revenue', 'Retention'];
      const COPY = [
        'Blended metrics across every connected source.',
        'Sessions, referrers, and channel mix.',
        'Bookings, expansion, and net revenue retention.',
        'Cohort curves and churn by plan.',
      ];

      stage.innerHTML = `
        <div class="d-stack">
          <div class="d-tabs" role="tablist">
            <div class="d-tab-ink" aria-hidden="true"></div>
            ${TABS.map(
              (label, i) => `
              <button class="d-tab" role="tab" aria-selected="${i === 0}"
                      tabindex="${i === 0 ? 0 : -1}" type="button">${label}</button>`,
            ).join('')}
          </div>
          <div class="d-tab-panel" role="tabpanel">${COPY[0]}</div>
          <div class="d-readout">x <b data-x>0</b>px · width <b data-w>0</b>px</div>
        </div>`;

      const list = stage.querySelector('.d-tabs');
      const ink = stage.querySelector('.d-tab-ink');
      const tabs = [...stage.querySelectorAll('.d-tab')];
      const panel = stage.querySelector('.d-tab-panel');
      const xOut = stage.querySelector('[data-x]');
      const wOut = stage.querySelector('[data-w]');

      let selected = 0;
      let panelCancel = null;

      const write = () => {
        ink.style.transform = `translateX(${x.get()}px)`;
        ink.style.width = `${w.get()}px`;
        xOut.textContent = x.get().toFixed(0);
        wOut.textContent = w.get().toFixed(0);
      };

      const x = createSpringValue(0, { mass: 1, stiffness: 300, damping: 30, onChange: write });
      const w = createSpringValue(0, { mass: 1, stiffness: 300, damping: 30, onChange: write });

      function place(index, animate = true) {
        const tab = tabs[index];
        if (!tab) return;
        if (animate) {
          x.set(tab.offsetLeft);
          w.set(tab.offsetWidth);
        } else {
          x.jump(tab.offsetLeft);
          w.jump(tab.offsetWidth);
        }
      }

      function select(index) {
        const direction = Math.sign(index - selected) || 1;
        selected = index;

        tabs.forEach((tab, i) => {
          tab.setAttribute('aria-selected', String(i === index));
          tab.tabIndex = i === index ? 0 : -1;
        });
        place(index);

        // Short directional cross-fade — not a full-width slide.
        panelCancel?.();
        if (prefersReducedMotion()) {
          panel.textContent = COPY[index];
          panel.style.opacity = '1';
          panel.style.transform = 'none';
          return;
        }
        panelCancel = animateValue({
          from: 0,
          to: 1,
          duration: 160,
          easing: Easing.standard,
          onUpdate: (p) => {
            if (p < 0.5) {
              panel.style.opacity = String(1 - p * 2);
              panel.style.transform = `translateX(${-direction * 4 * (p * 2)}px)`;
            } else {
              const q = (p - 0.5) * 2;
              panel.textContent = COPY[index];
              panel.style.opacity = String(q);
              panel.style.transform = `translateX(${direction * 4 * (1 - q)}px)`;
            }
          },
          onComplete: () => {
            panel.textContent = COPY[index];
            panel.style.opacity = '1';
            panel.style.transform = 'none';
          },
        });
      }

      tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => select(index));
        tab.addEventListener('keydown', (event) => {
          const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
          if (!delta) return;
          event.preventDefault();
          const next = (selected + delta + tabs.length) % tabs.length;
          select(next);
          tabs[next].focus();
        });
      });

      // Fonts and container reflow both move tabs without a window resize.
      const observer = new ResizeObserver(() => place(selected, false));
      observer.observe(list);
      place(0, false);

      return {
        replay: () => select((selected + 1) % tabs.length),
        destroy() {
          observer.disconnect();
          panelCancel?.();
          x.stop();
          w.stop();
        },
      };
    },
  },
];
