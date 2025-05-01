import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { globSync } from 'node:fs';
import { parseFragment, setConfig } from '../lib/content.loader.js';

const config = {
  componentRoot: 'src/components',
  contentRoot: 'src/content',
  indexFile: 'index'
};

setConfig(config);

describe('fragments', () => {
  it('attaches fragments', async () => {
    let obj = {};
    obj = { _: 'test/_test-0.yaml' };
    obj = await parseFragment(obj);
    expect(obj).deep.equal({});

    obj = { _test: 'test/_test-0.yaml' };
    obj = await parseFragment(obj);
    expect(obj.test).toBeUndefined();

    obj = { _: 'test/_test-1.yaml' };
    obj = await parseFragment(obj);
    expect(obj.foo).eq('bar');

    obj = { _test: 'test/_test-1.yaml' };
    obj = await parseFragment(obj);
    expect(obj.test.foo).eq('bar');

    obj = { _: 'test/_test-2.yaml' };
    obj = await parseFragment(obj);
    expect(obj.test2.foo).eq('bar');

    obj = { _test: 'test/_test-2.yaml' };
    obj = await parseFragment(obj);
    expect(obj.test.test2.foo).eq('bar');
  });
});

describe('playground', () => {
  it('finds page.yaml in content', () => {
    const contentDir = path.resolve(process.cwd(), 'src/lib/content');
    const pattern = path.join(contentDir, '**', 'page.@(yaml|md)');
    const files = globSync(pattern);
    const content = Object.fromEntries(
      files.map((file) => [path.dirname(path.relative(contentDir, file)), file])
    );
  });
});
