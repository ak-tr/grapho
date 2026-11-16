<!-- The words on the chart: title, key and watermark -->
<script lang="ts">
    import type { Config } from "../lib/render.ts";

    let { config: c = $bindable() }: { config: Config } = $props();
</script>

<div><label class="label" for="title">Title (blank = none)</label><input id="title" class="field" bind:value={() => c.title ?? "", (v) => (c.title = v)} /></div>

<fieldset class="grid gap-2">
    <legend class="section-title">Key</legend>
    <label class="flex items-center gap-2.5 font-mono text-xs text-neutral-200"><input type="checkbox" class="check" bind:checked={c.legend} />Show the key</label>
    {#if c.legend}
        <label class="flex items-center gap-2.5 font-mono text-xs text-neutral-200"><input type="checkbox" class="check" bind:checked={() => !!c.legendStack, (v) => (c.legendStack = v)} />One per row</label>
        {#if c.legendAt}<button class="btn justify-self-start" onclick={() => (c.legendAt = null)}>Put the key back on top</button>{/if}
        <p class="font-mono text-[11px] text-neutral-500">Drag the key on the chart to move it.</p>
    {/if}
</fieldset>

<label class="flex items-center gap-2.5 font-mono text-xs text-neutral-200"><input type="checkbox" class="check" bind:checked={() => !!c.watermark, (v) => (c.watermark = v)} />Watermark (grapho.akif.kr)</label>
