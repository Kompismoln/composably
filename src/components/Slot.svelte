<script module>
  import { c } from '../lib/schemas.js';
  import z from 'zod';

  export const schema = c.content({
    sentinel: c.object({
      id: c.string(),
      text: c.string()
    })
  });
</script>

<script lang="ts">
  let props: z.infer<typeof schema> = $props();
</script>

<div data-testid={props.sentinel.id}>{props.sentinel.text}</div>
