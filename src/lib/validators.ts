import fs from 'node:fs/promises';
import { c } from './schemas.js';
import type { Config, SourceComponentContent } from './types.js';

export const colocate = async (
  content: SourceComponentContent,
  reportFileDependency: (filePath: string) => void,
  config: Config
): Promise<SourceComponentContent> => {
  const componentFilePath = `${config.componentRoot}/${content.component}.svelte`;

  const schema = await getSchema(componentFilePath);
  if (!schema?.spa) {
    return content;
  }
  const result = await schema.spa(content);

  if (!result.success) {
    throw new Error(
      `Component '${content.component}' failed validation: ${result.error?.message || 'Unknown validation error'}`
    );
  }

  reportFileDependency(componentFilePath);
  return result.data;
};

const getSchema = async (path: string) => {
  const code = await fs.readFile(path, 'utf8');
  const match = code.match(
    /export\s+const\s+schema\s*=\s*(c\.content\(([\s\S]*?)\));/
  );
  if (!match) return;
  const schemaDefinition = match[1];

  return new Function('c', `return ${schemaDefinition}`)(c);
};
