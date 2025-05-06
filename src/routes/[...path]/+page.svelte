<script lang="ts">
  import type { PageProps } from './$types.d.ts';
  let { data }: PageProps = $props();
</script>

<data.component {...data} />
