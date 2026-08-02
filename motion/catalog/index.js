import * as press from './press.js';
import * as physics from './physics.js';
import * as drawers from './drawers.js';
import * as prompts from './prompts.js';
import * as dashboard from './dashboard.js';
import * as text from './text.js';

/**
 * Ordered so the page reads as an argument: feedback primitives first, then the
 * physics underneath them, then the three surfaces where that physics does the
 * most work.
 */
const modules = [press, physics, drawers, prompts, dashboard, text];

export const catalog = modules.map((module) => ({
  ...module.category,
  entries: module.entries,
}));

export const allEntries = catalog.flatMap((category) =>
  category.entries.map((entry) => ({ ...entry, category: category.id })),
);
