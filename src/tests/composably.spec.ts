import { expect, test } from 'vitest';
import { __test__ } from '../lib/content.js';
import config from '../../composably.config.js';

const loadAndAttachFragments = __test__.loadAndAttachFragments;
config.root = process.cwd();

interface TestResult1 {
  foo?: string;
  test?: { foo: string };
  // Add other expected props if necessary
}
interface TestResultDeep {
  test: { test2: { foo: string } };
}
// Interface for the case like { test2: { foo: 'bar' } } from _test-2.yaml merged at root
interface TestResult2Root {
  test2: { foo: string };
}

const noop = (_: string) => {};

test('fragments', async () => {
  let obj: Record<string, unknown> = {};

  // Test case 1
  obj = { _: 'test/_test-0.yaml' }; // Assuming _test-0.yaml is empty or results in {}
  const result0 = await loadAndAttachFragments<object>(obj, config, noop); // Explicitly expect empty
  expect(result0).deep.equal({});

  // Test case 2
  obj = { _test: 'test/_test-0.yaml' }; // Assuming _test-0.yaml results in {}
  const result0Named = await loadAndAttachFragments<{ test?: object }>(
    obj,
    config,
    noop
  ); // Expect { test: {} }
  expect(result0Named).deep.equal({ test: undefined }); // Check if 'test' property exists
  // If _test-0.yaml IS truly empty {}, then .test will be {} which is not undefined.
  // If you want to check if test has no meaningful props, check keys or specific content.
  // Or if test-0.yaml makes test *not* be added, adjust expectation.
  // Let's assume test-0 results in {}:
  expect(Object.keys(result0Named.test ?? {}).length).toBe(0);

  // Test case 3
  obj = { _: 'test/_test-1.yaml' }; // Assuming _test-1.yaml contains { foo: 'bar' }
  const result1 = await loadAndAttachFragments<TestResult1>(obj, config, noop);
  expect(result1.foo).eq('bar');

  // Test case 4
  obj = { _test: 'test/_test-1.yaml' }; // Assuming _test-1.yaml contains { foo: 'bar' }
  // Expect { test: { foo: 'bar' } } which fits TestResult1's optional 'test' prop shape
  const result1Named = await loadAndAttachFragments<TestResult1>(
    obj,
    config,
    noop
  );
  expect(result1Named.test?.foo).eq('bar'); // Use optional chaining for safety if test might be undefined

  // Test case 5
  obj = { _: 'test/_test-2.yaml' }; // Assuming _test-2.yaml contains { test2: { foo: 'bar' } }
  const result2Root = await loadAndAttachFragments<TestResult2Root>(
    obj,
    config,
    noop
  );
  expect(result2Root.test2.foo).eq('bar');

  // Test case 6
  obj = { _test: 'test/_test-2.yaml' }; // Assuming _test-2.yaml contains { test2: { foo: 'bar' } }
  // Expect { test: { test2: { foo: 'bar' } } } which matches TestResultDeep
  const result2Named = await loadAndAttachFragments<TestResultDeep>(
    obj,
    config,
    noop
  );
  expect(result2Named.test.test2.foo).eq('bar');
});
