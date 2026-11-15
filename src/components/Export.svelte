<script lang="ts">
    import Select from "./Select.svelte";
    import type { Table } from "../lib/data.ts";
    import type { Doc } from "../lib/store.ts";
    import { GIF_FPS, MP4_FPS, total } from "../lib/timeline.ts";

    let { doc = $bindable(), table }: { doc: Doc; table: Table } = $props();
    let scale = $state(1);
    let busy = $state("");
    let progress = $state(0);
    let error = $state("");

    async function run(kind: "svg" | "png" | "mp4" | "gif") {
        busy = kind;
        error = "";
        progress = 0;
        try {
            const ex = await import("../lib/export.ts"); // the video encoder is big, load it on demand
            await ex[kind]({ table, config: $state.snapshot(doc.config), name: doc.name, scale, progress: (p) => (progress = p) });
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        } finally {
            busy = "";
        }
    }

    const frames = (fps: number) => Math.floor((total(doc.config.anim) / 1000) * fps) + 1;
    const size = $derived(`${Math.round(doc.config.width * scale)} × ${Math.round(doc.config.height * scale)}`);
</script>

<div>
    <label class="label" for="scale">Scale ({size} px)</label>
    <Select id="scale" bind:value={scale} options={[0.5, 1, 2].map((s) => ({ value: s, label: `${s}x` }))} />
</div>

<fieldset class="grid gap-2">
    <legend class="label">Still image</legend>
    <div class="grid grid-cols-2 gap-[2px]">
        <button class="btn" disabled={!!busy} onclick={() => run("svg")}>SVG ↓</button>
        <button class="btn" disabled={!!busy} onclick={() => run("png")}>PNG ↓</button>
    </div>
</fieldset>

<fieldset class="grid gap-2">
    <legend class="label">Animated ({(total(doc.config.anim) / 1000).toFixed(1)}s, set up in Animate)</legend>
    <div class="grid grid-cols-2 gap-3">
        <div>
            <label class="label" for="fps">MP4 frame rate</label>
            <Select id="fps" bind:value={doc.config.anim.fps} options={MP4_FPS.map((f) => ({ value: f, label: `${f} fps / ${frames(f)} frames` }))} />
        </div>
        <div>
            <label class="label" for="gif-fps">GIF frame rate</label>
            <Select id="gif-fps" bind:value={() => doc.config.anim.gifFps ?? 25, (v) => (doc.config.anim.gifFps = v)} options={GIF_FPS.map((f) => ({ value: f, label: `${f} fps / ${frames(f)} frames` }))} />
        </div>
    </div>
    <div class="grid grid-cols-2 gap-[2px]">
        <button class="btn btn-primary" disabled={!!busy} onclick={() => run("mp4")}>MP4 ↓</button>
        <button class="btn" disabled={!!busy} onclick={() => run("gif")}>GIF ↓</button>
    </div>
    <p class="font-mono text-[11px] text-neutral-500">GIF frame times are whole hundredths of a second, so it only offers rates that play at the right speed. GIFs get large fast, 0.5x keeps them small.</p>
</fieldset>

{#if busy}
    <div class="grid gap-2 font-mono text-[11px] uppercase text-neutral-400" aria-live="polite">
        <span>Exporting {busy} / {Math.round(progress * 100)}%</span>
        <div class="h-1 bg-neutral-900"><div class="h-full bg-invert" style:width="{progress * 100}%"></div></div>
    </div>
{/if}
{#if error}<p class="border border-dashed border-neutral-700 p-3 font-mono text-xs text-neutral-300" role="alert">{error}</p>{/if}
