<script module>
  import { c } from '../lib/schemas.js';

  export const schema = c.content({
    theme: c.string().optional(),
    icon: c.string(),
    text: c.markdown()
  });
</script>

<script lang="ts">
  const { theme, icon, text } = $props();
</script>

<div role="alert" class="not-prose alert {theme}">
  <i class="fa-solid text-3xl {icon}"></i>
  <span>{@html text.html}</span>
</div>
