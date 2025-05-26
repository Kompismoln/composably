import type { Config, PartialConfig } from './types.js';
import { colocate } from './validators.js';

const DEFAULTS: Config = {
  root: process.cwd(),
  componentRoot: 'components',
  contentRoot: 'content',
  componentPrefix: 'composably:component',
  contentPrefix: 'composably:content',
  indexFile: 'index',
  remarkPlugins: [],
  rehypePlugins: [],
  validator: colocate
};

export function resolveConfig(partial: PartialConfig = {}): Config {
  return {
    ...DEFAULTS,
    ...partial
  };
}
