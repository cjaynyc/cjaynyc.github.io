# Motion Menu

A browsable catalogue of UI interactions. Every entry has three things:

1. **A live demo** you can actually manipulate — drag it, throw it, press Escape in it.
2. **The prompt** that generates it, written as an implementation spec.
3. **The React code** it produces.

Live at **`/motion/`** on the Pages site. It is a static page — no build step, no
bundler, no dependencies. Open `index.html` and it runs.

---

## What's in it

| # | Category | Interactions |
|---|----------|--------------|
| 01 | Click & press states | spring press depth · origin-anchored ripple · toggle thumb travel · magnetic cursor |
| 02 | Acceleration & physics | closed-form spring solver · cubic-bezier catalogue · momentum projection · rubber-band resistance |
| 03 | Drawers & sheets | bottom sheet with detents · side drawer that pushes content · pull to refresh |
| 04 | Prompts & overlays | dialog with backdrop ramp · toast stack with swipe dismiss · origin-anchored popover · invalid-input shake |
| 05 | Dashboard & data | animated counter · staggered tile reveal · bar chart draw-in · progress ring · shared tab indicator |
| 06 | Text | split reveal · focus-pull blur · odometer digits · decode scramble |

24 interactions, all live, all honouring `prefers-reduced-motion`.

---

## The two ideas underneath everything

**Springs are solved in closed form, not integrated step by step.**
`springAt(t)` is a pure function of elapsed time, which buys three things: a dropped
frame cannot cause drift, retargeting mid-flight is exact (read the current velocity,
start a new solve with it as `v₀`), and the same function works in a real-time rAF
loop or a deterministic frame renderer without changes.

That is why the drawer you throw keeps its momentum into the snap instead of
restarting from rest — the release velocity becomes the settling spring's initial
velocity.

**Nothing is linear.** Every curve has weight. `Easing.linear` exists but is reserved
for continuous carriers — a spinner, a seamless marquee — where acceleration would
visibly stutter at the loop seam.

---

## Using the code

The `react/` folder is the real thing, not an excerpt. Copy both files into a project
and every code sample in the catalogue compiles as written:

```
react/motion-core.ts   easing · spring · gesture physics · stagger   (no React)
react/hooks.ts         useSpringValue · useDragGesture · useReducedMotion · useStagger
```

```tsx
import { SpringPresets } from './motion-core';
import { useSpringValue } from './hooks';

const box = useRef<HTMLDivElement>(null);
const x = useSpringValue(0, {
  ...SpringPresets.snappy,
  onChange: (v) => { box.current!.style.transform = `translateX(${v}px)`; },
});

// Retarget mid-flight — the solver carries the live velocity into the new solve.
x.set(240);
```

Spring values write to the DOM through `onChange`, deliberately **not** through React
state. A spring updates every frame; routing 60 state updates per second through the
reconciler re-renders the subtree 60 times to move one transform.

---

## Layout

```
motion/
├── index.html          the menu shell
├── styles.css          site chrome, light + dark
├── demos.css           demo widget styling
├── app.js              rendering, lazy mounting, search, tabs, copy, theme
├── engine.js           motion core (JS) — drives every live demo
├── catalog/
│   ├── index.js        category ordering
│   └── *.js            one module per category: demo + prompt + code + notes
└── react/              copy-paste TypeScript source (typechecked, strict)
```

Each catalogue entry is a single object carrying its own demo, prompt, code and notes,
so adding an interaction means adding one object to one array.

Demos mount lazily on scroll via `IntersectionObserver` — twenty-four live animations
competing for the same frame clock would make the page judder and misrepresent every
one of them.

---

## Development

The site needs no build. To work on it:

```bash
python3 -m http.server 8899        # from the repo root
open http://127.0.0.1:8899/motion/
```

To typecheck the React source:

```bash
cd motion && npm install && npm run typecheck
```

`react/` compiles under `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes` and `verbatimModuleSyntax`.

---

## Accessibility

Not an afterthought here — several entries exist specifically to show the correct
handling:

- **`prefers-reduced-motion`** is honoured by every demo. Motion is removed; state
  changes, thresholds and feedback all still work. The banner at the top of the page
  appears when the preference is detected, so the degraded behaviour reads as
  intentional rather than broken.
- **Focus management** — the dialog traps Tab in both directions and restores focus to
  its trigger on close.
- **Announcements** — animated counters expose only the settled value to the
  accessibility tree; split text carries the full string in `aria-label` while the
  animating spans are `aria-hidden`.
- **Keyboard parity** — press states respond to Space and Enter, tabs support arrow-key
  navigation with roving `tabindex`, and swipe-to-dismiss is never the only way out of
  a toast.
