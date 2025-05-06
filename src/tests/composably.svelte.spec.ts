import { render } from '@testing-library/svelte';
import content from 'composably:content';
import page from 'composably:content/page';
import { expect, test } from 'vitest';

test('page-json.json', async () => {
  const { component, ...props } = await content('page-json');
  const { getByTestId } = render(component, { props });
  expect(getByTestId('page-title').innerHTML).toBe('page-json');
});

test('page-js.js', async () => {
  const { component, ...props } = await content('page-js');
  const { getByTestId } = render(component, { props });
  expect(getByTestId('page-title').innerHTML).toBe('page-js');
});

test('page-ts.ts', async () => {
  const { component, ...props } = await content('page-ts');
  const { getByTestId } = render(component, { props });
  expect(getByTestId('page-title').innerHTML).toBe('page-ts');
});

test('direct page import', async () => {
  const { component, ...props } = await page();
  const { getByTestId } = render(component, { props });
  expect(getByTestId('page-title').innerHTML).toBe('List page');
});

test('free page', async () => {
  const { component, ...props } = await content('page');
  const { getByTestId } = render(component, { props });
  expect(getByTestId('list-item-slot-prop').innerHTML).toBe('list-item-slot');
  expect(getByTestId('fragment-slot-prop').innerHTML).toBe('fragment-slot');
});

test('site 404', async () => {
  const noPagePromise = content('no-page');
  await expect(noPagePromise).rejects.toThrow('Unknown content path: no-page');
});

test('site index', async () => {
  const { component, ...props } = await content('');
  const { getByTestId, getByLabelText } = render(component, { props });

  expect(getByTestId('h1').innerHTML).toBe('Hello');
  expect(getByTestId('fragment-slot-prop').innerHTML).toBe('fragment-slot');
  expect(getByTestId('fragment-component').children[0].textContent).toBe(
    'fragment-slot'
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
