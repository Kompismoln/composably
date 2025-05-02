import { discoverContentPaths } from '$lib/content.js';
import composablyConfig from '../../../composably.config.js';

export const entries = () =>
  discoverContentPaths(composablyConfig).map((path) => ({ path }));
