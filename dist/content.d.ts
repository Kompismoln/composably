import type { ComponentContent, Config, PageContent } from './types.d.ts';
/**
 * Loads, parses, and processes content for a given site path, returning a Promise
 * for the final page content. It uses a callback to report processed virtual
 * components *during* its execution, enabling lazy loading while still capturing
 * necessary side data.
 *
 * @param searchPath The site path (e.g., 'about/team' or '').
 * @param config The application configuration object.
 * @param reportVirtualComponent A callback function invoked whenever a virtual
 * component is successfully processed. It receives the processed component content.
 * @returns A Promise resolving to the fully processed page data (type PageContent).
 */
export declare const loadContent: (searchPath: string, config: Config, reportVirtualComponent: (component: ComponentContent) => void, // Callback function signature
reportFileDependency: (filePath: string) => void) => Promise<PageContent>;
/**
 * Discovers potential content entry paths within the content root.
 * Filters out fragment files (starting with '_') and maps paths for routing.
 * Assumes it runs in a context where synchronous I/O is acceptable
 * (e.g., build time).
 *
 * @param config The application configuration object.
 * @returns An array of site paths corresponding to content files.
 */
export declare const discoverContentPaths: (config: Config) => string[];
export declare const __test__: {
    loadAndAttachFragments: (obj: any, config: Config, reportFileDependency: (filePath: string) => void) => Promise<any>;
};
