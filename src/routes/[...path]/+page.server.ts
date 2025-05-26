import { discoverContentPaths } from '../../lib/content.js';
import composablyConfig from '../../../composably.config.js';
import { resolveConfig } from '../../lib/config.js';

const config = resolveConfig(composablyConfig);

export const entries = () =>
  discoverContentPaths(config).map((path) => ({ path }));
