<!-- How the chart is drawn around the data: colours, font, grid lines, size and padding -->
<script lang="ts">
    import Colours from "./Colours.svelte";
    import Select from "./Select.svelte";
    import { FONTS, type Config, type Font } from "../lib/render.ts";

    let { config: c = $bindable() }: { config: Config } = $props();
    // Common sizes. Picking one scales text, lines, points and padding with the height, so the chart looks the same, just bigger.
    const sizes: [string, number, number][] = [
        ["Blog, 1200 × 600", 1200, 600],
        ["720p, 1280 × 720", 1280, 720],
        ["1080p, 1920 × 1080", 1920, 1080],
        ["1440p / 2K, 2560 × 1440", 2560, 1440],
        ["4K, 3840 × 2160", 3840, 2160],
        ["Square, 1080 × 1080", 1080, 1080],
        ["Portrait, 1080 × 1350", 1080, 1350],
        ["Story, 1080 × 1920", 1080, 1920],
    ];
    const size = $derived(sizes.find(([, w, h]) => w === c.width && h === c.height)?.[0] ?? "");
    function resize(name: string) {
        const [, w, h] = sizes.find(([n]) => n === name)!;
        const k = Math.min(w, h) / Math.min(c.width, c.height);
        Object.assign(c, {
            width: w,
            height: h,
            fontSize: Math.max(8, Math.round(c.fontSize * k)),
            lineWidth: Math.max(1, Math.round(c.lineWidth * k * 2) / 2),
            pointSize: Math.max(1, Math.round(c.pointSize * k * 2) / 2),
            padding: Math.round((c.padding ?? 0) * k),
        });
    }
</script>

<Colours bind:config={c} />

<div class="grid grid-cols-[1fr_6rem] gap-3">
    <div>
        <label class="label" for="font">Font</label>
        <Select id="font" bind:value={c.font} options={Object.entries(FONTS).map(([value, f]) => ({ value: value as Font, label: f.name, style: `font-family: ${f.css}` }))} />
    </div>
    <div><label class="label" for="fs">Text size</label><input id="fs" type="number" min="8" class="field" bind:value={c.fontSize} /></div>
</div>

{#if c.type !== "pie"}<label class="flex items-center gap-2.5 font-mono text-xs text-neutral-200"><input type="checkbox" class="check" bind:checked={c.grid} />Grid lines</label>{/if}

<fieldset class="grid grid-cols-3 gap-3">
    <legend class="section-title">Size</legend>
    <div class="col-span-3">
        <Select id="size" label="Size preset" options={[...sizes.map(([n]) => ({ value: n, label: n })), ...(size ? [] : [{ value: "", label: `Custom, ${c.width} × ${c.height}` }])]} bind:value={() => size, (v) => v && resize(v)} />
        <p class="mt-1.5 font-mono text-[11px] text-neutral-500">Picking a size scales the text and lines with it.</p>
    </div>
    <div><label class="label" for="w">Width</label><input id="w" type="number" min="200" step="10" class="field" bind:value={c.width} /></div>
    <div><label class="label" for="h">Height</label><input id="h" type="number" min="100" step="10" class="field" bind:value={c.height} /></div>
    <div><label class="label" for="pad">Padding</label><input id="pad" type="number" min="0" step="4" class="field" bind:value={() => c.padding ?? 0, (v) => (c.padding = Math.max(0, v ?? 0))} /></div>
</fieldset>
