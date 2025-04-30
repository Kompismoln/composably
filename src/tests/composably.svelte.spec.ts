import { render } from '@testing-library/svelte'
import content from 'composably:content'
import { expect, test } from 'vitest'

test('renders virtual component', async () => {
  const { component, ...props } = (await content['']()).default
  const { getByText } = render(component, { props })

  expect(getByText('test-title')).toBeInTheDocument()
})
