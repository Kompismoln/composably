import z from 'zod';
import type { ComponentContent } from './types.d.ts';
import { shortHash } from './utils.js';

/**
 * Provides the following utility schemas:
 *
 * - content
 *   Wrapper and a z.object type that allows a component property and parses
 *   markdown fields.
 *
 * - component
 *   An enumeration of component names that will be imported and
 *   made available under the property name.
 *
 * - slots
 *   A z.array with components that should render on the client.
 *
 */

const handler = {
  get(target: any, prop: string) {
    // Check target first
    if (prop in target) {
      return target[prop];
    }
    // Check if prop is a valid own property of the imported 'z' object
    if (Object.prototype.hasOwnProperty.call(z, prop)) {
      // Assert that prop is a key of z before indexing
      return z[prop as keyof typeof z];
    }
    // Return undefined or throw an error if prop is not found anywhere
    return undefined;
  }
};

const process = async (content: ComponentContent) => {
  const isVirtualComponent = (prop: any): prop is ComponentContent => {
    return (
      !!prop &&
      typeof prop === 'object' &&
      'component' in prop &&
      typeof prop.component === 'string' &&
      prop.component.startsWith('composably:')
    );
  };

  const { component, ...props } = content;

  const entries = Object.entries(content).map(([key, val]) => {
    if (isVirtualComponent(val)) {
      delete props[key];
      val.parent = props;
    }
    return [key, val];
  });

  return Object.fromEntries(entries);
};

const types = {
  content: (obj: any) => {
    return z
      .object({ ...obj, component: z.string(), meta: c.meta() })
      .strict()
      .transform((val) => process(val as ComponentContent));
  },

  meta: () => {
    return z
      .object({
        svelte: z.boolean().optional()
      })
      .optional();
  },

  markdown: (options = {}) => {
    const prepare = (val: string): ComponentContent => ({
      component: `composably:component/${shortHash(val)}`,
      markdown: val,
      options
    });
    return z.string().transform(prepare).or(types.content({}));
  },

  component: (allowed: string[] | null = null) => {
    const component = allowed
      ? z.enum(allowed as [string, ...string[]])
      : z.string();

    return z.object({ component }).passthrough();
  },

  slots: (allowed = null) => z.record(types.component(allowed)).optional(),

  image: () =>
    z.object({
      src: z.string(),
      alt: z.string()
    }),

  link: () =>
    z.object({
      url: z.string(),
      text: z.string(),
      blank: z.boolean().optional()
    }),

  button: () =>
    z.object({
      url: z.string(),
      text: z.string(),
      fill: z.boolean().optional()
    }),

  social: () =>
    z.object({
      url: z.string(),
      platform: z.enum([
        'twitter',
        'facebook',
        'mastodon',
        'instagram',
        'youtube',
        'bluesky',
        'tiktok'
      ])
    })
};

export const c = new Proxy(types, handler);
