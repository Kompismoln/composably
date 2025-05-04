import { render } from '@testing-library/svelte';
import content from 'composably:content';
import about from 'composably:content/about';
import { expect, test } from 'vitest';

test('direct page import', async () => {
  const { component, ...props } = await about();
  const { getByTestId } = render(component, { props });
  expect(getByTestId('h1').innerHTML).toBe('About');
});

test('site about', async () => {
  const { component, ...props } = await content('about');
  const { getByTestId } = render(component, { props });
  expect(getByTestId('h1').innerHTML).toBe('About');
});
test('site 404', async () => {
  const noPagePromise = content('no-page');
  await expect(noPagePromise).rejects.toThrow('Unknown content path: no-page');
});
test('site index', async () => {
  const { component, ...props } = await content('');
  const { getByTestId, getByLabelText } = render(component, { props });

  expect(getByTestId('h1').innerHTML).toBe('Hello');
  expect(getByTestId('slot-prop').innerHTML).toBe('hello');
  expect(getByTestId('fragment-component').children[0].textContent).toBe(
    'hello'
  );
  expect(getByTestId('test-body').children[0].tagName).toBe('H2');
  expect(getByTestId('test-body').children[0].id).toBe('h2-id');
  expect(getByTestId('test-body').children[0].classList[0]).toBe('h2-class');
  expect(getByTestId('test-body').children[1].textContent).toBe(
    '{{title}}="Hello"'
  );
  expect(
    getByTestId('test-body').children[2].children[0].children[0].textContent
  ).toBe('title');
  expect(getByTestId('headings').children[0].textContent).toBe('h2 1');
  expect(getByTestId('remark-replaced').textContent).toBe('remark-replaced');
  expect(getByLabelText('tada emoji').textContent).toBe('🎉');
});
