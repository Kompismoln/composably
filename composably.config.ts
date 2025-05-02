import type { Config } from './src/lib/types.d.ts';
import rehypeDaisyUI from './src/plugins/rehypeClassAdder.js';
import remarkReplace from './src/plugins/remarkReplace.js';
import validator from './src/plugins/validator.js';

const config: Config = {
  componentRoot: 'src/components',
  contentRoot: 'src/content',
  indexFile: 'index',
  validator,
  remarkPlugins: [remarkReplace],
  rehypePlugins: [rehypeDaisyUI]
};

export default config;
