/**
 * app.js — the menu shell.
 *
 * Renders the catalogue, mounts each demo lazily as its card scrolls into view,
 * and wires search, theme, panel tabs and copy buttons.
 *
 * Demos mount on intersection rather than all at once: twenty-four live
 * animations competing for the same frame clock would make the page judder and
 * misrepresent every one of them.
 */

import { catalog, allEntries } from './catalog/index.js';
import { onReducedMotionChange, prefersReducedMotion } from './engine.js';

/* ── Syntax tinting ─────────────────────────────────────────── */

const KEYWORDS =
  'const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|' +
  'import|export|from|default|as|class|extends|new|delete|typeof|instanceof|void|' +
  'await|async|yield|try|catch|finally|throw|type|interface|enum|implements|' +
  'public|private|readonly|of|in|null|undefined|true|false|this|super';

// Comments come first in the alternation: apostrophes inside prose comments are
// far more common in this catalogue than "//" inside a string literal.
const TOKEN = new RegExp(
  [
    '(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)',
    "('(?:[^'\\\\\\n]|\\\\.)*'|\"(?:[^\"\\\\\\n]|\\\\.)*\"|`(?:[^`\\\\]|\\\\.)*`)",
    `\\b(${KEYWORDS})\\b`,
    '\\b(\\d+\\.?\\d*)\\b',
    '\\b([A-Za-z_$][\\w$]*)(?=\\s*\\()',
  ].join('|'),
  'g',
);

/** Escape only &, < and > — quotes must survive for the string matcher. */
function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlight(source) {
  return escapeHtml(source).replace(
    TOKEN,
    (match, comment, string, keyword, number, fn) => {
      if (comment) return `<span class="tok-com">${comment}</span>`;
      if (string) return `<span class="tok-str">${string}</span>`;
      if (keyword) return `<span class="tok-key">${keyword}</span>`;
      if (number) return `<span class="tok-num">${number}</span>`;
      if (fn) return `<span class="tok-fn">${fn}</span>`;
      return match;
    },
  );
}

/* ── Rendering ──────────────────────────────────────────────── */

const ICON_COPY =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const ICON_REPLAY =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L3 8"/></svg>';

function renderEntry(entry) {
  const stageClasses = ['stage'];
  if (entry.stage?.tall) stageClasses.push('is-tall');
  if (entry.stage?.flush) stageClasses.push('is-flush');

  const chips = (entry.chips ?? [])
    .map((chip, i) => `<span class="chip${i === 0 ? ' is-accent' : ''}">${chip}</span>`)
    .join('');

  return `
    <article class="entry" id="${entry.id}" data-entry="${entry.id}"
             data-search="${`${entry.title} ${entry.id} ${entry.summary} ${(entry.chips ?? []).join(' ')} ${
                 entry.categoryTitle ?? ''
               }`
               .toLowerCase()
               .replace(/"/g, '')}">
      <div class="entry-head">
        <div>
          <div class="entry-title">${entry.title} <span class="entry-id">${entry.id}</span></div>
          <div class="entry-summary">${entry.summary}</div>
        </div>
        <div class="chips">${chips}</div>
      </div>

      <div class="${stageClasses.join(' ')}" data-stage>
        ${entry.hint ? `<div class="stage-hint">${entry.hint}</div>` : ''}
      </div>

      <div class="panel-tabs" role="tablist" aria-label="${entry.title} details">
        <button class="panel-tab" role="tab" aria-selected="true" data-panel="prompt">Prompt</button>
        <button class="panel-tab" role="tab" aria-selected="false" data-panel="code">React</button>
        <button class="panel-tab" role="tab" aria-selected="false" data-panel="notes">Why</button>
      </div>

      <div class="panel" role="tabpanel" data-panel-body="prompt">
        <button class="copy-btn" data-copy="prompt">${ICON_COPY} Copy prompt</button>
        <div class="prompt-body">${escapeHtml(entry.prompt)}</div>
      </div>
      <div class="panel" role="tabpanel" data-panel-body="code" hidden>
        <button class="copy-btn" data-copy="code">${ICON_COPY} Copy code</button>
        <pre class="code"><code>${highlight(entry.code)}</code></pre>
      </div>
      <div class="panel" role="tabpanel" data-panel-body="notes" hidden>
        <div class="entry-note">${entry.notes}</div>
      </div>
    </article>`;
}

