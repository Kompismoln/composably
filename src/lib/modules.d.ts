/**
 * Declare the virtual module used to access the list of content loaders.
 */
declare module 'composably:content' {
  /**
   * An object where keys are content entry slugs (e.g., 'about', 'home')
   * and values are functions that dynamically import the corresponding page module.
   */
  const content: (path: string) => Promise<PageContent>;
  export default content;
}

/**
 * Declare the type for individual page modules loaded via composably:content/*
 */
declare module 'composably:content/*' {
  /** Default export: An async function loading the page content. */
  const pageLoader: () => Promise<PageContent>;
  export default pageLoader;
}
