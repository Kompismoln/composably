import type { ComponentContent, Config } from './types.d.ts';
export declare let config: Config;
export declare const setConfig: (newConfig: Config) => void;
export declare const findPageContent: (searchPath: string) => Promise<any>;
export declare const parseFile: (filePath: string) => Promise<any>;
export declare const parseFragment: (obj: any) => Promise<any>;
export declare const discoverContentPaths: () => any;
export declare const loadContent: (searchPath: string, virtualComponents: (v: ComponentContent) => void) => Promise<any>;
export declare const validateAndTransformComponent: (content: ComponentContent) => Promise<ComponentContent>;