function renderCategory(category) {
  const entries = category.entries.map((entry) =>
    renderEntry({ ...entry, categoryTitle: category.title }),
  );
  return `
    <section class="category" id="cat-${category.id}" data-category="${category.id}">
      <div class="category-head">
        <h2><span class="category-index">${category.index}</span> ${category.title}</h2>
        <p>${category.blurb}</p>
      </div>
      <div class="entries">${entries.join('')}</div>
    </section>`;
}

function renderNav() {
  return catalog
    .map(
      (category) => `
      <div class="nav-group">
        <a class="nav-link" href="#cat-${category.id}" data-nav="${category.id}">
          <span>${category.title}</span>
          <span class="nav-count">${category.entries.length}</span>
        </a>
        <div class="nav-sub">
          ${category.entries
            .map(
              (entry) => `
            <a class="nav-sub-link" href="#${entry.id}"
               data-nav-entry="${entry.id}" data-nav-parent="${category.id}">${entry.title}</a>`,
            )
            .join('')}
        </div>
      </div>`,
    )
    .join('');
}

/* ── Boot ───────────────────────────────────────────────────── */

const content = document.querySelector('[data-content]');
const nav = document.querySelector('[data-nav-list]');
const totalOut = document.querySelector('[data-total]');

content.innerHTML = catalog.map(renderCategory).join('');
nav.innerHTML = renderNav();
totalOut.textContent = String(allEntries.length);

const entriesById = new Map(allEntries.map((entry) => [entry.id, entry]));
const mounted = new Map();

/* ── Lazy demo mounting ─────────────────────────────────────── */

const observer = new IntersectionObserver(
  (records) => {
    for (const record of records) {
      if (!record.isIntersecting) continue;
      const card = record.target;
      const id = card.dataset.entry;
      if (mounted.has(id)) continue;

      const entry = entriesById.get(id);
      const stage = card.querySelector('[data-stage]');
      if (!entry || !stage) continue;

      const hint = stage.querySelector('.stage-hint');
      let handle = {};
      try {
        handle = entry.mount(stage) ?? {};
      } catch (error) {
        stage.innerHTML = `<div class="d-readout">This demo failed to start: ${
          error instanceof Error ? error.message : String(error)
        }</div>`;
        console.error(`[motion] ${id} failed to mount`, error);
      }
      if (hint) stage.appendChild(hint);

      if (handle.replay) {
        const button = document.createElement('button');
        button.className = 'stage-replay';
        button.type = 'button';
        button.innerHTML = `${ICON_REPLAY} Replay`;
        button.addEventListener('click', handle.replay);
        stage.appendChild(button);
      }

      mounted.set(id, handle);
      observer.unobserve(card);
    }
  },
  { rootMargin: '160px 0px' },
);

for (const card of document.querySelectorAll('[data-entry]')) observer.observe(card);

/* ── Panel tabs ─────────────────────────────────────────────── */

content.addEventListener('click', (event) => {
  const tab = event.target.closest('.panel-tab');
  if (!tab) return;

  const card = tab.closest('.entry');
  const name = tab.dataset.panel;

  for (const other of card.querySelectorAll('.panel-tab')) {
    other.setAttribute('aria-selected', String(other === tab));
  }
  for (const panel of card.querySelectorAll('[data-panel-body]')) {
    panel.hidden = panel.dataset.panelBody !== name;
  }
});

/* ── Copy ───────────────────────────────────────────────────── */

