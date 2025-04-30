import type { ResolvedComponent } from './types';
import { hydrate } from 'svelte';
import { browser } from '$app/environment';

/* Slots are components that attaches to a placeholder on mount.
 * Markdown parser render these placeholders.
 * This hook replaces them with the component.
 *
 * Usage:
 * mountSlots(slots)
 */
export function mountSlots(slots: Record<string, ResolvedComponent>) {
  if (browser) {
    for (const key in slots) {
      const slot = slots[key];
      const target = document.querySelector(`[data-slot="${key}"]`);

      if (target) {
        target.innerHTML = '';
        hydrate(slot.component, { target, props: slot });
      }
    }
  }
}
