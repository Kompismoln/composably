import type { Plugin } from 'vite';
import type { Config } from './types.d.ts';
export default function composably(config: Config): Promise<Plugin[]>;
