import type { Config } from './src/lib/types.d.ts';
import rehypeDaisyUI from './src/plugins/rehypeClassAdder.js';
import remarkReplace from './src/plugins/remarkReplace.js';

const config: Config = {
  root: process.cwd(), // set temporarily to bypass build error
  componentRoot: 'src/components',
  contentRoot: 'src/content',
  indexFile: 'index',
  remarkPlugins: [remarkReplace],
  rehypePlugins: [rehypeDaisyUI]
};

export default config;
