import type { Config, ComponentContent } from './types.js';
export declare const colocate: (
  content: ComponentContent,
  reportFileDependency: (filePath: string) => void,
  config: Config
) => Promise<any>;
