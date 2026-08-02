/**
 * hooks.ts — React bindings for motion-core.
 *
 * Copy this and motion-core.ts into a project and every code sample in the
 * catalogue compiles as written. React 18 or 19.
 */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  type SpringValue,
  type SpringValueOptions,
  type StaggerOptions,
  createDragGesture,
  createSpringValue,
  type DragGestureOptions,
  onFrame,
  onReducedMotionChange,
  prefersReducedMotion,
  stagger,
} from './motion-core';

/**
 * Subscribe to the user's reduced-motion preference.
 *
 * `useSyncExternalStore` rather than useState + useEffect: it is SSR-safe (the
 * server snapshot returns false) and it cannot tear during a concurrent render.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    onReducedMotionChange,
    prefersReducedMotion,
    () => false,
  );
}

/**
 * An interruptible spring-driven scalar.
 *
 * The returned handle is stable across renders. Writes go through `onChange` to
 * a ref — deliberately NOT through React state. A spring updates every frame,
 * and routing 60 state updates per second through the reconciler re-renders the
 * subtree 60 times to move one transform. Write the style directly.
 *
 * ```tsx
 * const box = useRef<HTMLDivElement>(null);
 * const x = useSpringValue(0, {
 *   ...SpringPresets.snappy,
 *   onChange: (v) => { box.current!.style.transform = `translateX(${v}px)`; },
 * });
 * ```
 */
export function useSpringValue(initial: number, options: SpringValueOptions = {}): SpringValue {
  // Keep the latest callbacks without recreating the spring each render.
  const latest = useRef(options);
  latest.current = options;

  const spring = useMemo(
    () =>
      createSpringValue(initial, {
        ...options,
        onChange: (value, velocity) => latest.current.onChange?.(value, velocity),
        onRest: (value) => latest.current.onRest?.(value),
      }),
    // Intentionally mount-only: the handle must be stable, and config changes
    // are applied by callers via a fresh spring when they genuinely need one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => () => spring.stop(), [spring]);

  return spring;
}

/**
 * Drive a spring toward a target that comes from React state.
 *
 * Use when the value is declarative (open/closed, selected index) rather than
 * gesture-driven. For gestures, hold the handle from `useSpringValue` and call
 * `jump` during the drag and `setWithVelocity` on release.
 */
export function useSpringTo(target: number, options: SpringValueOptions = {}): SpringValue {
  const spring = useSpringValue(target, options);

  useEffect(() => {
    spring.set(target);
  }, [target, spring]);

  return spring;
}

/**
 * Attach a drag gesture to a ref'd element.
 *
 * Remember `touch-action: none` on the element, or the browser claims the
 * gesture before your handlers ever see it.
 */
export function useDragGesture<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  options: DragGestureOptions = {},
): void {
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    return createDragGesture(node, {
      axis: latest.current.axis ?? 'y',
      onStart: () => latest.current.onStart?.(),
      onMove: (delta) => latest.current.onMove?.(delta),
      onEnd: (delta, velocity) => latest.current.onEnd?.(delta, velocity),
    });
  }, [ref]);
}

/**
 * Stable stagger calculator for a list of `count` items.
 *
 * Returns 0 for every index under reduced motion, so the whole sequence lands
 * at once without the caller special-casing it.
 */
export function useStagger(count: number, options: StaggerOptions = {}): (index: number) => number {
  const reduced = useReducedMotion();
  const { each, from, maxTotal } = options;

  return useCallback(
    (index: number) => {
      if (reduced) return 0;
      return stagger(index, count, {
        ...(each !== undefined && { each }),
        ...(from !== undefined && { from }),
        ...(maxTotal !== undefined && { maxTotal }),
      });
    },
    [count, each, from, maxTotal, reduced],
  );
}

/**
 * Run a callback on every animation frame while `active` is true.
 *
 * Shares the single global rAF loop from motion-core rather than opening
 * another one per component.
 */
export function useFrame(callback: (now: number) => void, active = true): void {
  const latest = useRef(callback);
  latest.current = callback;

  useEffect(() => {
    if (!active) return;
    return onFrame((now) => latest.current(now));
  }, [active]);
}
