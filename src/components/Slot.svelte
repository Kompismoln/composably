<script module>
  import { c } from '../lib/schemas.js';

  export const schema = c.content({
    sentinel: c.string()
  });
</script>
<script>
  let props = $props();
</script>
<div data-testid="slot-prop">{props.sentinel}</div>
