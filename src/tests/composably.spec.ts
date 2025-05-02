import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { globSync } from 'node:fs';
import { __test__ } from '../lib/content.js';
import config from '../../composably.config.js';

const attachFragment = __test__.loadAndAttachFragments;
config.root = process.cwd();

// Define expected structure for test results if possible
interface TestResult1 {
  // Expected props after fragment merging
  foo?: string;
  test?: { foo: string };
  test2?: { foo: string };
  // Add other expected props
}
interface TestResultDeep {
  test: { test2: { foo: string } };
}

const noop = () => {};

describe('fragments', () => {
  it('attaches fragments', async () => {
    let obj = {};
    obj = { _: 'test/_test-0.yaml' };
    obj = (await attachFragment(obj, config, noop)) as TestResult1;
    expect(obj).deep.equal({});

    obj = { _test: 'test/_test-0.yaml' };
    obj = (await attachFragment(obj, config, noop)) as TestResult1;
    expect(obj.test).toBeUndefined();

    obj = { _: 'test/_test-1.yaml' };
    obj = (await attachFragment(obj, config, noop)) as TestResult1;
    expect(obj.foo).eq('bar');

    obj = { _test: 'test/_test-1.yaml' };
    obj = (await attachFragment(obj, config, noop)) as TestResult1;
    expect(obj.test.foo).eq('bar');

    obj = { _: 'test/_test-2.yaml' };
    obj = (await attachFragment(obj, config, noop)) as TestResultDeep;
    expect(obj.test2.foo).eq('bar');

    obj = { _test: 'test/_test-2.yaml' };
    obj = await attachFragment(obj, config, noop);
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
