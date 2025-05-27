import fs from 'node:fs/promises';
import { c } from './schemas.js';
import type { ComponentValidator, CType } from './types.js';
import { ValidationError } from './errors.js';
import { z } from 'zod';

export const colocate: ComponentValidator = async (
  content,
  reportFileDependency,
  config
) => {
  const componentFilePath = `${config.componentRoot}/${content.component}.svelte`;

  const schema = await getSchema(componentFilePath);

  if (!schema) {
    throw new ValidationError(content.component, null);
  }

  const result = await schema.spa(content);

  if (!result.success) {
    throw new ValidationError(content.component, result.error);
  }

  reportFileDependency(componentFilePath);

  const _content = c.content({});

  return result.data as z.infer<typeof _content>;
};

const getSchema = async (path: string) => {
  const code = await fs.readFile(path, 'utf8');
  const match = code.match(
    /export\s+const\s+schema\s*=\s*(c\.content\(([\s\S]*?)\));/
  );
  if (!match) return;
  const schemaDefinition = match[1];

  type DynamicSchemaGenerator = (context: CType) => z.ZodSchema;

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const untypedGeneratedFunction = new Function(
    'c',
    `return ${schemaDefinition}`
  );

  const typedGeneratedFunction =
    untypedGeneratedFunction as DynamicSchemaGenerator;

  return typedGeneratedFunction(c);
};
