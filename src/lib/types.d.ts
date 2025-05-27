import type { ComponentType } from 'svelte';
import type { Plugin } from 'unified';
import type { Root as MdastRoot } from 'mdast';
import type { Root as HastRoot } from 'hast';

import {
  z, // The main Zod export
  ZodTypeAny, // A base type for any Zod schema
  ZodString,
  ZodObject,
  ZodBoolean,
  ZodEnum,
  ZodRecord,
  ZodOptional,
  ZodEffects, // For .transform(), .refine()
  ZodUnion // For .or()
  // Import other specific Zod types as needed
} from 'zod';

export type ComponentValidator = (
  content: SourceComponentContent,
  reportFileDependency: (filePath: string) => void,
  config: Config
) => Promise<SourceComponentContent>;

export interface Config {
  root: string;
  componentRoot: string;
  contentRoot: string;
  indexFile: string;
  componentPrefix: string;
  contentPrefix: string;
  remarkPlugins: Plugin<unknown, MdastRoot>[];
  rehypePlugins: Plugin<unknown, HastRoot>[];
  validator: ComponentValidator;
}

export type PartialConfig = Partial<Config>;

/**
 * Represents the raw, parsed data from a fragment file.
 * Can contain any structure defined within the fragment.
 */
export type Fragment = Record<string, unknown>;

/**
 * Represents a piece of content that should be rendered by a Svelte component.
 * Requires the component path (relative to componentRoot, without .svelte)
 * and allows any other properties to be passed as props.
 */
export interface SourceComponentContent {
  component: string;
  [key: string]: unknown; // Props for the component
}

export type SourceVirtualComponentContent = SourceComponentContent & {
  html: string;
};

/**
 * Represents the fully processed data for a content page,
 * ready to be used for rendering.
 */
export interface SourcePageContent {
  title: string; // Mandatory title for the page
  component?: string; // Optional top-level component for the page layout
  components?: SourceComponentContent[]; // Optional list of components within the page body/structure
  [key: string]: unknown; // Component data if page is also a component
}

/**
 * Runtime ComponentContent: Takes SourceComponentContent, removes the 'component'
 * property (string), and adds it back as ComponentType. Inherits the index signature.
 */
export type ComponentContent = Omit<SourceComponentContent, 'component'> & {
  component: ComponentType; // Override with resolved Svelte Component
};

/**
 * Runtime PageContent: Takes SourcePageContent, removes 'component' and 'components',
 * then adds them back with their runtime types (ComponentType and ComponentContent[]).
 * Inherits 'title' and the index signature.
 */
export type PageContent = Omit<
  SourcePageContent,
  'component' | 'components'
> & {
  component?: ComponentType; // Override with optional resolved ComponentType
  components?: ComponentContent[]; // Override with list of runtime ComponentContent
};
// --- Utility Types ---

/**
 * Generic type for a function that traverses an object/array structure asynchronously.
 */
export type ContentTraverser = (handle: {
  obj: Fragment | Fragment[];
  filter: (val: Fragment) => boolean; // Filter can operate on any value during traversal
  callback: (val: Fragment) => Promise<Fragment>; // Callback processes filtered values
}) => Promise<Fragment | Fragment[]>;

// --- VFile Augmentation ---
// This tells TypeScript about the custom properties you add to file.data

// Define the structure of a heading object as used in your headings plugin
interface HeadingData {
  depth: number;
  text: string;
  id?: string; // id can be undefined if headerId doesn't find one
}

interface MarkdownOptions {
  decreaseHeadings?: boolean;
}

// Augment the VFile module's DataMap interface
declare module 'vfile' {
  interface DataMap {
    // Define the structure of the 'meta' property you access
    meta?: {
      options?: {
        decreaseHeadings?: boolean;
        // Add other potential options here if needed
      };
      // Add other potential meta properties here if needed
    };

    // Define the structure of the 'props' property you add and access
    // Use Record<string, unknown> to allow arbitrary properties,
    // but explicitly define known ones like 'headings' for better type safety.
    props?: {
      headings?: HeadingData[];
      // Allows other properties to be added dynamically by plugins/logic
      [key: string]: unknown;
    };

    // You can add other custom top-level properties here if your plugins add them
    // e.g., if a plugin added file.data.summary, you'd add:
    // summary?: string;
  }
}

import type {
  Extension as MicromarkExtension,
  HtmlExtension as MicromarkHtmlExtension
} from 'micromark-util-types';
import type { FromMarkdownExtension } from 'mdast-util-from-markdown';
import type { ToMarkdownExtension } from 'mdast-util-to-markdown';

// === Augmentation Start ===
// Tell TypeScript that the unified processor's data object can hold these properties.
declare module 'unified' {
  interface Data {
    micromarkExtensions?: (MicromarkExtension | MicromarkHtmlExtension)[];
    fromMarkdownExtensions?: FromMarkdownExtension[];
    toMarkdownExtensions?: ToMarkdownExtension[];
  }
}

declare function process(val: SourceComponentContent): SourceComponentContent;
declare function shortHash(val: string): string;

// Interface for your custom methods with precise return types
interface CustomCUtilities {
  content: (obj: Record<string, ZodTypeAny>) => ZodEffects<
    ZodObject<
      { [K in keyof typeof obj]: (typeof obj)[K] } & { component: ZodString }, // Input shape to object
      'strict', // Strict mode
      ZodTypeAny // Catchall for passthrough (can be more specific)
    >,
    SourceComponentContent, // Output type of the transform
    SourceComponentContent & { component: string } // Input type of the transform
  >;

  markdown: (options?: MarkdownOptions) => ZodUnion<
    [
      ZodEffects<ZodString, SourceComponentContent, string>, // string -> transform
      ReturnType<this['content']> // schema from c.content({})
    ]
  >;

  component: (allowed?: string[] | null) => ZodObject<
    { component: ZodString | ZodEnum<[string, ...string[]]> },
    'passthrough', // Passthrough mode
    ZodTypeAny
  >;

  slots: (
    allowed?: string[] | null
  ) => ZodOptional<ZodRecord<ZodString, ReturnType<this['component']>>>;

  image: () => ZodObject<{ src: ZodString; alt: ZodString }>;

  link: () => ZodObject<{
    url: ZodString;
    text: ZodString;
    blank: ZodOptional<ZodBoolean>;
  }>;

  button: () => ZodObject<{
    url: ZodString;
    text: ZodString;
    fill: ZodOptional<ZodBoolean>;
  }>;

  social: () => ZodObject<{
    url: ZodString;
    platform: ZodEnum<
      [
        'twitter',
        'facebook',
        'mastodon',
        'instagram',
        'youtube',
        'bluesky',
        'tiktok'
      ]
    >;
  }>;
}

export type CType = typeof z & CustomCUtilities;