content.addEventListener('click', async (event) => {
  const button = event.target.closest('.copy-btn');
  if (!button) return;

  const card = button.closest('.entry');
  const entry = entriesById.get(card.dataset.entry);
  if (!entry) return;

  const payload = button.dataset.copy === 'code' ? entry.code : entry.prompt;
  const label = button.dataset.copy === 'code' ? 'Copy code' : 'Copy prompt';

  try {
    await navigator.clipboard.writeText(payload);
    button.classList.add('is-copied');
    button.innerHTML = `${ICON_COPY} Copied`;
  } catch {
    // Clipboard API needs a secure context; select the text so ⌘C still works.
    const range = document.createRange();
    range.selectNodeContents(card.querySelector(`[data-panel-body="${button.dataset.copy}"]`));
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    button.innerHTML = `${ICON_COPY} Press ⌘C`;
  }

  setTimeout(() => {
    button.classList.remove('is-copied');
    button.innerHTML = `${ICON_COPY} ${label}`;
  }, 1600);
});

/* ── Search ─────────────────────────────────────────────────── */

const search = document.querySelector('[data-search-input]');
const empty = document.querySelector('[data-empty]');

search.addEventListener('input', () => {
  const query = search.value.trim().toLowerCase();
  let visible = 0;

  for (const card of document.querySelectorAll('[data-entry]')) {
    const match = query === '' || card.dataset.search.includes(query);
    card.classList.toggle('is-hidden', !match);
    if (match) visible++;
  }

  // Hide a category whose every entry filtered out.
  for (const section of document.querySelectorAll('[data-category]')) {
    const any = section.querySelector('[data-entry]:not(.is-hidden)');
    section.style.display = any ? '' : 'none';
  }

  empty.hidden = visible > 0;
});

/* ── Scrollspy ──────────────────────────────────────────────── */

const spy = new IntersectionObserver(
  (records) => {
    for (const record of records) {
      if (!record.isIntersecting) continue;

      const id = record.target.dataset.entry;
      const link = nav.querySelector(`[data-nav-entry="${id}"]`);
      if (!link) continue;
      const parent = link.dataset.navParent;

      for (const other of nav.querySelectorAll('[data-nav-entry]')) {
        other.setAttribute('aria-current', String(other === link));
      }
      for (const other of nav.querySelectorAll('[data-nav]')) {
        other.setAttribute('aria-current', String(other.dataset.nav === parent));
      }
    }
  },
  { rootMargin: '-12% 0px -70% 0px' },
);

for (const card of document.querySelectorAll('[data-entry]')) spy.observe(card);

/* ── Theme ──────────────────────────────────────────────────── */

// Absent when the page is embedded somewhere that owns the theme itself — the
// CSS reads both `prefers-color-scheme` and a stamped `data-theme`, so leaving
// the attribute alone is the correct behaviour rather than a degraded one.
const themeButton = document.querySelector('[data-theme-toggle]');
const themeLabel = themeButton?.querySelector('[data-theme-label]');

function systemTheme() {
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  if (themeLabel) {
    themeLabel.textContent =
      theme === 'system' ? `System (${systemTheme()})` : theme === 'dark' ? 'Dark' : 'Light';
  }
  localStorage.setItem('motion-theme', theme);
}

if (themeButton) {
  const THEMES = ['system', 'light', 'dark'];
  let theme = localStorage.getItem('motion-theme') ?? 'system';
  applyTheme(THEMES.includes(theme) ? theme : 'system');

  themeButton.addEventListener('click', () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    applyTheme(theme);
  });
}

/* ── Reduced-motion notice ──────────────────────────────────── */

const banner = document.querySelector('[data-rm-banner]');

function syncReducedMotion(reduced) {
  banner.classList.toggle('is-visible', reduced);
}

syncReducedMotion(prefersReducedMotion());
onReducedMotionChange(syncReducedMotion);
