import {
  Easing,
  SpringPresets,
  animateValue,
  clamp,
  createSpringValue,
  onFrame,
  prefersReducedMotion,
  stagger,
} from '../engine.js';

export const category = {
  id: 'text',
  index: '06',
  title: 'Text',
  blurb:
    'Type is the one thing on the page people came to read, which makes it the easiest thing to ruin with motion. Everything here keeps the words legible, keeps them in the accessibility tree intact, and gets out of the way fast.',
};

export const entries = [
  {
    id: 'split-text',
    title: 'Split reveal',
    summary:
      'Words animate individually while the sentence stays one string to assistive tech. Split by word, not by character — per-character staggering on a full sentence is unreadable and slow.',
    chips: ['stagger', 'aria-label', 'word split'],
    hint: 'Replay the reveal',
    prompt: `Build a React <SplitText> that reveals a heading word by word.

Splitting
- Split on WORDS by default, not characters. A per-character stagger across a
  sentence takes far longer, and the eye tracks individual letters instead of
  reading. Reserve character splitting for single short words - a logo, a
  number, one label.
- Each unit is an inline-block span, so it can take a transform. Preserve the
  spaces: either keep them inside the spans with white-space: pre, or the line
  collapses into onewordlikethis.

Motion per unit
- translateY 0.5em -> 0, opacity 0 -> 1, over 420ms on a decelerate curve.
- Stagger 34ms per word, capped at ~500ms total. Compress the offset for long
  headings rather than letting the tail run.
- Optionally add a slight blur (3px -> 0) for a focus-pull feel, but only on
  short headings. Blur is expensive and on a paragraph it will drop frames.

Accessibility - this is where most implementations fail
- A screen reader hitting 40 sibling spans may announce them as fragments.
  Put aria-label with the FULL original string on the wrapper and
  aria-hidden="true" on the span container. The visual text animates; the
  announced text is one clean sentence.
- Never split text the user has to read carefully - body copy, form labels,
  error messages. This is a technique for headings and short display strings.
- Under prefers-reduced-motion: reduce, render the plain string with no spans
  at all. Do not animate opacity "just a little".

Layout
- Reserve the final height before animating. Text arriving from opacity 0 with
  no reserved space causes cumulative layout shift, which is both a UX problem
  and a Core Web Vitals penalty.`,
    code: `import { useEffect, useRef } from 'react';
import { animateValue, Easing, stagger, prefersReducedMotion } from './motion-core';

export function SplitText({ text, by = 'word', each = 34 }: SplitTextProps) {
  const host = useRef<HTMLSpanElement>(null);
  const reduced = prefersReducedMotion();

  // Keep the delimiter so spacing survives the split.
  const units = by === 'word' ? text.split(/(\\s+)/) : [...text];

  useEffect(() => {
    if (reduced) return;
    const spans = [...host.current!.querySelectorAll<HTMLElement>('[data-unit]')];
    const cancels = spans.map((span, i) =>
      setTimeout(() => {
        animateValue({
          from: 0, to: 1, duration: 420, easing: Easing.decelerate,
          onUpdate: (p) => {
            span.style.opacity = String(p);
            span.style.transform = 'translateY(' + 0.5 * (1 - p) + 'em)';
          },
        });
      }, stagger(i, spans.length, { each, maxTotal: 500 })),
    );
    return () => cancels.forEach(clearTimeout);
  }, [text, each, reduced]);

  // Reduced motion gets the plain string — no spans, no partial fade.
  if (reduced) return <span>{text}</span>;

  return (
    // One clean sentence for assistive tech; the spans are decorative.
    <span aria-label={text}>
      <span ref={host} aria-hidden="true">
        {units.map((unit, i) =>
          unit.trim() === '' ? unit : (
            <span key={i} data-unit
                  style={{ display: 'inline-block', whiteSpace: 'pre', opacity: 0 }}>
              {unit}
            </span>
          ),
        )}
      </span>
    </span>
  );
}`,
    notes: `<strong>Split by word, not by character.</strong> A per-character stagger across a sentence takes several times longer and makes the eye track letters instead of reading words. Character splitting earns its place on a single short string — a logo, a number — and nowhere else.
<ul>
<li><strong><code>aria-label</code> on the wrapper, <code>aria-hidden</code> on the spans.</strong> Forty sibling spans can be announced as forty fragments. The visual text animates; the announced text stays one sentence.</li>
<li><strong>Keep the whitespace.</strong> Splitting on <code>/(\\s+)/</code> retains the delimiters — split on <code>' '</code> and the line collapses into one long word.</li>
<li><strong>Reserve the height first.</strong> Text fading in from nothing with no reserved space is cumulative layout shift, which costs you twice: it looks bad and it scores badly.</li>
<li><strong>Never split body copy</strong>, form labels, or error messages. Headings and display strings only.</li>
</ul>`,
    mount(stage) {
      const TEXT = 'Motion should explain what changed.';

      stage.innerHTML = `
        <div class="d-stack">
          <div class="d-split" data-split aria-label="${TEXT}"></div>
          <div class="d-row" style="gap:14px">
            <label class="d-readout" style="display:flex;align-items:center;gap:6px;cursor:pointer">
              split by
              <select class="d-readout" data-mode style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:3px 6px">
                <option value="word">word</option>
                <option value="char">character</option>
              </select>
            </label>
            <span class="d-readout">units <b data-units>0</b> · tail <b data-tail>0</b>ms</span>
          </div>
        </div>`;

      const host = stage.querySelector('[data-split]');
      const mode = stage.querySelector('[data-mode]');
      const unitsOut = stage.querySelector('[data-units]');
      const tailOut = stage.querySelector('[data-tail]');
      const timers = [];
      const cancels = [];

      function reveal() {
        for (const timer of timers) clearTimeout(timer);
        for (const cancel of cancels) cancel?.();
        timers.length = 0;
        cancels.length = 0;

        if (prefersReducedMotion()) {
          host.textContent = TEXT;
          unitsOut.textContent = '1';
          tailOut.textContent = '0';
          return;
        }

        // Keep the delimiters so spacing survives the split.
        const parts = mode.value === 'word' ? TEXT.split(/(\s+)/) : [...TEXT];

        host.innerHTML = '';
        const spans = [];
        for (const part of parts) {
          if (part.trim() === '') {
            host.appendChild(document.createTextNode(part));
            continue;
          }
          const span = document.createElement('span');
          span.className = 'd-split-unit';
          span.textContent = part;
          span.style.opacity = '0';
          host.appendChild(span);
          spans.push(span);
        }
        // The spans are decorative; the wrapper's aria-label carries the sentence.
        host.setAttribute('aria-hidden', 'false');

        const each = mode.value === 'word' ? 34 : 18;
        unitsOut.textContent = String(spans.length);
        tailOut.textContent = stagger(spans.length - 1, spans.length, {
          each,
          maxTotal: 500,
        }).toFixed(0);

        spans.forEach((span, index) => {
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
                      span.style.opacity = String(p);
                      span.style.transform = `translateY(${0.5 * (1 - p)}em)`;
                    },
                  }),
                );
              },
              stagger(index, spans.length, { each, maxTotal: 500 }),
            ),
          );
        });
      }

      mode.addEventListener('change', reveal);
      const initial = setTimeout(reveal, 260);

      return {
        replay: reveal,
        destroy() {
          clearTimeout(initial);
          for (const timer of timers) clearTimeout(timer);
          for (const cancel of cancels) cancel?.();
        },
      };
    },
  },

  {
    id: 'blur-in',
    title: 'Focus-pull reveal',
    summary:
      'Blur, opacity and a small rise resolve together, like a lens finding focus. Line-level rather than word-level, because blur is expensive and paragraphs are long.',
    chips: ['obscuration', 'filter', 'line stagger'],
    hint: 'Replay the pull',
    prompt: `Build a focus-pull text reveal — content resolving from blurred to sharp.

Motion
- Per line: filter blur(6px) -> blur(0), opacity 0 -> 1,
  translateY 8px -> 0. 520ms on a decelerate curve, 90ms stagger between lines.
- All three properties must resolve TOGETHER. Blur clearing after the opacity
  has already landed reads as a rendering bug, not as a focus pull.

Performance - blur is not free
- filter: blur() forces a full repaint of the element and its subtree every
  frame. It is one of the most expensive properties you can animate.
- Stagger by LINE, never by word or character. Twenty simultaneous blurred
  spans will drop frames on mid-range hardware.
- Set will-change: filter, opacity, transform before starting and REMOVE it on
  completion. Leaving will-change on permanently keeps a compositor layer alive
  for every line, which costs memory for no benefit.
- Cap blur at ~8px. Larger radii cost superlinearly and add nothing legible.
- Never blur more than a handful of elements at once. If you have a long
  article, animate the first block only.

Accessibility
- Blurred text is unreadable text. Keep the total under ~600ms.
- Under prefers-reduced-motion: reduce, drop the blur AND the translate, and
  either fade over 200ms or render immediately. Blur is a genuine problem for
  low-vision users, and this is not a decorative-only concern.`,
    code: `import { useEffect, useRef } from 'react';
import { animateValue, Easing, prefersReducedMotion } from './motion-core';

const MAX_BLUR = 6;   // px — larger radii cost superlinearly for no legibility

export function FocusPull({ lines }: { lines: string[] }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const nodes = [...host.current!.children] as HTMLElement[];

    const timers = nodes.map((node, i) =>
      setTimeout(() => {
        node.style.willChange = 'filter, opacity, transform';

        animateValue({
          from: 0, to: 1, duration: 520, easing: Easing.decelerate,
          onUpdate: (p) => {
            // All three resolve together — a blur that clears after the fade
            // has landed reads as a rendering bug.
            node.style.filter = 'blur(' + MAX_BLUR * (1 - p) + 'px)';
            node.style.opacity = String(p);
            node.style.transform = 'translateY(' + 8 * (1 - p) + 'px)';
          },
          onComplete: () => {
            node.style.filter = '';
            node.style.transform = '';
            // Release the compositor layer — leaving will-change on costs memory.
            node.style.willChange = '';
          },
        });
      }, i * 90),   // stagger by LINE, never by word
    );

    return () => timers.forEach(clearTimeout);
  }, [lines]);

  return (
    <div ref={host}>
      {lines.map((line, i) => <p key={i} style={{ opacity: 0 }}>{line}</p>)}
    </div>
  );
}`,
    notes: `<strong>Blur is the most expensive property here by a wide margin.</strong> <code>filter: blur()</code> repaints the element and its whole subtree every frame. Twenty blurred spans animating at once will drop frames on hardware that handles everything else in this catalogue without noticing.
<ul>
<li><strong>Resolve all three together.</strong> If blur clears after opacity has landed, it reads as the renderer catching up rather than as a lens finding focus.</li>
<li><strong>Remove <code>will-change</code> on completion.</strong> Setting it is correct; leaving it set keeps a compositor layer alive per line forever.</li>
<li><strong>Reduced motion drops the blur entirely.</strong> Blurred text is unreadable text — for low-vision users this is an access problem, not a taste preference.</li>
</ul>`,
    mount(stage) {
      const LINES = [
        'Focus arrives before meaning.',
        'Blur is an attention instrument: it says “not yet” about everything it touches, then hands the eye a single place to land.',
        'Which is exactly why it should be spent on one block, once — and never on anything the reader is already reading.',
      ];

      stage.innerHTML = `
        <div class="d-stack">
          <div class="d-blur-lines">
            ${LINES.map((line) => `<div class="d-blur-line">${line}</div>`).join('')}
          </div>
          <div class="d-readout">blur 6px → 0 · 520ms · 90ms per line</div>
        </div>`;

      const lines = [...stage.querySelectorAll('.d-blur-line')];
      const timers = [];
      const cancels = [];

      function reveal() {
        for (const timer of timers) clearTimeout(timer);
        for (const cancel of cancels) cancel?.();
        timers.length = 0;
        cancels.length = 0;

        if (prefersReducedMotion()) {
          for (const line of lines) {
            line.style.filter = '';
            line.style.opacity = '1';
            line.style.transform = '';
          }
          return;
        }

        for (const line of lines) {
          line.style.opacity = '0';
          line.style.filter = 'blur(6px)';
          line.style.transform = 'translateY(8px)';
        }

        lines.forEach((line, index) => {
          timers.push(
            setTimeout(() => {
              line.style.willChange = 'filter, opacity, transform';
              cancels.push(
                animateValue({
                  from: 0,
                  to: 1,
                  duration: 520,
                  easing: Easing.decelerate,
                  onUpdate: (p) => {
                    line.style.filter = `blur(${6 * (1 - p)}px)`;
                    line.style.opacity = String(p);
                    line.style.transform = `translateY(${8 * (1 - p)}px)`;
                  },
                  onComplete: () => {
                    line.style.filter = '';
                    line.style.transform = '';
                    // Release the layer rather than leaving will-change set.
                    line.style.willChange = '';
                  },
                }),
              );
            }, index * 90),
          );
        });
      }

      const initial = setTimeout(reveal, 260);

      return {
        replay: reveal,
        destroy() {
          clearTimeout(initial);
          for (const timer of timers) clearTimeout(timer);
          for (const cancel of cancels) cancel?.();
        },
      };
    },
  },

  {
    id: 'odometer',
    title: 'Odometer digits',
    summary:
      'Each digit column is a strip of 0–9 translated by a spring. Columns are staggered right to left, so the ones place moves first — the way a mechanical counter actually behaves.',
    chips: ['per-digit spring', 'masking', 'right-to-left'],
    hint: 'Roll a new number',
    prompt: `Build an odometer-style number roll.

Structure
- One column per digit. Each column is a vertical strip containing 0-9, clipped
  by a parent with overflow: hidden and a fixed height equal to ONE digit.
- Position: translateY(-digit * digitHeight). Spring per column.
- The mask height must exactly match the digit line-height, or neighbouring
  digits peek at the edges.

Stagger direction
- Stagger columns RIGHT TO LEFT: the ones place starts first, then tens, then
  hundreds. That is the direction a mechanical odometer carries, and reversing
  it looks subtly wrong even to people who cannot say why.
- 40ms between columns.

Digit-count changes
- When the digit count changes (99 -> 100), add the new column BEFORE animating
  and let it roll in from blank. Adding it afterwards makes the whole number
  jump sideways mid-animation.
- Right-align the container so growth pushes leftward rather than shifting the
  digits already on screen.

Separators
- Group separators are static elements between columns, never part of a rolling
  strip. Rolling a comma is nonsense.

Spring
- stiffness 220 / damping 24 (zeta ~ 0.81). A little overshoot is right here -
  it is the mechanical settle of a physical wheel. This is the ONE numeric
  display where overshoot is acceptable, because the digit strip only ever
  shows discrete digits: the value never renders as something between 4 and 5.

Accessibility
- aria-hidden on the entire visual odometer; a visually hidden span carries the
  real formatted value with aria-live="polite".
- Under prefers-reduced-motion: reduce, swap digits with no travel.`,
    code: `import { useEffect, useRef } from 'react';
import { useSpringValue } from './hooks';

const DIGIT_HEIGHT = 48;   // must equal the mask height exactly

function DigitColumn({ digit, index, total }: DigitProps) {
  const strip = useRef<HTMLDivElement>(null);

  const y = useSpringValue(0, {
    stiffness: 220, damping: 24,       // slight overshoot = mechanical settle
    onChange: (v) => {
      strip.current!.style.transform = 'translateY(' + -v * DIGIT_HEIGHT + 'px)';
    },
  });

  useEffect(() => {
    // Right to left: ones place leads, the way a real odometer carries.
    const delay = (total - 1 - index) * 40;
    const t = setTimeout(() => y.set(digit), delay);
    return () => clearTimeout(t);
  }, [digit, index, total, y]);

  return (
    <span style={{ height: DIGIT_HEIGHT, overflow: 'hidden', display: 'block' }}>
      <span ref={strip} style={{ display: 'flex', flexDirection: 'column' }}>
        {[0,1,2,3,4,5,6,7,8,9].map((n) => (
          <span key={n} style={{ height: DIGIT_HEIGHT }}>{n}</span>
        ))}
      </span>
    </span>
  );
}

export function Odometer({ value, format }: OdometerProps) {
  const chars = [...format(value)];   // separators stay static between columns
  return (
    <span>
      <span aria-hidden="true" style={{ display: 'flex' }}>
        {chars.map((ch, i) =>
          /\\d/.test(ch)
            ? <DigitColumn key={i} digit={+ch} index={i} total={chars.length} />
            : <span key={i}>{ch}</span>
        )}
      </span>
      <span className="sr-only" aria-live="polite">{format(value)}</span>
    </span>
  );
}`,
    notes: `<strong>Right to left, always.</strong> The ones place leads and the carry propagates leftward, because that is what a mechanical counter does. Stagger it the other way and it looks subtly wrong to people who could not tell you why.
<ul>
<li><strong>This is the one numeric display where overshoot is fine.</strong> The strip only ever shows discrete digits, so the value never renders as something between 4 and 5 — unlike an interpolated counter, where overshoot means displaying a number that was never true.</li>
<li><strong>Add new columns before animating.</strong> Growing 99 → 100 by appending a column mid-roll shifts the whole number sideways.</li>
<li><strong>Separators are static.</strong> A rolling comma is nonsense.</li>
</ul>`,
    mount(stage) {
      const DIGIT_HEIGHT = 48;

      stage.innerHTML = `
        <div class="d-stack">
          <div class="d-odo" data-odo aria-hidden="true"></div>
          <span class="d-readout" aria-live="polite" data-live></span>
          <button class="d-btn d-btn--sm" data-roll type="button">Roll new number</button>
        </div>`;

      const odo = stage.querySelector('[data-odo]');
      const live = stage.querySelector('[data-live]');
      const formatter = new Intl.NumberFormat('en-US');

      let value = 48210;
      let springs = [];
      let timers = [];

      function build(next) {
        for (const spring of springs) spring.stop();
        for (const timer of timers) clearTimeout(timer);
        springs = [];
        timers = [];

        const chars = [...formatter.format(next)];
        odo.innerHTML = '';
        live.textContent = formatter.format(next);

        const columns = [];

        for (const char of chars) {
          if (!/\d/.test(char)) {
            // Separators are static — never part of a rolling strip.
            const separator = document.createElement('span');
            separator.className = 'd-odo-static';
            separator.textContent = char;
            odo.appendChild(separator);
            continue;
          }

          const column = document.createElement('span');
          column.className = 'd-odo-col';
          const strip = document.createElement('span');
          strip.className = 'd-odo-strip';
          for (let n = 0; n <= 9; n++) {
            const digit = document.createElement('span');
            digit.className = 'd-odo-digit';
            digit.textContent = String(n);
            strip.appendChild(digit);
          }
          column.appendChild(strip);
          odo.appendChild(column);
          columns.push({ strip, digit: Number(char) });
        }

        if (prefersReducedMotion()) {
          for (const { strip, digit } of columns) {
            strip.style.transform = `translateY(${-digit * DIGIT_HEIGHT}px)`;
          }
          return;
        }

        columns.forEach(({ strip, digit }, index) => {
          const spring = createSpringValue(0, {
            mass: 1,
            stiffness: 220,
            damping: 24,
            onChange: (v) => {
              strip.style.transform = `translateY(${-v * DIGIT_HEIGHT}px)`;
            },
          });
          springs.push(spring);
          // Right to left — ones place first.
          timers.push(setTimeout(() => spring.set(digit), (columns.length - 1 - index) * 40));
        });
      }

      const roll = () => {
        value = Math.round(1000 + Math.random() * 998000);
        build(value);
      };

      const initial = setTimeout(() => build(value), 260);

      stage.querySelector('[data-roll]').addEventListener('click', roll);

      return {
        replay: roll,
        destroy() {
          clearTimeout(initial);
          for (const spring of springs) spring.stop();
          for (const timer of timers) clearTimeout(timer);
        },
      };
    },
  },

  {
    id: 'scramble',
    title: 'Decode scramble',
    summary:
      'A resolve front sweeps left to right; characters ahead of it cycle through noise, characters behind it are locked. Width never changes, because the noise glyphs are monospaced.',
    chips: ['frame clock', 'monospace', 'resolve front'],
    hint: 'Replay the decode',
    prompt: `Build a text-scramble / decode effect.

The mechanism
- Maintain a "resolve front" that advances left to right over the duration.
  Characters BEFORE the front render their final value and never change again.
  Characters AFTER it render a random glyph, re-rolled every 2-3 frames.
- Re-rolling every single frame at 60fps is too fast to read as characters and
  just looks like static. Every 2nd or 3rd frame is the readable range.
- Front position = easeOut(progress) * text.length, so the decode starts quickly
  and the last few characters take proportionally longer. A linear front feels
  mechanical.

Non-negotiable: use a MONOSPACE font
- Proportional glyphs have different widths, so every re-roll changes the string
  width and the text jitters horizontally for the whole animation. It looks
  broken. Monospace, or the effect is not viable.
- Preserve spaces and punctuation as-is — never scramble them. Scrambling word
  boundaries destroys the shape of the sentence, which is the thing that makes
  the decode legible as it resolves.

Duration
- 800-1200ms total. This effect is pure decoration and it delays comprehension
  by its entire duration, so it is only ever appropriate on a short display
  string and never on content the user is waiting for.

Accessibility
- aria-label with the final string on the wrapper, aria-hidden on the animating
  node. The intermediate states are literally gibberish and must never reach the
  accessibility tree.
- Under prefers-reduced-motion: reduce, render the final text immediately. There
  is nothing to preserve here — the effect carries no information.`,
    code: `import { useEffect, useRef } from 'react';
import { onFrame, Easing, prefersReducedMotion } from './motion-core';

const NOISE = '!<>-_\\\\/[]{}—=+*^?#________';
const DURATION = 1000;

export function Scramble({ text }: { text: string }) {
  const el = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      el.current!.textContent = text;   // no information to preserve
      return;
    }

    const start = performance.now();
    let frame = 0;
    let noise = '';

    const stop = onFrame((now) => {
      const progress = Math.min((now - start) / DURATION, 1);
      // Eased front: fast start, the last characters take proportionally longer.
      const front = Easing.decelerate(progress) * text.length;

      // Re-roll every 3rd frame — every frame is unreadable static.
      if (frame++ % 3 === 0) {
        noise = [...text].map(() => NOISE[Math.floor(Math.random() * NOISE.length)]).join('');
      }

      el.current!.textContent = [...text]
        .map((ch, i) => {
          if (i < front) return ch;          // locked
          if (ch === ' ') return ' ';        // never scramble word boundaries
          return noise[i];
        })
        .join('');

      if (progress >= 1) { el.current!.textContent = text; stop(); }
    });

    return stop;
  }, [text]);

  // Intermediate states are gibberish — they must never reach the a11y tree.
  return (
    <span aria-label={text}>
      {/* MONOSPACE is mandatory: proportional glyphs jitter the width every reroll */}
      <span ref={el} aria-hidden="true" style={{ fontFamily: 'ui-monospace, monospace' }} />
    </span>
  );
}`,
    notes: `<strong>Monospace or don't ship it.</strong> Proportional glyphs have different widths, so every re-roll changes the string's measured width and the text jitters sideways for the entire animation. There is no fix other than a fixed-width font.
<ul>
<li><strong>Re-roll every 2–3 frames, not every frame.</strong> At 60fps a per-frame reroll is too fast to register as characters and reads as static.</li>
<li><strong>Never scramble spaces.</strong> Word boundaries are what let the eye track the sentence's shape while it resolves — scramble them and the whole thing is noise until the last frame.</li>
<li><strong>Be honest about the cost:</strong> this delays comprehension by its full duration and carries no information. Short display strings only, and under reduced motion there is nothing worth preserving — just render the text.</li>
</ul>`,
    mount(stage) {
      const TEXT = 'DECODING INTERFACE STATE';
      const NOISE = '!<>-_\\/[]{}—=+*^?#________';
      const DURATION = 1100;

      stage.innerHTML = `
        <div class="d-stack">
          <div class="d-scramble" aria-label="${TEXT}">
            <span data-scramble aria-hidden="true"></span>
          </div>
          <div class="d-readout">monospace · reroll every 3rd frame · eased front</div>
        </div>`;

      const node = stage.querySelector('[data-scramble]');
      let stop = null;

      function run() {
        stop?.();

        if (prefersReducedMotion()) {
          node.textContent = TEXT;
          return;
        }

        const start = performance.now();
        let frame = 0;
        let noise = '';

        stop = onFrame((now) => {
          const progress = Math.min((now - start) / DURATION, 1);
          const front = Easing.decelerate(progress) * TEXT.length;

          if (frame++ % 3 === 0) {
            noise = [...TEXT]
              .map(() => NOISE[Math.floor(Math.random() * NOISE.length)])
              .join('');
          }

          node.textContent = [...TEXT]
            .map((char, index) => {
              if (index < front) return char;
              if (char === ' ') return ' ';
              return noise[index] ?? char;
            })
            .join('');

          if (progress >= 1) {
            node.textContent = TEXT;
            stop?.();
            stop = null;
          }
        });
      }

      const initial = setTimeout(run, 260);

      return {
        replay: run,
        destroy() {
          clearTimeout(initial);
          stop?.();
        },
      };
    },
  },
];
