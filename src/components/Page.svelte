<script module>
  import { c } from '../lib/schemas.js';

  export const schema = c.content({
    title: c.string(),
    components: c.array(c.component()).optional()
  });
</script>

<script lang="ts">
  let page = $props();
</script>

<h1 data-testid="page-title">{page.title}</h1>

{#if page.components}
  {#each page.components as section, key (key)}
    <section.component {...section} />
  {/each}
{/if}
