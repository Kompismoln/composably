<script module>
  import { c } from '../lib/schemas.js';

  export const schema = c.content({
    title: c.string(),
    body: c.markdown()
  });
</script>

<script lang="ts">
  let { title, body } = $props();
</script>

<h1>{title}</h1>
<body.component {...body} />
