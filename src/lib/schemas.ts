import z, { ZodSchema } from 'zod';
import type { SourceComponentContent } from './types.d.ts';
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
  get(target: typeof composablyTypes, prop: string) {
    // Check target first
    if (Object.hasOwn(target, prop)) {
      return target[prop as keyof typeof target];
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

const process = async (content: SourceComponentContent) => {
  const isVirtualComponent = (
    prop: unknown
  ): prop is SourceComponentContent => {
    return (
      !!prop &&
      typeof prop === 'object' &&
      'component' in prop &&
      typeof prop.component === 'string' &&
      prop.component.startsWith('composably:')
    );
  };

  const { component: _, ...props } = content;

  const entries = Object.entries(content).map(([key, val]) => {
    if (isVirtualComponent(val)) {
      delete props[key];
      val.parent = props;
    }
    return [key, val];
  });

  return Object.fromEntries(entries);
};

const composablyTypes = {
  content: (obj: Record<string, ZodSchema>) => {
    return z
      .object({ ...obj, component: z.string(), meta: c.meta() })
      .strict()
      .transform((val) => process(val as SourceComponentContent));
  },

  meta: () => {
    return z
      .object({
        svelte: z.boolean().optional()
      })
      .optional();
  },

  markdown: (options = {}) => {
    const prepare = (val: string): SourceComponentContent => ({
      component: `composably:component/${shortHash(val)}`,
      markdown: val,
      options
    });
    return z.string().transform(prepare).or(composablyTypes.content({}));
  },

  component: (allowed: string[] | null = null) => {
    const component = allowed
      ? z.enum(allowed as [string, ...string[]])
      : z.string();

    return z.object({ component }).passthrough();
  },

  slots: (allowed = null) =>
    z.record(composablyTypes.component(allowed)).optional(),

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

// Define a type alias for the combined type
export type ComposablyZod = typeof composablyTypes & typeof z;
export const c = new Proxy(composablyTypes, handler) as ComposablyZod;
