import type { SvelteComponent } from 'svelte';
import type { Plugin } from 'unified';
import type { Root as MdastRoot } from 'mdast';
import type { Root as HastRoot } from 'hast';

export type ComponentValidator = (
  content: SourceComponentContent,
  reportFileDependency: (filePath: string) => void,
  config: Config
) => Promise<SourceComponentContent>;

export interface Config {
  root?: string;
  componentRoot: string; // Root directory for Svelte components
  contentRoot: string; // Root directory for content files
  indexFile?: string; // Basename (without extension) of the file representing the root '/' path

  // Parsing/Plugin Options (conflated for now)
  remarkPlugins?: Plugin<unknown, MdastRoot>[];
  rehypePlugins?: Plugin<unknown, HastRoot>[];
  validator?: ComponentValidator;
  markdownField?: string; // Key holding markdown content after frontmatter parsing (Default: 'content')
  outputField?: string; // Key where parsed HTML output should be stored (Default: 'html')
}

/**
 * Represents the raw, parsed data from a fragment file.
 * Can contain any structure defined within the fragment.
 */
/**
 * Represents a piece of content that should be rendered by a Svelte component.
 * Requires the component path (relative to componentRoot, without .svelte)
 * and allows any other properties to be passed as props.
 */
export interface SourceComponentContent {
  component: string;
  [key: string]: unknown; // Props for the component
}

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
  component: SvelteComponent; // Override with resolved Svelte Component
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
  component?: SvelteComponent; // Override with optional resolved ComponentType
  components?: ComponentContent[]; // Override with list of runtime ComponentContent
};
// --- Utility Types ---
export type Fragment = Record<string, unknown>;
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

// Add a placeholder type for PageContent if it's not defined globally
// Replace this with your actual definition if it exists
// interface PageContent {
//  [key: string]: any;
//}
