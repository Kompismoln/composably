<script module>
  import { c } from '../lib/schemas.js';

  export const schema = c.content({
    sentinel: c.object({
      id: c.string(),
      text: c.string()
    })
  });
</script>

<script lang="ts">
  let props = $props();
</script>

<div data-testid={props.sentinel.id}>{props.sentinel.text}</div>
