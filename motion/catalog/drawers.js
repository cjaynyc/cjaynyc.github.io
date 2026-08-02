import {
  Easing,
  SpringPresets,
  clamp,
  createDragGesture,
  createSpringValue,
  interpolate,
  nearestSnapPoint,
  onFrame,
  prefersReducedMotion,
  projectMomentum,
  rubberBand,
} from '../engine.js';

export const category = {
  id: 'drawers',
  index: '03',
  title: 'Drawers & sheets — push and pull',
  blurb:
    'Surfaces you grab, throw, and let go of. The gesture never hands off to a canned animation: the finger writes position directly, and on release the spring picks up the exact velocity the finger left behind.',
};

export const entries = [
  {
    id: 'bottom-sheet',
    title: 'Bottom sheet with detents',
    summary:
      'Three resting positions, velocity-projected snapping, and rubber-band resistance past the top. Scrim opacity is derived from sheet position, so the background dims continuously as you drag.',
    chips: ['detents', 'projection', 'derived scrim'],
    hint: 'Drag the handle up and down',
    stage: { tall: true },
    prompt: `Build a React <Sheet> — a draggable bottom sheet with detents.

Detents
- Accept detents as fractions of sheet height, e.g. [0, 0.5, 0.9] meaning
  full / half / peek. Resolve to pixel offsets after measuring; never hardcode.
- translateY only. Animating height reflows the sheet's contents on every
  frame, which is both slow and visibly wrong when text rewraps mid-drag.

Drag
- Pointer Events with setPointerCapture. touch-action: none on the drag handle.
- While dragging, write position DIRECTLY from the pointer delta. Do not route
  the finger through a spring — that adds lag between the finger and the sheet,
  and users read that lag as the app being slow.
- Past the topmost detent, apply rubberBand(overshoot, sheetHeight). Past the
  bottom, allow free travel to dismiss.

Release
- Sample release velocity over a ~100ms trailing window.
- Project the resting point: offset + projectMomentum(velocity, 0.99).
- Snap to the detent nearest the PROJECTION, not nearest the current offset.
- Hand the release velocity to the settling spring as v0. Preset: gentle
  (mass 1 / stiffness 120 / damping 22, zeta ~ 1.0). A sheet is a large surface
  with implied mass; overshoot on something that size reads as flimsy.
- Dismiss when the projected point falls past the last detent, OR when downward
  velocity exceeds ~900px/s regardless of position. The velocity escape hatch
  matters: a fast flick from near the top should still dismiss.

Derived state
- Scrim opacity must be a function of current sheet offset, interpolated
  continuously — not a class toggled at the end of the gesture. Half-dragged
  means half-dimmed.

Accessibility
- role="dialog" aria-modal="true", focus moves into the sheet on open and
  returns to the trigger on close.
- Escape closes. Under prefers-reduced-motion, skip the slide and cross-fade.`,
    code: `import { useCallback, useRef } from 'react';
import {
  VelocityTracker, projectMomentum, nearestSnapPoint, rubberBand, clamp,
} from './motion-core';
import { useSpringValue } from './hooks';

const DISMISS_VELOCITY = 900;   // px/s — a fast flick dismisses from anywhere

export function Sheet({ detents = [0, 0.5, 0.9], onDismiss, children }: SheetProps) {
  const sheet = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const tracker = useRef(new VelocityTracker(100));
  const base = useRef(0);

  const offset = useSpringValue(0, {
    ...SpringPresets.gentle,
    onChange: (y) => {
      const h = sheet.current?.offsetHeight ?? 1;
      sheet.current!.style.transform = 'translateY(' + y + 'px)';
      // Scrim is DERIVED from position — continuous, not a toggled class.
      scrim.current!.style.opacity = String(clamp(1 - y / h, 0, 1) * 0.45);
    },
  });

  const points = () => detents.map((d) => d * (sheet.current?.offsetHeight ?? 0));

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    base.current = offset.get();
    tracker.current.reset();
    offset.stop();                       // finger takes over
  }, [offset]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    tracker.current.add(e.clientY, e.timeStamp);

    const raw = base.current + (e.clientY - /* origin */ 0);
    const top = points()[0];
    // Resist past the top; travel freely downward so dismiss stays reachable.
    offset.jump(raw < top ? top + rubberBand(raw - top, sheet.current!.offsetHeight) : raw);
  }, [offset]);

  const onPointerUp = useCallback(() => {
    const velocity = tracker.current.velocity();
    const projected = offset.get() + projectMomentum(velocity, 0.99);
    const snaps = points();
    const last = snaps[snaps.length - 1];

    if (projected > last || velocity > DISMISS_VELOCITY) return onDismiss();

    offset.setWithVelocity(nearestSnapPoint(projected, snaps), velocity);
  }, [offset, onDismiss]);

  return (
    <>
      <div ref={scrim} className="scrim" />
      <div ref={sheet} className="sheet" role="dialog" aria-modal="true">
        <div className="handle"
             onPointerDown={onPointerDown}
             onPointerMove={onPointerMove}
             onPointerUp={onPointerUp} />
        {children}
      </div>
    </>
  );
}`,
    notes: `<strong>The finger writes position directly.</strong> Routing drag through a spring inserts lag between the pointer and the sheet, and users read that lag as the app being slow — not as smoothness. The spring only takes over at release, seeded with the velocity the finger left behind.
<ul>
<li><strong>The velocity escape hatch.</strong> Dismissing only on projected position means a hard downward flick from near the top gets ignored, because the projection still lands closer to a detent. Above ~900px/s downward, dismiss regardless of where it is.</li>
<li><strong>Scrim is derived, not toggled.</strong> Opacity is a continuous function of sheet offset, so a half-dragged sheet is half-dimmed and the gesture stays reversible.</li>
<li><strong>Gentle, not bouncy.</strong> ζ ≈ 1.0. A surface this large that overshoots reads as flimsy rather than lively.</li>
<li><strong>translateY, never height.</strong> Animating height rewraps the sheet's text on every frame.</li>
</ul>`,
    mount(stage) {
      stage.innerHTML = `
        <div class="d-row" style="gap:22px">
          <div class="d-frame d-draggable">
            <div class="d-frame-bar">Library</div>
            <div class="d-frame-body">
              <div class="d-skel-line" style="width:78%"></div>
              <div class="d-skel-line" style="width:92%"></div>
              <div class="d-skel-line" style="width:64%"></div>
              <div class="d-skel-line" style="width:84%"></div>
            </div>
            <div class="d-scrim" data-scrim style="opacity:0"></div>
            <div class="d-sheet">
              <div class="d-sheet-handle d-draggable" aria-label="Drag to resize"></div>
              <div class="d-sheet-body">
                <div class="d-sheet-title">Now playing</div>
                <div class="d-skel-line" style="width:88%"></div>
                <div class="d-skel-line" style="width:70%"></div>
                <div class="d-skel-line" style="width:80%"></div>
              </div>
            </div>
          </div>
          <div class="d-stack" style="align-items:flex-start;gap:9px">
            <div class="d-readout">offset <b data-off>0</b>px</div>
            <div class="d-readout">velocity <b data-vel>0</b>px/s</div>
            <div class="d-readout">projected <b data-proj>0</b>px</div>
            <div class="d-readout">snapped to <b data-snap>full</b></div>
            <div class="d-readout" style="opacity:.7">detents: full / half / peek</div>
            <button class="d-btn d-btn--sm d-btn--ghost" data-cycle type="button">Cycle detent</button>
          </div>
        </div>`;

      const sheet = stage.querySelector('.d-sheet');
      const handle = stage.querySelector('.d-sheet-handle');
      const scrim = stage.querySelector('[data-scrim]');
      const out = {
        offset: stage.querySelector('[data-off]'),
        velocity: stage.querySelector('[data-vel]'),
        projected: stage.querySelector('[data-proj]'),
        snap: stage.querySelector('[data-snap]'),
      };

      const LABELS = ['full', 'half', 'peek'];
      // Fractions of sheet height, resolved after measuring.
      const FRACTIONS = [0, 0.47, 0.9];
      const points = () => FRACTIONS.map((f) => Math.round(f * sheet.offsetHeight));

      const offset = createSpringValue(0, {
        ...SpringPresets.gentle,
        onChange(value) {
          sheet.style.transform = `translateY(${value}px)`;
          scrim.style.opacity = String(
            clamp(1 - value / sheet.offsetHeight, 0, 1) * 0.45,
          );
          out.offset.textContent = value.toFixed(0);
        },
      });

      // Start at peek so the demo invites a pull.
      offset.jump(points()[2]);
      out.snap.textContent = 'peek';

      let base = 0;

      const detach = createDragGesture(handle, {
        axis: 'y',
        onStart() {
          base = offset.get();
          offset.stop();
        },
        onMove(delta) {
          const raw = base + delta;
          const top = points()[0];
          // Resist past the top; free travel downward keeps peek reachable.
          offset.jump(raw < top ? top + rubberBand(raw - top, sheet.offsetHeight) : raw);
        },
        onEnd(delta, velocity) {
          const snaps = points();
          const projected = offset.get() + projectMomentum(velocity, 0.99);
          const target = nearestSnapPoint(projected, snaps);

          out.velocity.textContent = velocity.toFixed(0);
          out.projected.textContent = projected.toFixed(0);
          out.snap.textContent = LABELS[snaps.indexOf(target)] ?? 'peek';

          // Carry release velocity into the settle.
          offset.jump(offset.get(), velocity);
          offset.set(target);
        },
      });

      let index = 2;
      const cycle = stage.querySelector('[data-cycle]');
      cycle.addEventListener('click', () => {
        index = (index + 1) % 3;
        const snaps = points();
        out.snap.textContent = LABELS[index];
        out.velocity.textContent = '0';
        out.projected.textContent = snaps[index].toFixed(0);
        offset.set(snaps[index]);
      });

      return {
        destroy() {
          detach();
          offset.stop();
        },
      };
    },
  },

  {
    id: 'side-drawer',
    title: 'Side drawer that pushes content',
    summary:
      'The page inherits a fraction of the drawer’s travel. One scalar drives drawer position, page displacement, and scrim opacity — so they can never fall out of sync.',
    chips: ['parenting', 'differential travel', 'edge swipe'],
    hint: 'Drag the page from the left edge, or tap',
    stage: { tall: true },
    prompt: `Build a React <Drawer> that displaces the page content as it opens.

One scalar, three consumers
- Drive everything from a single normalised "open" value, 0 (closed) to
  1 (open). Derive:
    drawer translateX = (open - 1) * drawerWidth
    page   translateX = open * drawerWidth * 0.55      <- differential
    scrim  opacity    = open * 0.45
- Deriving all three from one value is the whole point. Three independent
  animations with matching durations WILL drift apart the moment one is
  interrupted, and the drift is visible as the scrim finishing before the panel.
- The 0.55 multiplier is what sells depth: the page travelling slower than the
  drawer reads as the drawer sliding over a surface that is being pushed,
  rather than as two panels rigidly glued together.

Gesture
- Support edge-swipe: pointerdown within ~24px of the left edge starts an
  opening drag. Anywhere else on the page should not begin a drawer gesture, or
  every horizontal scroll in the content fights the drawer.
- Convert pointer delta to normalised units: open = base + delta / drawerWidth.
  Clamp to [0, 1] with rubberBand resistance past both ends.
- Release: project with momentum, then snap to whichever of 0 or 1 the
  projection is closer to. Velocity above ~500px/s should force the direction
  it was thrown, even against position.

Motion
- Spring preset gentle (stiffness 120 / damping 22). Surfaces this size should
  not overshoot.
- Under prefers-reduced-motion: reduce, cross-fade instead of sliding, and skip
  the page displacement entirely.

Accessibility
- role="dialog" aria-modal="true"; trap focus while open; Escape closes;
  return focus to the trigger. Mark the page content aria-hidden while open.`,
    code: `import { useRef } from 'react';
import { useSpringValue } from './hooks';
import { clamp, rubberBand, projectMomentum, SpringPresets } from './motion-core';

const WIDTH = 280;
const PAGE_RATIO = 0.55;   // page travels slower than the drawer -> depth
const EDGE_ZONE = 24;      // px from the left edge that can start a drag

export function Drawer({ open, onOpenChange, children, page }: DrawerProps) {
  const drawer = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const base = useRef(0);

  // ONE scalar. Every visual property is derived from it, so they cannot drift.
  const value = useSpringValue(open ? 1 : 0, {
    ...SpringPresets.gentle,
    onChange: (v) => {
      drawer.current!.style.transform  = 'translateX(' + (v - 1) * WIDTH + 'px)';
      surface.current!.style.transform = 'translateX(' + v * WIDTH * PAGE_RATIO + 'px)';
      scrim.current!.style.opacity     = String(v * 0.45);
      scrim.current!.style.pointerEvents = v > 0.02 ? 'auto' : 'none';
    },
  });

  const onPointerDown = (e: React.PointerEvent) => {
    const fromEdge = e.clientX - e.currentTarget.getBoundingClientRect().left;
    if (value.get() < 0.5 && fromEdge > EDGE_ZONE) return;   // don't hijack content drags
    e.currentTarget.setPointerCapture(e.pointerId);
    base.current = value.get();
    value.stop();
  };

  const onPointerMove = (e: React.PointerEvent, delta: number) => {
    const next = base.current + delta / WIDTH;
    value.jump(
      next < 0 ? rubberBand(next, 1) : next > 1 ? 1 + rubberBand(next - 1, 1) : next,
    );
  };

  const onPointerUp = (velocity: number) => {
    const projected = value.get() + projectMomentum(velocity, 0.99) / WIDTH;
    // Velocity wins over position when the throw is decisive.
    const target = Math.abs(velocity) > 500 ? (velocity > 0 ? 1 : 0)
                 : projected > 0.5 ? 1 : 0;
    value.setWithVelocity(target, velocity / WIDTH);
    onOpenChange(target === 1);
  };

  return (/* scrim + drawer + surface, refs wired as above */);
}`,
    notes: `<strong>One scalar, three consumers.</strong> Drawer position, page displacement, and scrim opacity are all read off the same 0→1 value. Animate them independently — even with identical durations — and the first interruption desynchronises them, which shows up as the scrim landing before the panel does.
<ul>
<li><strong>The 0.55 ratio is the depth cue.</strong> Move the page at the drawer's full speed and the two read as one rigid slab. Slower, and the drawer reads as sliding over a surface it is pushing.</li>
<li><strong>Edge zone ≈ 24px.</strong> Without it, every horizontal gesture in the page content fights the drawer for the same pointer stream.</li>
<li><strong>Velocity overrides position.</strong> A decisive throw should win even when the finger let go on the "wrong" side of the midpoint.</li>
</ul>`,
    mount(stage) {
      stage.innerHTML = `
        <div class="d-row" style="gap:22px">
          <div class="d-frame d-draggable">
            <div class="d-drawer-page">
              <div class="d-frame-bar">Dashboard</div>
              <div class="d-frame-body">
                <div class="d-skel-line" style="width:70%"></div>
                <div class="d-skel-line" style="width:88%"></div>
                <div class="d-skel-line" style="width:56%"></div>
                <div class="d-skel-line" style="width:76%"></div>
                <div class="d-skel-line" style="width:64%"></div>
              </div>
            </div>
            <div class="d-scrim" data-scrim style="opacity:0"></div>
            <div class="d-drawer">
              <div class="d-label" style="padding:2px 10px 6px">Navigation</div>
              <div class="d-drawer-item">Overview</div>
              <div class="d-drawer-item">Reports</div>
              <div class="d-drawer-item">Segments</div>
              <div class="d-drawer-item">Settings</div>
            </div>
          </div>
          <div class="d-stack" style="align-items:flex-start;gap:9px">
            <div class="d-readout">open <b data-open>0.00</b></div>
            <div class="d-readout">drawer <b data-dx>-190</b>px</div>
            <div class="d-readout">page <b data-px>0</b>px <span style="opacity:.6">(×0.55)</span></div>
            <div class="d-readout">scrim <b data-sx>0.00</b></div>
            <button class="d-btn d-btn--sm" data-toggle type="button">Toggle drawer</button>
          </div>
        </div>`;

      const frame = stage.querySelector('.d-frame');
      const drawer = stage.querySelector('.d-drawer');
      const page = stage.querySelector('.d-drawer-page');
      const scrim = stage.querySelector('[data-scrim]');
      const out = {
        open: stage.querySelector('[data-open]'),
        dx: stage.querySelector('[data-dx]'),
        px: stage.querySelector('[data-px]'),
        sx: stage.querySelector('[data-sx]'),
      };

      const WIDTH = 190;
      const PAGE_RATIO = 0.55;

      // iOS Safari owns a left-edge swipe for back-navigation, so an edge-zone
      // gesture there is unwinnable — the browser takes it before the page sees
      // it. On coarse pointers accept the drag anywhere on the frame; the demo
      // has no competing horizontal scroll, so nothing is lost.
      const coarse =
        typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
      const EDGE_ZONE = coarse ? Number.POSITIVE_INFINITY : 26;

      // One scalar; everything below is derived from it.
      const value = createSpringValue(0, {
        ...SpringPresets.gentle,
        onChange(v) {
          const dx = (v - 1) * WIDTH;
          const px = v * WIDTH * PAGE_RATIO;
          drawer.style.transform = `translateX(${dx}px)`;
          page.style.transform = `translateX(${px}px)`;
          scrim.style.opacity = String(v * 0.45);

          out.open.textContent = v.toFixed(2);
          out.dx.textContent = dx.toFixed(0);
          out.px.textContent = px.toFixed(0);
          out.sx.textContent = (v * 0.45).toFixed(2);
        },
      });
      value.jump(0);

      let base = 0;
      let dragging = false;

      const detach = createDragGesture(frame, {
        axis: 'x',
        onStart() {
          dragging = false;
        },
        onMove(delta) {
          if (!dragging) dragging = true;
          const next = base + delta / WIDTH;
          value.jump(
            next < 0
              ? rubberBand(next, 1)
              : next > 1
                ? 1 + rubberBand(next - 1, 1)
                : next,
          );
        },
        onEnd(delta, velocity) {
          if (!dragging) return;
          dragging = false;
          const projected = value.get() + projectMomentum(velocity, 0.99) / WIDTH;
          const target =
            Math.abs(velocity) > 500 ? (velocity > 0 ? 1 : 0) : projected > 0.5 ? 1 : 0;
          value.jump(value.get(), velocity / WIDTH);
          value.set(target);
        },
      });

      // Only start an opening drag from the edge — otherwise content drags fight it.
      frame.addEventListener(
        'pointerdown',
        (event) => {
          const fromEdge = event.clientX - frame.getBoundingClientRect().left;
          if (value.get() < 0.5 && fromEdge > EDGE_ZONE) {
            dragging = false;
            return;
          }
          base = value.get();
          value.stop();
        },
        true,
      );

      stage.querySelector('[data-toggle]').addEventListener('click', () => {
        value.set(value.get() > 0.5 ? 0 : 1);
      });

      return {
        destroy() {
          detach();
          value.stop();
        },
      };
    },
  },

  {
    id: 'pull-refresh',
    title: 'Pull to refresh',
    summary:
      'Resistance builds as you pull, the spinner’s rotation and opacity are read off pull distance, and crossing the threshold commits — releasing short of it snaps back with nothing fired.',
    chips: ['resistance', 'threshold', 'derived spinner'],
    hint: 'Drag the list downward',
    stage: { tall: true },
    prompt: `Build pull-to-refresh with resistance and a committed threshold.

Pull phase
- Downward drag past scrollTop === 0 only. If the list is scrolled, the gesture
  belongs to the scroller — check first or you will hijack normal scrolling.
- Apply rubberBand(delta, containerHeight) so pulling gets progressively
  harder. Constant 1:1 tracking gives no sense of approaching a limit.
- Derive spinner state from pull distance, not from a timer:
    opacity  = clamp(pull / threshold, 0, 1)
    rotation = (pull / threshold) * 270 degrees
    scale    = 0.6 + 0.4 * clamp(pull / threshold, 0, 1)
  The user should be able to see how close they are to committing, and be able
  to back out by pulling back up. A spinner that appears on a timer removes
  that feedback.

Commit
- Threshold ~64px of RESISTED travel. Fire a haptic/visual tick the moment it
  is crossed, while the finger is still down. Committing silently at release
  means the user never learns where the line is.
- On release past threshold: spring to a holding offset (~52px), run the async
  work, then spring back to 0 on completion.
- On release short of threshold: spring straight back to 0, fire nothing.
- While holding, drive continuous spinner rotation from the shared frame clock.
  This is the one place linear easing is correct - a spinner that eases would
  visibly stutter at each revolution's seam.

Reduced motion: skip the rotation, show a static indicator, keep the threshold
behaviour intact.`,
    code: `import { useRef, useState } from 'react';
import { clamp, rubberBand, onFrame, prefersReducedMotion } from './motion-core';
import { useSpringValue } from './hooks';

const THRESHOLD = 64;
const HOLD = 52;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const inner = useRef<HTMLDivElement>(null);
  const spinner = useRef<HTMLDivElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const committed = useRef(false);

  const pull = useSpringValue(0, {
    stiffness: 200, damping: 26,
    onChange: (y) => {
      inner.current!.style.transform = 'translateY(' + y + 'px)';
      // Spinner state is DERIVED from pull distance, so backing out is visible.
      const p = clamp(y / THRESHOLD, 0, 1);
      const s = spinner.current!.style;
      s.opacity = String(p);
      s.transform = 'rotate(' + p * 270 + 'deg) scale(' + (0.6 + 0.4 * p) + ')';
    },
  });

  const onMove = (delta: number, scrollTop: number) => {
    if (scrollTop > 0 || delta <= 0) return;      // the scroller owns this gesture
    const resisted = rubberBand(delta, containerHeight);
    pull.jump(resisted);

    // Announce the commit while the finger is still down.
    if (!committed.current && resisted >= THRESHOLD) {
      committed.current = true;
      navigator.vibrate?.(8);
    } else if (committed.current && resisted < THRESHOLD) {
      committed.current = false;
    }
  };

  const onEnd = async () => {
    if (!committed.current) return pull.set(0);   // short of the line: fire nothing
    committed.current = false;
    setRefreshing(true);
    pull.set(HOLD);
    try { await onRefresh(); } finally { setRefreshing(false); pull.set(0); }
  };

  // Continuous rotation while holding — the one correct use of linear easing.
  useEffect(() => {
    if (!refreshing || prefersReducedMotion()) return;
    const start = performance.now();
    return onFrame((now) => {
      spinner.current!.style.transform = 'rotate(' + ((now - start) / 2.5) + 'deg)';
    });
  }, [refreshing]);

  return <div ref={inner}>{children}</div>;
}`,
    notes: `<strong>Derive the spinner from distance, not from a timer.</strong> When rotation and opacity are functions of how far you have pulled, the control tells you how close you are to committing — and lets you back out by pulling back up. A spinner that fades in on a timeout throws that away.
<ul>
<li><strong>Announce the commit while the finger is down.</strong> Crossing the threshold should tick immediately. If it only lands at release, the user never learns where the line is and every pull is a guess.</li>
<li><strong>Check scrollTop first.</strong> Without it, this gesture hijacks ordinary scrolling in the list.</li>
<li><strong>Linear rotation is correct here.</strong> The holding spinner is a continuous carrier — an eased rotation stutters visibly at every revolution seam. It is the exception that proves the rule.</li>
</ul>`,
    mount(stage) {
      stage.innerHTML = `
        <div class="d-row" style="gap:22px">
          <div class="d-frame d-draggable">
            <div class="d-frame-bar">Inbox</div>
            <div class="d-pr-spinner"></div>
            <div class="d-pr-scroll">
              <div class="d-pr-inner">
                <div class="d-frame-body">
                  <div class="d-skel-line" style="width:82%"></div>
                  <div class="d-skel-line" style="width:66%"></div>
                  <div class="d-skel-line" style="width:90%"></div>
                  <div class="d-skel-line" style="width:74%"></div>
                  <div class="d-skel-line" style="width:58%"></div>
                  <div class="d-skel-line" style="width:86%"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="d-stack" style="align-items:flex-start;gap:9px">
            <div class="d-readout">raw pull <b data-raw>0</b>px</div>
            <div class="d-readout">resisted <b data-res>0</b>px</div>
            <div class="d-readout">progress <b data-prog>0%</b></div>
            <div class="d-readout">state <b data-state>idle</b></div>
            <div class="d-label" style="max-width:150px;line-height:1.5">threshold 64px · hold 52px</div>
          </div>
        </div>`;

      const scroller = stage.querySelector('.d-pr-scroll');
      const inner = stage.querySelector('.d-pr-inner');
      const spinner = stage.querySelector('.d-pr-spinner');
      const out = {
        raw: stage.querySelector('[data-raw]'),
        res: stage.querySelector('[data-res]'),
        prog: stage.querySelector('[data-prog]'),
        state: stage.querySelector('[data-state]'),
      };

      const THRESHOLD = 64;
      const HOLD = 52;
      let committed = false;
      let refreshing = false;
      let stopSpin = null;
      let holdTimer = null;

      const pull = createSpringValue(0, {
        mass: 1,
        stiffness: 200,
        damping: 26,
        onChange(y) {
          inner.style.transform = `translateY(${y}px)`;
          if (refreshing) return;

          // Spinner state derived from pull distance.
          const p = clamp(y / THRESHOLD, 0, 1);
          spinner.style.opacity = String(p);
          spinner.style.transform = `rotate(${p * 270}deg) scale(${0.6 + 0.4 * p})`;
          out.res.textContent = y.toFixed(0);
          out.prog.textContent = `${Math.round(p * 100)}%`;
        },
      });

      const detach = createDragGesture(scroller, {
        axis: 'y',
        onStart() {
          pull.stop();
          committed = false;
        },
        onMove(delta) {
          if (refreshing || delta <= 0) return;
          const resisted = rubberBand(delta, 200);
          out.raw.textContent = delta.toFixed(0);
          pull.jump(resisted);

          if (!committed && resisted >= THRESHOLD) {
            committed = true;
            out.state.textContent = 'release to refresh';
            navigator.vibrate?.(8);
          } else if (committed && resisted < THRESHOLD) {
            committed = false;
            out.state.textContent = 'pull further';
          } else if (!committed) {
            out.state.textContent = 'pulling';
          }
        },
        onEnd() {
          if (refreshing) return;
          if (!committed) {
            out.state.textContent = 'idle';
            out.raw.textContent = '0';
            pull.set(0);
            return;
          }

          committed = false;
          refreshing = true;
          out.state.textContent = 'refreshing';
          pull.set(HOLD);
          spinner.style.opacity = '1';

          if (!prefersReducedMotion()) {
            const start = performance.now();
            stopSpin = onFrame((now) => {
              spinner.style.transform = `rotate(${(now - start) / 2.5}deg)`;
            });
          }

          holdTimer = setTimeout(() => {
            stopSpin?.();
            stopSpin = null;
            refreshing = false;
            out.state.textContent = 'idle';
            out.raw.textContent = '0';
            spinner.style.opacity = '0';
            pull.set(0);
          }, 1400);
        },
      });

      return {
        destroy() {
          detach();
          stopSpin?.();
          clearTimeout(holdTimer);
          pull.stop();
        },
      };
    },
  },
];
