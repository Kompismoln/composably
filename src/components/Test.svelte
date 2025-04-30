<script module>
  import { c } from '../lib/schemas.js';

  export const schema = c.content({
    title: c.string().optional(),
    test: c.string(),
    body: c.markdown(),
    slots: c.slots()
  });
</script>

<script>
  let { title, test, body } = $props();
</script>

<h1>{title}</h1>
<body.component {...body} />
