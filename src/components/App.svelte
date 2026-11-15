<script lang="ts">
    import { parse } from "../lib/data.ts";
    import { render } from "../lib/render.ts";
    import { sampleCsv } from "../lib/sample.ts";
    import { fresh, list, load, put, remove, type Doc } from "../lib/store.ts";
    import { total } from "../lib/timeline.ts";
    import Animate from "./Animate.svelte";
    import Chart from "./Chart.svelte";
    import Charts from "./Charts.svelte";
    import Colours from "./Colours.svelte";
    import Data from "./Data.svelte";
    import Export from "./Export.svelte";

    const tabs = ["Data", "Chart", "Colours", "Animate", "Export", "Charts"] as const;
    let tab = $state<(typeof tabs)[number]>("Data");

    // Every visit starts on a blank chart; saved ones open from Charts
    let docs = $state(list());
    let doc = $state<Doc>(fresh());
    let status = $state("");

    const table = $derived(parse(doc.csv));
    const ready = $derived(table.rows.length > 0 && doc.config.ys.length > 0);
    const end = $derived(total(doc.config.anim));
    let t = $state(Infinity);
    let playing = $state(false);
    const now = $derived(Math.min(t, end));
    const svg = $derived(ready ? render(table, doc.config, now) : "");

    let sw = $state(0);
    let sh = $state(0);
    const fit = $derived(Math.min(sw / doc.config.width, sh / doc.config.height) || 0);

    function save() {
        if (!doc.csv.trim()) return (status = "");
        try {
            put($state.snapshot(doc));
            docs = list();
            status = "Saved";
        } catch {
            status = "Not saved, storage full";
        }
    }

    // Save a moment after the last change, and again on the way out
    $effect(() => {
        JSON.stringify(doc);
        const timer = setTimeout(save, 400);
        return () => clearTimeout(timer);
    });

    function play() {
        if (now >= end) t = 0;
        playing = true;
        let last = performance.now();
        const tick = (ms: number) => {
            if (!playing) return;
            t = Math.min(end, now + ms - last);
            last = ms;
            if (t < end) requestAnimationFrame(tick);
            else playing = false;
        };
        requestAnimationFrame(tick);
    }

    function open(d: Doc) {
        save();
        playing = false;
        t = Infinity;
        doc = d;
        tab = "Data";
    }

    function del(id: string) {
        remove(id);
        docs = list();
        if (doc.id === id) open(fresh());
    }

    function sample() {
        load(doc, sampleCsv);
        Object.assign(doc.config, { yLabel: "CPU temperature (°C)", unit: "°C" });
        if (doc.name === "Untitled chart") doc.name = "PBO2 undervolt";
    }
</script>

<svelte:window onpagehide={save} />
<svelte:document onvisibilitychange={() => document.visibilityState === "hidden" && save()} />

<div class="flex h-dvh flex-col font-mono text-xs uppercase tracking-wide text-neutral-500">
    <header class="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-neutral-800 px-4 sm:px-6">
        <h1 class="text-white">Grapho</h1>
        <span>Graphs you can animate</span>
    </header>

    <main class="flex min-h-0 flex-1 flex-col overflow-y-auto font-sans text-base normal-case tracking-normal text-neutral-200 md:grid md:grid-cols-[400px_minmax(0,1fr)] md:overflow-hidden">
        <aside class="order-2 border-neutral-800 max-md:border-t md:order-none md:overflow-y-auto md:border-r">
            <div role="tablist" class="grid grid-cols-3 border-b border-neutral-800">
                {#each tabs as name, i}
                    <button
                        role="tab"
                        aria-selected={tab === name}
                        onclick={() => (tab = name)}
                        class="h-10 border-neutral-800 font-mono text-[11px] uppercase tracking-wide outline-none focus-visible:bg-invert focus-visible:text-black can-hover:hover:bg-invert can-hover:hover:text-black {i % 3 ? 'border-l' : ''} {i < 3 ? 'border-b' : ''} {tab === name ? 'bg-tile text-white' : 'text-neutral-500'}"
                    >
                        {name}
                    </button>
                {/each}
            </div>
            <div role="tabpanel" class="grid gap-6 p-4 sm:p-6">
                {#if tab === "Data"}
                    <Data bind:doc {table} />
                {:else if tab === "Chart"}
                    <Chart bind:config={doc.config} />
                {:else if tab === "Colours"}
                    <Colours bind:config={doc.config} />
                {:else if tab === "Animate"}
                    <Animate bind:config={doc.config} />
                {:else if tab === "Export"}
                    <Export bind:doc {table} />
                {:else}
                    <Charts {docs} current={doc.id} onopen={open} ondelete={del} onnew={() => open(fresh())} />
                {/if}
            </div>
        </aside>

        <section class="flex min-w-0 flex-col md:min-h-0">
            <div class="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-neutral-800 px-4 sm:px-6">
                <input bind:value={doc.name} aria-label="Chart name" class="min-w-0 flex-1 bg-transparent font-medium text-white outline-none focus-visible:underline focus-visible:decoration-neutral-600 focus-visible:underline-offset-4" />
                <span class="shrink-0 font-mono text-xs uppercase tracking-wide text-neutral-500">
                    {doc.config.type} / {doc.config.ys.length} series{status ? " / " : ""}<span aria-live="polite">{status}</span>
                </span>
            </div>

            <div class="min-h-0 p-4 sm:p-8 md:flex-1">
                <div class="grid h-full place-items-center max-md:[aspect-ratio:var(--ar)]" style:--ar="{doc.config.width} / {doc.config.height}" bind:clientWidth={sw} bind:clientHeight={sh}>
                    {#if ready}
                        <div
                            role="img"
                            aria-label="{doc.config.type} chart preview"
                            style:width="{doc.config.width * fit}px"
                            style:height="{doc.config.height * fit}px"
                            class="[background:repeating-conic-gradient(rgb(var(--tile-2))_0_25%,rgb(var(--tile-3))_0_50%)_0_0/16px_16px] [&>svg]:size-full"
                        >
                            {@html svg}
                        </div>
                    {:else}
                        <div class="grid max-w-sm justify-items-start gap-4 border border-dashed border-neutral-700 p-6 font-mono text-xs text-neutral-400">
                            <p>{table.rows.length ? "Tick at least one value to show in Data." : "No data yet. Import a CSV or TSV, or paste one in Data. Saved charts are in Charts."}</p>
                            {#if !table.rows.length}<button class="btn" onclick={sample}>Try sample data →</button>{/if}
                        </div>
                    {/if}
                </div>
            </div>

            <div class="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-4 border-t border-neutral-800 px-4 py-3 font-mono text-xs uppercase sm:px-6">
                <button class="btn" disabled={!ready} onclick={() => (playing ? (playing = false) : play())}>{playing ? "Pause" : "Play"}</button>
                <input
                    type="range"
                    min="0"
                    max={end}
                    step="1"
                    value={now}
                    disabled={!ready}
                    oninput={(e) => ((playing = false), (t = +e.currentTarget.value))}
                    aria-label="Timeline"
                    class="w-full accent-neutral-200"
                />
                <span class="tabular-nums text-neutral-500">{(now / 1000).toFixed(1)} / {(end / 1000).toFixed(1)}s</span>
            </div>
        </section>
    </main>
</div>
