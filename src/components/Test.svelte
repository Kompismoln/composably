<script module>
  import { c } from '../lib/schemas.js';

  export const schema = c.content({
    title: c.string(),
    body: c.markdown(),
    fragment: c.component(['Fragment']),
  });
</script>

<script>
  let { title, body, fragment } = $props();
</script>
<h1 data-testid="h1">{title}</h1>
<div data-testid="test-body">
  <body.component {...body} />
</div>
<div data-testid="fragment-component">
  <fragment.component {...fragment} />
</div>
