<script module>
  import { c } from '../lib/schemas.js';

  export const schema = c.content({
    text: c.markdown(),
    slots: c.slots()
  });
</script>

<script lang="ts">
  const { text } = $props();
</script>

<text.component {...text} />
