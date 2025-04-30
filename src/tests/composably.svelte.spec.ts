import { render } from '@testing-library/svelte'
import content from 'composably:content'
import { expect, test } from 'vitest'

test('site components', async () => {
  const { component, ...props } = await (await content['']()).default()
  const { getByTestId } = render(component, { props })

  expect(getByTestId('h1').innerHTML).toBe('Hello');
  expect(getByTestId('slot-prop').innerHTML).toBe('hello');
  expect(getByTestId('fragment-component').children[0].innerHTML).toBe('hello');
  expect(getByTestId('test-body').children[0].tagName).toBe('H2');
  expect(getByTestId('test-body').children[1].innerHTML).toBe('{{title}}="Hello"');
})
