import {
  Easing,
  SpringPresets,
  animateValue,
  clamp,
  createDragGesture,
  createSpringValue,
  onFrame,
  prefersReducedMotion,
  projectMomentum,
  springAt,
  stagger,
} from '../engine.js';

/**
 * Safari still needs the -webkit- prefix for backdrop-filter, and the
 * unprefixed property alone silently does nothing there — the scrim dims but
 * never blurs, which quietly drops the obscuration cue on every iOS device.
 */
function setBlur(node, radius) {
  const value = `blur(${radius}px)`;
  node.style.backdropFilter = value;
  node.style.webkitBackdropFilter = value;
}

export const category = {
  id: 'prompts',
  index: '04',
  title: 'Prompts & overlays',
  blurb:
    'Everything that interrupts. The motion has one job — say where this thing came from and how much it wants your attention — and then get out of the way of the decision it is asking for.',
};

export const entries = [
  {
    id: 'dialog',
    title: 'Dialog with backdrop ramp',
    summary:
      'Scale and backdrop blur come off one progress value. Entry decelerates, exit accelerates and runs shorter — leaving should never cost as much attention as arriving.',
    chips: ['focus trap', 'asymmetric', 'obscuration'],
    hint: 'Open, then press Escape',
    stage: { tall: true },
    prompt: `Build a React <Dialog> (modal) with a backdrop.

Asymmetric timing - this is the part people skip
- ENTER: 240ms, decelerate cubic-bezier(0, 0, 0.2, 1). Scale 0.94 -> 1,
  opacity 0 -> 1.
- EXIT: 160ms, accelerate cubic-bezier(0.4, 0, 1, 1). Scale 1 -> 0.97,
  opacity 1 -> 0.
- Exits must be shorter and sharper than entries. An arriving dialog is asking
  for attention and can afford the frames; a leaving one has already been dealt
  with, and making the user watch it leave at entry speed feels like the app is
  arguing with the decision.
- Do NOT scale from 0.5 or below. Large scale deltas on a big surface read as
  the dialog flying at the camera. 0.94 is enough to imply arrival.

Backdrop
- opacity 0 -> 0.45 AND backdrop-filter blur(0 -> 8px), both driven from the
  same progress scalar as the panel. Blur is the obscuration cue that says the
  content behind is unreachable, not merely dimmed.
- Gate the blur on a capability check; backdrop-filter is expensive on low-end
  hardware and animating it can drop frames. Fall back to opacity alone.
- Set BOTH backdropFilter and webkitBackdropFilter. Safari still requires the
  prefix, and setting only the standard property fails silently there - the
  scrim dims but never blurs, so every iOS user loses the obscuration cue with
  no error to tell you.

Focus management (non-negotiable)
- On open: store document.activeElement, move focus to the dialog.
- Trap Tab and Shift+Tab within the dialog's focusable set. Wrap at both ends.
- Escape closes. Clicking the backdrop closes; clicking the panel must not
  (check event.target === backdrop, do not rely on stopPropagation).
- On close: restore focus to the stored element. Skipping this drops keyboard
  users at the top of the document.
- role="dialog" aria-modal="true" plus aria-labelledby pointing at the title.

Reduced motion: cross-fade only, no scale, no blur ramp.`,
    code: `import { useEffect, useRef } from 'react';
import { Easing, animateValue, prefersReducedMotion } from './motion-core';

const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement;
    panel.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab') return;

      // Trap: wrap at both ends of the focusable set.
      const items = [...panel.current!.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreTo.current?.focus();       // never strand the keyboard user
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const reduced = prefersReducedMotion();
    animateValue({
      from: 0, to: 1,
      duration: 240, easing: Easing.decelerate,          // enter: generous
      onUpdate: (p) => {
        panel.current!.style.opacity = String(p);
        panel.current!.style.transform = reduced ? '' : 'scale(' + (0.94 + 0.06 * p) + ')';
        backdrop.current!.style.opacity = String(p * 0.45);
        // Safari needs the -webkit- prefix; unprefixed alone silently no-ops
        // there, so the scrim dims but never blurs on every iOS device.
        if (!reduced) {
          const blur = 'blur(' + p * 8 + 'px)';
          backdrop.current!.style.backdropFilter = blur;
          backdrop.current!.style.webkitBackdropFilter = blur;
        }
      },
    });
  }, [open]);

  // Exit runs at 160ms on Easing.accelerate — shorter and sharper than enter.
  return open ? (
    <div ref={backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="dlg-title" tabIndex={-1}>
        <h2 id="dlg-title">{title}</h2>
        {children}
      </div>
    </div>
  ) : null;
}`,
    notes: `<strong>Entries and exits are not the same animation played backwards.</strong> 240ms in on a decelerate curve, 160ms out on an accelerate curve. An arriving dialog is asking for attention and has earned the frames. A leaving one has already been dealt with — making the user watch it leave at entry speed feels like the app is second-guessing them.
<ul>
<li><strong>0.94, not 0.5.</strong> A large scale delta on a big surface reads as the panel flying at the camera. Six percent is enough to say "arrived".</li>
<li><strong>Blur is the obscuration cue.</strong> Dimming says less important; blur says unreachable. Gate it on capability — animating <code>backdrop-filter</code> is expensive.</li>
<li><strong>Restore focus on close.</strong> Skip it and every keyboard user lands back at the top of the document with no idea where they were.</li>
</ul>`,
    mount(stage) {
      stage.innerHTML = `
        <div class="d-stack">
          <button class="d-btn d-btn--accent" data-open type="button">Delete workspace</button>
          <div class="d-readout">enter 240ms decelerate · exit 160ms accelerate</div>
        </div>`;

      const trigger = stage.querySelector('[data-open]');
      let overlay = null;
      let cancel = null;
      let onKeyDown = null;

      const FOCUSABLE =
        'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

      function close() {
        if (!overlay) return;
        const node = overlay;
        const panel = node.querySelector('.d-dialog');
        overlay = null;

        document.removeEventListener('keydown', onKeyDown);
        onKeyDown = null;
        cancel?.();

        const reduced = prefersReducedMotion();
        cancel = animateValue({
          from: 1,
          to: 0,
          duration: 160,
          easing: Easing.accelerate,
          onUpdate: (p) => {
            panel.style.opacity = String(p);
            if (!reduced) panel.style.transform = `scale(${0.97 + 0.03 * p})`;
            node.style.opacity = String(p);
            if (!reduced) setBlur(node, p * 8);
          },
          onComplete: () => {
            node.remove();
            trigger.focus();
          },
        });
      }

      function open() {
        if (overlay) return;
        const reduced = prefersReducedMotion();

        overlay = document.createElement('div');
        overlay.className = 'd-dialog-scrim';
        overlay.style.opacity = '0';
        overlay.innerHTML = `
          <div class="d-dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-t" tabindex="-1">
            <h4 id="dlg-t">Delete this workspace?</h4>
            <p>Every project, dashboard and saved segment inside it goes too. This cannot be undone.</p>
            <div class="d-dialog-actions">
              <button class="d-btn d-btn--sm d-btn--ghost" data-cancel type="button">Cancel</button>
              <button class="d-btn d-btn--sm d-btn--accent" data-confirm type="button">Delete</button>
            </div>
          </div>`;
        stage.appendChild(overlay);

        const panel = overlay.querySelector('.d-dialog');
        panel.focus();

        overlay.addEventListener('click', (event) => {
          // Backdrop only — checking the target beats relying on stopPropagation.
          if (event.target === overlay) close();
        });
        overlay.querySelector('[data-cancel]').addEventListener('click', close);
        overlay.querySelector('[data-confirm]').addEventListener('click', close);

        onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            close();
            return;
          }
          if (event.key !== 'Tab' || !overlay) return;

          const items = [...panel.querySelectorAll(FOCUSABLE)];
          if (items.length === 0) return;
          const first = items[0];
          const last = items[items.length - 1];

          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        };
        document.addEventListener('keydown', onKeyDown);

        cancel?.();
        cancel = animateValue({
          from: 0,
          to: 1,
          duration: 240,
          easing: Easing.decelerate,
          onUpdate: (p) => {
            panel.style.opacity = String(p);
            if (!reduced) panel.style.transform = `scale(${0.94 + 0.06 * p})`;
            overlay.style.opacity = String(p);
            if (!reduced) setBlur(overlay, p * 8);
          },
        });
      }

      trigger.addEventListener('click', open);

      return {
        destroy() {
          document.removeEventListener('keydown', onKeyDown ?? (() => {}));
          cancel?.();
          overlay?.remove();
        },
      };
    },
  },

  {
    id: 'toast',
    title: 'Toast stack with swipe dismiss',
    summary:
      'New toasts enter on a spring while the stack makes room. Swipe right to dismiss — past halfway or fast enough, the throw completes itself.',
    chips: ['stagger', 'swipe', 'velocity dismiss'],
    hint: 'Add a few, then swipe one right',
    stage: { tall: true },
    prompt: `Build a React <ToastStack>.

Entry
- Each toast enters with a spring (stiffness 260 / damping 26): translateX from
  +24px, opacity 0 -> 1, scale 0.96 -> 1.
- When several arrive together, stagger by 60ms. Simultaneous entry reads as a
  single block appearing; staggered entry reads as items arriving.
- Existing toasts must animate to their new positions as the stack grows. If
  they jump, the stack looks like it is being rebuilt rather than added to.

Swipe to dismiss
- Horizontal drag with pointer capture. Track velocity over a ~100ms window.
- Dismiss when EITHER the toast has passed ~45% of its width, OR release
  velocity exceeds ~500px/s in the dismiss direction. Distance alone means a
  quick flick that only travels 20px gets snapped back, which feels like the
  gesture was rejected.
- On dismiss: continue in the throw direction, fade to 0, then remove.
  Carry the release velocity in - the exit should look like the finger's throw,
  not like a fresh animation.
- On cancel: spring back to 0 with the release velocity applied.

Collapse
- After a toast is removed, the ones below animate up. Spring, not transition;
  a queue that shifts instantly reads as broken.

Accessibility
- role="status" aria-live="polite" for informational toasts; role="alert" with
  aria-live="assertive" only for errors.
- Auto-dismiss timers must PAUSE on hover and on focus-within. A toast that
  vanishes while being read is worse than no toast.
- Every toast needs a keyboard-reachable dismiss control. Swipe cannot be the
  only way out.`,
    code: `import { useCallback, useRef, useState } from 'react';
import { VelocityTracker, projectMomentum, stagger } from './motion-core';
import { useSpringValue } from './hooks';

const DISMISS_VELOCITY = 500;
const DISMISS_FRACTION = 0.45;

function Toast({ toast, index, onDismiss }: ToastProps) {
  const el = useRef<HTMLDivElement>(null);
  const tracker = useRef(new VelocityTracker(100));

  const x = useSpringValue(24, {
    stiffness: 260, damping: 26,
    onChange: (v) => {
      const w = el.current?.offsetWidth ?? 1;
      el.current!.style.transform = 'translateX(' + v + 'px)';
      // Opacity falls off with distance, so the gesture is reversible mid-swipe.
      el.current!.style.opacity = String(Math.max(0, 1 - Math.abs(v) / w));
    },
  });

  // Staggered entry when several land together.
  useEffect(() => {
    const t = setTimeout(() => x.set(0), stagger(index, 3, { each: 60 }));
    return () => clearTimeout(t);
  }, [index, x]);

  const onEnd = useCallback((velocity: number) => {
    const w = el.current!.offsetWidth;
    const projected = x.get() + projectMomentum(velocity, 0.99);

    // Distance OR velocity — either alone rejects gestures users expect to work.
    if (projected > w * DISMISS_FRACTION || velocity > DISMISS_VELOCITY) {
      x.setWithVelocity(w * 1.2, velocity);
      setTimeout(onDismiss, 180);
    } else {
      x.setWithVelocity(0, velocity);
    }
  }, [x, onDismiss]);

  return (
    <div ref={el} role="status" aria-live="polite">
      {toast.message}
      <button onClick={onDismiss} aria-label="Dismiss">×</button>
    </div>
  );
}`,
    notes: `<strong>Distance or velocity, never distance alone.</strong> A quick flick that only travels 20px is unmistakably a dismiss gesture, and snapping it back reads as the interface rejecting input it clearly understood. Either threshold firing is enough.
<ul>
<li><strong>Opacity tracks distance.</strong> Fading with travel keeps the gesture reversible — drag halfway, change your mind, drag back.</li>
<li><strong>Existing toasts animate to new positions.</strong> If the stack jumps when one is added or removed, it reads as being rebuilt rather than edited.</li>
<li><strong>Pause auto-dismiss on hover and focus-within.</strong> A toast that disappears mid-sentence is worse than one that never appeared.</li>
<li><strong>Swipe is never the only exit.</strong> There has to be a focusable dismiss button.</li>
</ul>`,
    mount(stage) {
      stage.innerHTML = `
        <div class="d-stack">
          <div class="d-row">
            <button class="d-btn d-btn--sm d-btn--accent" data-add type="button">Add toast</button>
            <button class="d-btn d-btn--sm d-btn--ghost" data-burst type="button">Add three</button>
          </div>
          <div class="d-readout">swipe right · past 45% or faster than 500px/s</div>
        </div>
        <div class="d-toast-stack" data-stack></div>`;

      const stack = stage.querySelector('[data-stack]');
      const MESSAGES = [
        'Segment saved',
        'Export queued',
        'Sync complete',
        'Invite sent',
        'Report scheduled',
      ];
      let counter = 0;
      const live = new Set();

      function addToast(delay = 0) {
        const node = document.createElement('div');
        node.className = 'd-toast d-draggable';
        node.setAttribute('role', 'status');
        node.setAttribute('aria-live', 'polite');
        node.innerHTML = `
          <span class="d-toast-dot"></span>
          <span class="d-toast-text">${MESSAGES[counter++ % MESSAGES.length]}</span>
          <button class="d-btn d-btn--sm d-btn--ghost" style="padding:2px 8px" aria-label="Dismiss">×</button>`;
        stack.appendChild(node);

        // Cap the stack so the demo cannot run off the top of its frame.
        while (stack.children.length > 3) {
          const oldest = stack.firstElementChild;
          oldest.dispatchEvent(new CustomEvent('toast:evict'));
          oldest.remove();
        }

        const x = createSpringValue(24, {
          ...SpringPresets.snappy,
          onChange(v) {
            node.style.transform = `translateX(${v}px)`;
            node.style.opacity = String(
              clamp(1 - Math.abs(v) / Math.max(node.offsetWidth, 1), 0, 1),
            );
          },
        });
        live.add(x);

        const entry = setTimeout(() => x.set(0), delay);

        const remove = () => {
          clearTimeout(entry);
          clearTimeout(timer);
          detach();
          x.stop();
          live.delete(x);
          node.remove();
        };

        node.addEventListener('toast:evict', remove);

        const dismiss = (velocity = 0) => {
          const width = node.offsetWidth;
          x.jump(x.get(), velocity);
          x.set(width * 1.2);
          setTimeout(remove, 220);
        };

        let base = 0;
        const detach = createDragGesture(node, {
          axis: 'x',
          onStart() {
            base = x.get();
            x.stop();
            clearTimeout(timer);
          },
          onMove(delta) {
            x.jump(base + delta);
          },
          onEnd(delta, velocity) {
            const projected = x.get() + projectMomentum(velocity, 0.99);
            if (projected > node.offsetWidth * 0.45 || velocity > 500) {
              dismiss(velocity);
            } else {
              x.jump(x.get(), velocity);
              x.set(0);
            }
          },
        });

        node.querySelector('button').addEventListener('click', () => dismiss(600));

        // Auto-dismiss, paused while hovered or focused.
        let timer = setTimeout(() => dismiss(500), 5200);
        node.addEventListener('pointerenter', () => clearTimeout(timer));
        node.addEventListener('focusin', () => clearTimeout(timer));
        node.addEventListener('pointerleave', () => {
          timer = setTimeout(() => dismiss(500), 3000);
        });

        return remove;
      }

      stage.querySelector('[data-add]').addEventListener('click', () => addToast());
      stage.querySelector('[data-burst]').addEventListener('click', () => {
        for (let i = 0; i < 3; i++) addToast(stagger(i, 3, { each: 60 }));
      });

      const first = setTimeout(() => addToast(), 400);

      return {
        destroy() {
          clearTimeout(first);
          for (const spring of live) spring.stop();
          stack.innerHTML = '';
        },
      };
    },
  },

  {
    id: 'popover',
    title: 'Origin-anchored popover',
    summary:
      'transform-origin is set to the edge nearest the trigger, so the panel grows out of the control that opened it rather than materialising at its own centre.',
    chips: ['transform-origin', 'spring', 'provenance'],
    hint: 'Click the trigger',
    prompt: `Build a React <Popover> that visually originates from its trigger.

The one thing that matters
- Set transform-origin to the edge of the panel NEAREST the trigger. Below the
  trigger and centred, that is "top center". Flipped above, "bottom center".
  Left-aligned, "top left".
- Scaling from the panel's own centre (the default) makes it look like it
  materialised in place. Scaling from the anchor makes it look like it came out
  of the control the user just clicked. Same duration, same curve - the only
  difference is the origin, and it is the difference between "a panel appeared"
  and "this button opened".
- If you implement flipping for viewport collision, RECOMPUTE the origin when
  the placement flips. A panel that flips above the trigger but still scales
  from its top edge grows the wrong way, and it reads worse than no animation.

Motion
- Spring, stiffness 300 / damping 30 (zeta ~ 0.87). Scale 0.92 -> 1,
  opacity 0 -> 1.
- Exit: 120ms accelerate, scale to 0.96. Fast; a popover is dismissed casually
  and should not be watched.

Behaviour
- Close on Escape, on outside pointerdown, and on scroll of any ancestor.
- Return focus to the trigger on close.
- role="dialog" for interactive content, or aria-describedby if it is purely
  informational. Wire aria-expanded on the trigger either way.

Reduced motion: opacity only, no scale.`,
    code: `import { useLayoutEffect, useRef, useState } from 'react';
import { useSpringValue } from './hooks';

type Placement = 'top' | 'bottom';

export function Popover({ trigger, children }: PopoverProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement>('bottom');

  // Origin follows placement. Flip without recomputing this and the panel
  // grows away from its trigger — worse than not animating at all.
  const origin = placement === 'bottom' ? 'top center' : 'bottom center';

  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    const rect = panel.current.getBoundingClientRect();
    setPlacement(rect.bottom > innerHeight ? 'top' : 'bottom');
  }, [open]);

  useSpringValue(open ? 1 : 0, {
    stiffness: 300, damping: 30,
    onChange: (v) => {
      const node = panel.current;
      if (!node) return;
      node.style.transformOrigin = origin;
      node.style.transform = 'scale(' + (0.92 + 0.08 * v) + ')';
      node.style.opacity = String(v);
      node.style.pointerEvents = v > 0.5 ? 'auto' : 'none';
    },
  });

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button aria-expanded={open} onClick={() => setOpen((o) => !o)}>{trigger}</button>
      {open && <div ref={panel} role="dialog">{children}</div>}
    </span>
  );
}`,
    notes: `<strong>The origin carries the provenance.</strong> Same duration, same curve, same scale delta — the only variable is <code>transform-origin</code>, and it decides whether the panel reads as "something appeared" or as "this button opened it." It is the cheapest large improvement available in overlay motion.
<ul>
<li><strong>Recompute on flip.</strong> A popover that collides with the viewport and flips above its trigger, but still scales from its top edge, grows away from the thing that opened it. That reads worse than no animation.</li>
<li><strong>Exits are casual.</strong> 120ms out. Popovers are dismissed absent-mindedly and should not be watched.</li>
</ul>`,
    mount(stage) {
      stage.innerHTML = `
        <div class="d-stack">
          <div class="d-pop-anchor">
            <button class="d-btn" data-trigger type="button" aria-expanded="false">Filters</button>
          </div>
          <div class="d-row" style="gap:14px">
            <label class="d-readout" style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" data-origin checked> anchored origin
            </label>
            <span class="d-readout">origin <b data-origin-out>top center</b></span>
          </div>
        </div>`;

      const anchor = stage.querySelector('.d-pop-anchor');
      const trigger = stage.querySelector('[data-trigger]');
      const originToggle = stage.querySelector('[data-origin]');
      const originOut = stage.querySelector('[data-origin-out]');

      let panel = null;
      let spring = null;

      const originValue = () => (originToggle.checked ? 'top center' : 'center center');

      originToggle.addEventListener('change', () => {
        originOut.textContent = originValue();
        if (panel) panel.style.transformOrigin = originValue();
      });

      function close() {
        if (!panel) return;
        const node = panel;
        panel = null;
        trigger.setAttribute('aria-expanded', 'false');
        spring?.stop();
        animateValue({
          from: 1,
          to: 0,
          duration: 120,
          easing: Easing.accelerate,
          onUpdate: (v) => {
            node.style.opacity = String(v);
            if (!prefersReducedMotion()) node.style.transform = `scale(${0.96 + 0.04 * v})`;
          },
          onComplete: () => node.remove(),
        });
      }

      function open() {
        if (panel) return close();
        const reduced = prefersReducedMotion();

        panel = document.createElement('div');
        panel.className = 'd-pop';
        panel.setAttribute('role', 'dialog');
        panel.style.transformOrigin = originValue();
        panel.style.opacity = '0';
        panel.innerHTML = `
          <div class="d-pop-title">Refine results</div>
          Scaling from the anchored edge reads as “this button opened it”.
          Scaling from the centre reads as “a panel appeared”.`;
        anchor.appendChild(panel);
        trigger.setAttribute('aria-expanded', 'true');

        spring = createSpringValue(0, {
          mass: 1,
          stiffness: 300,
          damping: 30,
          onChange(v) {
            if (!panel) return;
            panel.style.opacity = String(v);
            if (!reduced) panel.style.transform = `scale(${0.92 + 0.08 * v})`;
          },
        });
        spring.set(1);
      }

      trigger.addEventListener('click', open);

      const onOutside = (event) => {
        if (panel && !anchor.contains(event.target)) close();
      };
      const onKey = (event) => {
        if (event.key === 'Escape' && panel) {
          close();
          trigger.focus();
        }
      };
      document.addEventListener('pointerdown', onOutside);
      document.addEventListener('keydown', onKey);

      return {
        destroy() {
          document.removeEventListener('pointerdown', onOutside);
          document.removeEventListener('keydown', onKey);
          spring?.stop();
          panel?.remove();
        },
      };
    },
  },

  {
    id: 'shake',
    title: 'Invalid-input shake',
    summary:
      'A decaying sinusoid sampled from the same spring envelope everything else uses. Amplitude decays exponentially, so it reads as a physical refusal rather than a looping wiggle.',
    chips: ['damped oscillation', 'error state', 'aria-live'],
    hint: 'Submit while the field is empty',
    prompt: `Build an invalid-input shake for form fields.

Motion
- Do NOT use a CSS keyframe loop with fixed amplitude. Constant-amplitude
  wiggle reads as decorative. Physical refusal decays.
- Displacement: x(t) = A * e^(-lambda * t) * sin(omega * t)
  with A = 8px, lambda = 14, omega = 2*pi*3.6 (roughly 3.5 visible oscillations
  inside ~380ms). Amplitude must be visibly smaller on each pass.
- translateX only. Never shake with margin or left; both force layout on every
  frame and can reflow neighbours.
- Cap total duration at ~400ms. Longer stops reading as feedback and starts
  reading as a malfunction.

State, not just motion
- Motion is the attention cue, not the message. Simultaneously:
  set aria-invalid="true", render the error text, and wire aria-describedby
  from the field to the message.
- Move focus to the first invalid field.
- The error text must appear WITHOUT the animation - a screen reader user gets
  nothing from the shake.

Reduced motion
- Under prefers-reduced-motion: reduce, skip the shake entirely. Keep the
  border colour change and the error message. Vestibular triggers are exactly
  this kind of rapid oscillation, and this is one of the clearest cases where
  removing motion costs nothing.`,
    code: `import { useCallback, useRef } from 'react';
import { onFrame, prefersReducedMotion } from './motion-core';

const AMPLITUDE = 8;      // px
const LAMBDA = 14;        // decay rate
const OMEGA = 2 * Math.PI * 3.6;
const DURATION = 400;     // ms

export function useShake(ref: React.RefObject<HTMLElement>) {
  return useCallback(() => {
    const node = ref.current;
    if (!node) return;

    // Reduced motion: the state change still happens, the oscillation does not.
    if (prefersReducedMotion()) return;

    const start = performance.now();
    const stop = onFrame((now) => {
      const t = (now - start) / 1000;
      if (now - start >= DURATION) {
        node.style.transform = '';
        stop();
        return;
      }
      // Exponentially decaying sinusoid — each pass visibly smaller.
      const x = AMPLITUDE * Math.exp(-LAMBDA * t) * Math.sin(OMEGA * t);
      node.style.transform = 'translateX(' + x + 'px)';
    });
  }, [ref]);
}

function EmailField({ value, error }: FieldProps) {
  const field = useRef<HTMLDivElement>(null);
  const shake = useShake(field);

  const submit = () => {
    if (!value) {
      shake();                       // attention
      setError('Enter an email address');  // the actual message
      inputRef.current?.focus();
    }
  };

  return (
    <div ref={field}>
      <input aria-invalid={!!error} aria-describedby={error ? 'email-err' : undefined} />
      {error && <span id="email-err" role="alert">{error}</span>}
    </div>
  );
}`,
    notes: `<strong>Motion is the attention cue, not the message.</strong> The shake tells a sighted user where to look; it tells a screen reader user nothing. <code>aria-invalid</code>, the error text, and <code>aria-describedby</code> have to land regardless of whether a single pixel moves.
<ul>
<li><strong>Decay is what makes it read as refusal.</strong> A fixed-amplitude CSS keyframe wiggle reads as decoration. <code>e^(−14t)</code> makes each pass visibly smaller, like something that was pushed and is settling.</li>
<li><strong>Cap at ~400ms.</strong> Past that it stops reading as feedback and starts reading as a malfunction.</li>
<li><strong>This is the clearest reduced-motion case there is.</strong> Rapid oscillation is a textbook vestibular trigger, and removing it costs nothing — the border and the message carry the whole meaning.</li>
</ul>`,
    mount(stage) {
      stage.innerHTML = `
        <div class="d-stack">
          <div class="d-shake-field">
            <label class="d-label" for="shake-input">Work email</label>
            <input class="d-shake-input" id="shake-input" type="email" placeholder="you@company.com"
                   aria-describedby="shake-msg">
            <span class="d-shake-msg" id="shake-msg" role="alert"></span>
          </div>
          <button class="d-btn d-btn--accent d-btn--sm" data-submit type="button">Continue</button>
        </div>`;

      const field = stage.querySelector('.d-shake-field');
      const input = stage.querySelector('.d-shake-input');
      const message = stage.querySelector('.d-shake-msg');

      const AMPLITUDE = 8;
      const LAMBDA = 14;
      const OMEGA = 2 * Math.PI * 3.6;
      const DURATION = 400;

      let stop = null;

      function shake() {
        stop?.();
        if (prefersReducedMotion()) return;
        const start = performance.now();
        stop = onFrame((now) => {
          const elapsed = now - start;
          if (elapsed >= DURATION) {
            field.style.transform = '';
            stop?.();
            stop = null;
            return;
          }
          const t = elapsed / 1000;
          field.style.transform = `translateX(${
            AMPLITUDE * Math.exp(-LAMBDA * t) * Math.sin(OMEGA * t)
          }px)`;
        });
      }

      stage.querySelector('[data-submit]').addEventListener('click', () => {
        const valid = /.+@.+\..+/.test(input.value);
        if (valid) {
          input.classList.remove('is-invalid');
          input.setAttribute('aria-invalid', 'false');
          message.textContent = '';
          message.style.opacity = '0';
          return;
        }

        // State first — it has to land whether or not anything moves.
        input.classList.add('is-invalid');
        input.setAttribute('aria-invalid', 'true');
        message.textContent = input.value
          ? 'That does not look like an email address'
          : 'Enter an email address';
        message.style.opacity = '1';
        input.focus();
        shake();
      });

      input.addEventListener('input', () => {
        if (!input.classList.contains('is-invalid')) return;
        input.classList.remove('is-invalid');
        input.setAttribute('aria-invalid', 'false');
        message.style.opacity = '0';
      });

      return { replay: shake, destroy: () => stop?.() };
    },
  },
];
