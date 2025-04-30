<script lang="ts">
  let page = $props();
</script>

{#if page.component}
  <page.component {...page} />
{/if}
{#if page.components}
  {#each page.components as component}
    <component.component {...component} />
  {/each}
{/if}
