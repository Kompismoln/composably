import { discoverContentPaths, setConfig } from '$lib/content.loader.js';

setConfig({
  componentRoot: 'src/components',
  contentRoot: 'src/content',
  indexFile: 'index'
});

export const entries = () => discoverContentPaths().map((path) => ({ path }));

