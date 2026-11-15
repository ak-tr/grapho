<script lang="ts">
    import { seriesColor, type Config } from "../lib/render.ts";

    import mosaic from "mosaic/tokens.json";

    let { config: c = $bindable() }: { config: Config } = $props();

    // Colour ways from the Mosaic themes: chart on a tile, mid-grey text, quiet axis and grid
    const presets = mosaic.themes.map((th) => ({
        name: th.name,
        colors: { background: th.colors.tile, text: th.colors["n-400"], axis: th.colors["n-600"], grid: th.colors["n-800"] },
    }));
    const isOn = (p: (typeof presets)[number]) => !c.colors.transparent && Object.entries(p.colors).every(([k, v]) => c.colors[k as keyof typeof p.colors] === v);
</script>

<fieldset>
    <legend class="label">Mosaic colour ways</legend>
    <div class="grid gap-[2px]">
        {#each presets as p}
            <button
                class="flex items-center gap-3 border p-2 text-left font-mono text-[11px] uppercase outline-none focus-visible:border-white can-hover:hover:border-neutral-400 {isOn(p) ? 'border-white text-white' : 'border-neutral-800 text-neutral-400'}"
                aria-pressed={isOn(p)}
                onclick={() => Object.assign(c.colors, p.colors, { transparent: false })}
            >
                <span class="flex h-6 w-16 shrink-0 items-end gap-[3px] p-1" style:background={p.colors.background} style:outline="1px solid {p.colors.grid}">
                    <span class="h-1/2 w-full" style:background={p.colors.text}></span>
                    <span class="h-full w-full" style:background={p.colors.axis}></span>
                    <span class="h-1/3 w-full" style:background={p.colors.grid}></span>
                </span>
                {p.name}
            </button>
        {/each}
    </div>
</fieldset>

<div class="grid grid-cols-2 gap-3">
    <div><label class="label" for="bg">Background</label><input id="bg" type="color" bind:value={c.colors.background} disabled={c.colors.transparent} /></div>
    <div><label class="label" for="text">Text</label><input id="text" type="color" bind:value={c.colors.text} /></div>
    <div><label class="label" for="axis">Axis</label><input id="axis" type="color" bind:value={c.colors.axis} /></div>
    <div><label class="label" for="grid">Grid</label><input id="grid" type="color" bind:value={c.colors.grid} /></div>
</div>
<label class="flex items-center gap-2.5 font-mono text-xs text-neutral-200">
    <input type="checkbox" class="check" bind:checked={c.colors.transparent} />Transparent background (SVG and PNG)
</label>

{#if c.type === "pie"}
    <p class="font-mono text-[11px] text-neutral-500">Pie slices use the series palette in order.</p>
{:else if c.ys.length}
    <fieldset class="grid grid-cols-2 gap-3">
        <legend class="label">Series</legend>
        {#each c.ys as y, i}
            <div>
                <label class="label normal-case" for="s{i}">{y}</label>
                <input id="s{i}" type="color" value={seriesColor(c, y, i)} oninput={(e) => (c.colors.series[y] = e.currentTarget.value)} />
            </div>
        {/each}
    </fieldset>
    <button class="btn justify-self-start" onclick={() => (c.colors.series = {})}>Reset series colours</button>
{/if}
