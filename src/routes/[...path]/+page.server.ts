import { discoverContentPaths } from '$lib/content.js';

const config = {
  componentRoot: 'src/components',
  contentRoot: 'src/content',
  indexFile: 'index'
};

export const entries = () =>
  discoverContentPaths(config).map((path) => ({ path }));
