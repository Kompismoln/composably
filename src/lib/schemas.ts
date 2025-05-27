import { z, ZodSchema } from 'zod';
import type { CType, SourceComponentContent } from './types.d.ts';
import { shortHash } from './utils.js';

const process = (content: SourceComponentContent): SourceComponentContent => {
  const isVirtualComponent = (
    prop: unknown
  ): prop is SourceComponentContent => {
    return (
      !!prop &&
      typeof prop === 'object' &&
      'component' in prop &&
      typeof prop.component === 'string' &&
      // TODO: replace with config.componentPrefix
      prop.component.startsWith('composably:component')
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

  return Object.fromEntries(entries) as SourceComponentContent;
};

export const c: CType = {
  ...z,

  object: z.object,
  string: z.string,
  array: z.array,

  content: (obj: Record<string, ZodSchema>) => {
    return z
      .object({ ...obj, component: z.string() })
      .strict()
      .transform((val) => process(val as SourceComponentContent));
  },

  markdown: (options = {}) => {
    const prepare = (val: string): SourceComponentContent => ({
      // TODO: replace with config.componentPrefix
      component: `composably:component/${shortHash(val)}.svelte`,
      markdown: val,
      options
    });
    return z.string().transform(prepare).or(c.content({}));
  },

  component: (allowed: string[] | null = null) => {
    const component = allowed
      ? z.enum(allowed as [string, ...string[]])
      : z.string();

    return z.object({ component }).passthrough();
  },

  slots: (allowed = null) => z.record(c.component(allowed)).optional(),

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
