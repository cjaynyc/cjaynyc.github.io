import { Easing, SpringPresets, animateValue, createSpringValue, prefersReducedMotion } from '../engine.js';

export const category = {
  id: 'press',
  index: '01',
  title: 'Click & press states',
  blurb:
    'The first 100ms after a pointer goes down is the only window you get to prove the interface is alive. These are the primitives that fill it — press depth, ripple origin, thumb travel, cursor attraction.',
};

export const entries = [
  {
    id: 'press-depth',
    title: 'Spring press depth',
    summary:
      'Scale and depth driven by an interruptible spring. Release carries the compression velocity into the rebound, so a fast tap overshoots and a slow press settles flat.',
    chips: ['spring', 'pointer + keyboard', 'snappy'],
    hint: 'Press and hold',
    prompt: `Build a React <Pressable> component for click/press feedback.

Physics
- Drive a single normalised "press" scalar from 0 (released) to 1 (held) with a
  closed-form damped harmonic oscillator, not a CSS transition. Preset: mass 1,
  stiffness 260, damping 26 (zeta ~ 0.81, lightly underdamped).
- Retargeting mid-flight must carry the CURRENT velocity into the new solve. A
  fast tap that releases before the press settles should rebound past 1.0 and
  overshoot; a slow deliberate press should return flat. This continuity is the
  entire effect - do not restart the spring from zero velocity on release.
- Map the scalar: scale = 1 - 0.06 * press, translateY = 1.5px * press.
  Never animate width/height or box-shadow spread; transform only, so the work
  stays on the compositor.

Behaviour
- Bind pointerdown/pointerup/pointercancel AND keydown/keyup for Space and
  Enter, so keyboard activation gets identical feedback.
- Release the press on blur and on pointerleave-while-held, or a drag off the
  button leaves it stuck compressed.
- Use setPointerCapture so the release is still received if the cursor exits.

Accessibility
- Render a real <button>. Do not reimplement activation on a div.
- Under prefers-reduced-motion: reduce, snap the scalar instead of animating.
  Keep the state change visible - remove the motion, not the feedback.

Expose: children, onPress, disabled, className, and a "depth" prop (0-1)
scaling the compression so dense toolbars can dial it down.`,
    code: `import { useCallback, useRef } from 'react';
import { useSpringValue } from './hooks';
import { SpringPresets } from './motion-core';

export function Pressable({ children, onPress, depth = 1, ...rest }: PressableProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const held = useRef(false);

  // 0 = released, 1 = fully compressed. One scalar drives every mapped property.
  const press = useSpringValue(0, {
    ...SpringPresets.snappy,
    onChange: (v) => {
      const node = ref.current;
      if (!node) return;
      node.style.transform =
        'scale(' + (1 - 0.06 * depth * v) + ') translateY(' + 1.5 * depth * v + 'px)';
    },
  });

  const engage = useCallback(() => {
    held.current = true;
    press.set(1);
  }, [press]);

  // Retarget to 0 while the spring is still travelling toward 1 — the solver
  // hands its current velocity to the new solve, which is what produces the
  // rebound overshoot on a fast tap.
  const release = useCallback(() => {
    if (!held.current) return;
    held.current = false;
    press.set(0);
  }, [press]);

  return (
    <button
      ref={ref}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        engage();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onBlur={release}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) engage();
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') release();
      }}
      onClick={onPress}
      {...rest}
    >
      {children}
    </button>
  );
}`,
    notes: `<strong>Why a spring and not a transition.</strong> A CSS transition restarts from zero velocity every time its target changes. Tap fast enough and you get a visible hitch at the turnaround, because the element is moving one way and the new transition pretends it is stationary. The closed-form solver hands the live velocity to the next solve, so the reversal is continuous.
<ul>
<li><strong>zeta ≈ 0.81</strong> — underdamped enough to overshoot on release, damped enough that it never reads as wobbly.</li>
<li><strong>Transform only.</strong> Scale and translate are compositor properties. Animating <code>box-shadow</code> or <code>height</code> here forces layout or paint on every frame.</li>
<li><strong>Keyboard parity.</strong> Space/Enter drive the same scalar, so the button does not feel dead to keyboard users.</li>
</ul>`,
    mount(stage) {
      stage.innerHTML = `
        <div class="d-stack">
          <button class="d-btn d-btn--accent d-press" type="button">Press and hold</button>
          <div class="d-readout">
            scale <b data-scale>1.000</b> · velocity <b data-vel>0.00</b>/s
          </div>
        </div>`;

      const button = stage.querySelector('.d-press');
      const scaleOut = stage.querySelector('[data-scale]');
      const velocityOut = stage.querySelector('[data-vel]');
      let held = false;

      const press = createSpringValue(0, {
        ...SpringPresets.snappy,
        onChange(value, velocity) {
          const scale = 1 - 0.06 * value;
          button.style.transform = `scale(${scale}) translateY(${1.5 * value}px)`;
          scaleOut.textContent = scale.toFixed(3);
          velocityOut.textContent = velocity.toFixed(2);
        },
      });

      const engage = () => {
        held = true;
        press.set(1);
      };
      const release = () => {
        if (!held) return;
        held = false;
        press.set(0);
      };

      button.addEventListener('pointerdown', (event) => {
        button.setPointerCapture(event.pointerId);
        engage();
      });
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('blur', release);
      button.addEventListener('keydown', (event) => {
        if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) engage();
      });
      button.addEventListener('keyup', (event) => {
        if (event.key === ' ' || event.key === 'Enter') release();
      });

      return { destroy: () => press.stop() };
    },
  },

  {
    id: 'ripple',
    title: 'Origin-anchored ripple',
    summary:
      'The ripple starts where the pointer actually landed and expands to cover the furthest corner. Scale decelerates while opacity accelerates, so the wave outruns its own fade.',
    chips: ['masking', 'decelerate', 'pointer origin'],
    hint: 'Click anywhere on the button',
    prompt: `Build a React <Ripple> surface that emits a material-style ripple from the
exact pointer contact point.

Geometry (this is the part most implementations get wrong)
- On pointerdown, read the bounding rect and compute the contact point in
  LOCAL coordinates: x = clientX - rect.left, y = clientY - rect.top.
- The ripple must reach the furthest corner, so its final radius is the max
  distance from the contact point to each of the four corners:
    r = max(hypot(x, y), hypot(w - x, y), hypot(x, h - y), hypot(w - x, h - y))
  Using half the width is the common shortcut and it visibly fails on wide
  buttons and on off-centre clicks.

Motion
- Scale 0 -> 1 over 520ms on a decelerate curve, cubic-bezier(0, 0, 0.2, 1).
- Opacity 0.28 -> 0 over 480ms on an accelerate curve, cubic-bezier(0.4, 0, 1, 1).
  Running the fade FASTER than the expansion is what makes the wave read as
  spreading outward rather than as a growing blob.
- Each press spawns an independent ripple. Do not pool or cancel in-flight
  ripples; overlapping ripples from rapid clicks are correct.
- Remove each node on completion.

Containment
- The host needs position: relative, overflow: hidden and isolation: isolate.
- The ripple element is absolutely positioned, transform-origin centre, and
  translated by -50%/-50% so its own centre lands on the contact point.

Accessibility
- Under prefers-reduced-motion: reduce, skip the ripple entirely and use a
  single 90ms background tint instead.`,
    code: `import { useCallback, useRef } from 'react';
import { Easing, animateValue, prefersReducedMotion } from './motion-core';

export function Ripple({ children, ...rest }: RippleProps) {
  const host = useRef<HTMLButtonElement>(null);

  const spawn = useCallback((e: React.PointerEvent) => {
    const node = host.current;
    if (!node || prefersReducedMotion()) return;

    const rect = node.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Furthest corner — not half the width.
    const radius = Math.max(
      Math.hypot(x, y),
      Math.hypot(rect.width - x, y),
      Math.hypot(x, rect.height - y),
      Math.hypot(rect.width - x, rect.height - y),
    );

    const ink = document.createElement('span');
    ink.className = 'ripple';
    ink.style.left = x + 'px';
    ink.style.top = y + 'px';
    ink.style.width = ink.style.height = radius * 2 + 'px';
    node.appendChild(ink);

    animateValue({
      from: 0, to: 1, duration: 520, easing: Easing.decelerate,
      onUpdate: (v) => { ink.style.transform = 'translate(-50%, -50%) scale(' + v + ')'; },
    });

    // Fade finishes first, so the edge outruns the opacity.
    animateValue({
      from: 0.28, to: 0, duration: 480, easing: Easing.accelerate,
      onUpdate: (v) => { ink.style.opacity = String(v); },
      onComplete: () => ink.remove(),
    });
  }, []);

  return <button ref={host} onPointerDown={spawn} {...rest}>{children}</button>;
}`,
    notes: `<strong>The radius formula is the whole trick.</strong> A ripple sized to half the button width looks fine dead-centre on a square target and obviously wrong everywhere else — click near an edge of a wide button and the wave stops short of the far side.
<ul>
<li><strong>Fade beats expansion.</strong> 480ms opacity against 520ms scale. Equal durations make the ripple read as a disc that vanishes rather than a wave that spreads.</li>
<li><strong>No pooling.</strong> Rapid clicks should stack ripples. Cancelling the previous one makes the surface feel like it is dropping input.</li>
<li><strong>Reduced motion</strong> gets a flat tint — the feedback survives, the travel does not.</li>
</ul>`,
    mount(stage) {
      stage.innerHTML = `
        <div class="d-stack">
          <button class="d-btn d-ripple-btn" type="button" style="min-width:230px;padding:18px 26px">
            Click near an edge
          </button>
          <div class="d-readout">radius reaches the furthest corner</div>
        </div>`;

      const button = stage.querySelector('.d-ripple-btn');

      button.addEventListener('pointerdown', (event) => {
        const rect = button.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (prefersReducedMotion()) {
          button.style.backgroundColor = 'var(--surface-3)';
          setTimeout(() => (button.style.backgroundColor = ''), 90);
          return;
        }

        const radius = Math.max(
          Math.hypot(x, y),
          Math.hypot(rect.width - x, y),
          Math.hypot(x, rect.height - y),
          Math.hypot(rect.width - x, rect.height - y),
        );

        const ink = document.createElement('span');
        ink.className = 'd-ripple';
        ink.style.left = `${x}px`;
        ink.style.top = `${y}px`;
        ink.style.width = ink.style.height = `${radius * 2}px`;
        button.appendChild(ink);

        animateValue({
          from: 0,
          to: 1,
          duration: 520,
          easing: Easing.decelerate,
          onUpdate: (v) => {
            ink.style.transform = `translate(-50%, -50%) scale(${v})`;
          },
        });

        animateValue({
          from: 0.28,
          to: 0,
          duration: 480,
          easing: Easing.accelerate,
          onUpdate: (v) => {
            ink.style.opacity = String(v);
          },
          onComplete: () => ink.remove(),
        });
      });
    },
  },

  {
    id: 'toggle',
    title: 'Toggle with thumb travel',
    summary:
      'Thumb position is a spring, track colour is a transition. Splitting them lets the thumb overshoot slightly while the colour stays clean.',
    chips: ['spring', 'aria-checked', 'gentle'],
    hint: 'Click to toggle',
    prompt: `Build a React <Toggle> switch.

Split the motion across two systems on purpose:
- THUMB position: spring, mass 1 / stiffness 260 / damping 26. It should
  overshoot its destination by a hair and settle. Interruptible - toggling
  rapidly must carry velocity, never restart from rest.
- TRACK colour: a plain 200ms CSS transition on background-color.
  Do not spring a colour. Overshooting a colour channel produces an
  out-of-gamut flash on the way past, and nobody reads that as bounce.

Geometry
- Thumb travel = trackWidth - thumbWidth - 2 * inset. Compute it, do not
  hardcode a pixel value, or the switch breaks at a different size.
- Drive with translateX only.

Semantics
- Render <button role="switch" aria-checked={on}>. The label must be associated
  via aria-labelledby or an enclosing <label>.
- Space and Enter both toggle (a real <button> gives you this).

Reduced motion: snap the thumb, keep the colour transition.`,
    code: `import { useRef, useState } from 'react';
import { useSpringValue } from './hooks';
import { SpringPresets } from './motion-core';

export function Toggle({ checked, onChange, label }: ToggleProps) {
  const thumb = useRef<HTMLSpanElement>(null);
  const [travel, setTravel] = useState(0);

  // Measured, not hardcoded — the switch has to survive a size change.
  const measure = (track: HTMLButtonElement | null) => {
    if (!track) return;
    const t = track.firstElementChild as HTMLElement;
    setTravel(track.clientWidth - t.offsetWidth - t.offsetLeft * 2);
  };

  useSpringValue(checked ? 1 : 0, {
    ...SpringPresets.snappy,
    onChange: (v) => {
      if (thumb.current) thumb.current.style.transform = 'translateX(' + v * travel + 'px)';
    },
  });

  return (
    <button
      ref={measure}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle"          // background-color: 200ms transition, not a spring
      onClick={() => onChange(!checked)}
    >
      <span ref={thumb} className="toggle-thumb" />
    </button>
  );
}`,
    notes: `<strong>Never spring a colour.</strong> An underdamped spring overshoots its target — fine for position, wrong for a colour channel, where overshoot means travelling past the destination hue and back. It reads as a flicker, not as bounce. Position springs; colour transitions.
<ul>
<li><strong>Travel is measured.</strong> <code>trackWidth − thumbWidth − 2·inset</code>. Hardcoding the offset means the switch silently breaks the first time someone resizes it.</li>
<li><strong>role="switch"</strong> with <code>aria-checked</code> — a styled checkbox or a bare div both lose the announced state.</li>
</ul>`,
    mount(stage) {
      stage.innerHTML = `
        <div class="d-stack">
          <div class="d-row">
            <button class="d-toggle" role="switch" aria-checked="false" aria-label="Demo switch">
              <span class="d-toggle-thumb"></span>
            </button>
            <span class="d-readout">offset <b data-x>0.0</b>px</span>
          </div>
          <div class="d-label">position springs · colour transitions</div>
        </div>`;

      const track = stage.querySelector('.d-toggle');
      const thumb = stage.querySelector('.d-toggle-thumb');
      const readout = stage.querySelector('[data-x]');
      let checked = false;

      // Measured travel, so the geometry survives a restyle.
      const travel = () => track.clientWidth - thumb.offsetWidth - thumb.offsetLeft * 2;

      const position = createSpringValue(0, {
        ...SpringPresets.snappy,
        onChange(value) {
          const x = value * travel();
          thumb.style.transform = `translateX(${x}px)`;
          readout.textContent = x.toFixed(1);
        },
      });

      track.addEventListener('click', () => {
        checked = !checked;
        track.setAttribute('aria-checked', String(checked));
        position.set(checked ? 1 : 0);
      });

      return { destroy: () => position.stop() };
    },
  },

  {
    id: 'magnetic',
    title: 'Magnetic cursor attraction',
    summary:
      'The target leans toward the cursor inside a falloff radius and springs home on exit. Attraction is capped well below the pointer delta so the button never chases the cursor.',
    chips: ['spring', 'falloff', 'pointer tracking'],
    hint: 'Move the cursor into the dashed field',
    prompt: `Build a React <Magnetic> wrapper that pulls its child toward the cursor.

Field math
- Track pointermove on a FIELD element larger than the child, not on the child
  itself. Binding to the child means the effect can only start once the cursor
  is already on top of it, which defeats the purpose.
- Compute the delta from the child's centre to the cursor. Apply linear
  falloff: strength = clamp(1 - distance / radius, 0, 1).
- Offset = delta * strength * pull, where pull is around 0.28. Keep it well
  under 1.0 - at 1.0 the element sits under the cursor and the effect reads as
  a bug rather than as attraction.
- Cap the absolute offset (about 14px) so a large field cannot fling the child
  far from its layout position.

Motion
- Feed the offset into a spring (mass 1 / stiffness 180 / damping 20) rather
  than assigning transform directly from pointermove. Raw assignment tracks
  pointer jitter one-to-one and looks nervous; the spring smooths it and gives
  you the return-home animation for free.
- On pointerleave, target 0,0. The same spring handles it.

Cost control
- pointermove fires at display rate. Do the arithmetic in the handler but write
  the transform from the spring's frame callback only.
- Skip the whole effect when (pointer: coarse) matches - there is no hover on
  touch, and the handlers are pure overhead.
- Disable under prefers-reduced-motion: reduce.`,
    code: `import { useEffect, useRef } from 'react';
import { useSpringValue } from './hooks';

export function Magnetic({ children, radius = 120, pull = 0.28, max = 14 }: MagneticProps) {
  const field = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });

  const x = useSpringValue(0, { stiffness: 180, damping: 20, onChange: write });
  const y = useSpringValue(0, { stiffness: 180, damping: 20, onChange: write });

  function write() {
    if (target.current) {
      target.current.style.transform = 'translate(' + x.get() + 'px, ' + y.get() + 'px)';
    }
  }

  useEffect(() => {
    const node = field.current;
    if (!node || matchMedia('(pointer: coarse)').matches) return;

    const onMove = (e: PointerEvent) => {
      const r = target.current!.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const strength = Math.max(0, 1 - Math.hypot(dx, dy) / radius);

      pos.current = {
        x: clamp(dx * strength * pull, -max, max),
        y: clamp(dy * strength * pull, -max, max),
      };
      x.set(pos.current.x);
      y.set(pos.current.y);
    };

    const onLeave = () => { x.set(0); y.set(0); };

    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerleave', onLeave);
    return () => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerleave', onLeave);
    };
  }, [radius, pull, max, x, y]);

  return <div ref={field}><div ref={target}>{children}</div></div>;
}`,
    notes: `<strong>Spring the offset, don't assign it.</strong> Writing <code>transform</code> straight from <code>pointermove</code> reproduces every tremor in the pointer stream. Routing it through a spring low-passes the jitter and gives you the return-to-origin for free — one mechanism, two behaviours.
<ul>
<li><strong>pull ≈ 0.28.</strong> Above ~0.5 the element starts sitting under the cursor, which reads as a positioning bug.</li>
<li><strong>The field is bigger than the child.</strong> Attraction has to begin before the cursor arrives, or there is nothing to attract.</li>
<li><strong>Coarse pointers skip it.</strong> No hover state on touch — the listeners would be pure cost.</li>
</ul>`,
    mount(stage) {
      // No hover on touch, so the effect would look dead. On coarse pointers
      // the same maths runs off a drag instead — the falloff is the point, and
      // it reads identically whether the cursor or a finger supplies the position.
      const coarse =
        typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

      stage.innerHTML = `
        <div class="d-stack">
          <div class="d-mag-field d-draggable">
            <button class="d-btn d-mag-btn" type="button">Get in touch</button>
          </div>
          <div class="d-readout">offset <b data-mag>0.0, 0.0</b> · strength <b data-str>0.00</b></div>
          <div class="d-label">${
            coarse ? 'drag inside the field — no hover on touch' : 'linear falloff · pull 0.28 · cap 14px'
          }</div>
        </div>`;

      const field = stage.querySelector('.d-mag-field');
      const button = stage.querySelector('.d-mag-btn');
      const offsetOut = stage.querySelector('[data-mag]');
      const strengthOut = stage.querySelector('[data-str]');

      const RADIUS = 130;
      const PULL = 0.28;
      const MAX = 14;

      const write = () => {
        button.style.transform = `translate(${x.get()}px, ${y.get()}px)`;
        offsetOut.textContent = `${x.get().toFixed(1)}, ${y.get().toFixed(1)}`;
      };

      const x = createSpringValue(0, { mass: 1, stiffness: 180, damping: 20, onChange: write });
      const y = createSpringValue(0, { mass: 1, stiffness: 180, damping: 20, onChange: write });

      const onMove = (event) => {
        const rect = button.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const strength = Math.max(0, 1 - Math.hypot(dx, dy) / RADIUS);

        strengthOut.textContent = strength.toFixed(2);
        x.set(Math.max(-MAX, Math.min(MAX, dx * strength * PULL)));
        y.set(Math.max(-MAX, Math.min(MAX, dy * strength * PULL)));
      };

      const onLeave = () => {
        strengthOut.textContent = '0.00';
        x.set(0);
        y.set(0);
      };

      field.addEventListener('pointermove', onMove);
      field.addEventListener('pointerleave', onLeave);

      return {
        destroy() {
          field.removeEventListener('pointermove', onMove);
          field.removeEventListener('pointerleave', onLeave);
          x.stop();
          y.stop();
        },
      };
    },
  },
];
