import type { PartialConfig } from './src/lib/types.d.ts';
import rehypeDaisyUI from './src/plugins/rehypeClassAdder.js';
import remarkReplace from './src/plugins/remarkReplace.js';

const config: PartialConfig = {
  root: process.cwd(), // set temporarily to bypass build error
  componentRoot: 'src/components',
  contentRoot: 'src/content',
  remarkPlugins: [remarkReplace],
  rehypePlugins: [rehypeDaisyUI]
};

export default config;
