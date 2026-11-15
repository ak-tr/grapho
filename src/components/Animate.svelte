<script lang="ts">
    import Select from "./Select.svelte";
    import { defaultSteps, type Config } from "../lib/render.ts";
    import type { Ease, Effect } from "../lib/timeline.ts";

    let { config: c = $bindable() }: { config: Config } = $props();
    const effects: Effect[] = ["draw", "fade", "grow"];
    const eases: Ease[] = ["linear", "in", "out", "in-out"];
    const targets = $derived(["axes", ...c.ys]);

    function move(i: number, by: number) {
        const s = [...c.anim.steps];
        [s[i], s[i + by]] = [s[i + by], s[i]];
        c.anim.steps = s;
    }
</script>

<ol class="grid gap-[2px]">
    {#each c.anim.steps as step, i}
        <li class="grid gap-2 bg-tile p-3">
            <div class="flex items-center justify-between font-mono text-[11px] uppercase text-neutral-500">
                <span>Step {String(i + 1).padStart(2, "0")}</span>
                <span class="flex gap-[2px]">
                    <button class="btn px-2 py-1" aria-label="Move step {i + 1} up" disabled={i === 0} onclick={() => move(i, -1)}>↑</button>
                    <button class="btn px-2 py-1" aria-label="Move step {i + 1} down" disabled={i === c.anim.steps.length - 1} onclick={() => move(i, 1)}>↓</button>
                    <button class="btn px-2 py-1" aria-label="Remove step {i + 1}" onclick={() => c.anim.steps.splice(i, 1)}>×</button>
                </span>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <Select label="What" bind:value={step.target} options={targets.map((tg) => ({ value: tg, label: tg === "axes" ? "Axes" : tg }))} />
                <Select label="How" bind:value={step.effect} options={effects.map((e) => ({ value: e, label: e === "draw" ? "Draw left to right" : e === "fade" ? "Fade in" : "Grow" }))} />
                <label class="flex items-center gap-2 font-mono text-[11px] uppercase text-neutral-500">
                    <input type="number" min="0" step="100" class="field" aria-label="Duration in ms" bind:value={step.ms} />ms
                </label>
                <Select label="Easing" bind:value={step.ease} options={eases.map((e) => ({ value: e, label: `Ease ${e}` }))} />
            </div>
            {#if i > 0}
                <label class="flex items-center gap-2.5 font-mono text-xs text-neutral-200">
                    <input type="checkbox" class="check" bind:checked={step.together} />Start with the previous step
                </label>
            {/if}
        </li>
    {:else}
        <li class="border border-dashed border-neutral-700 p-3 font-mono text-xs text-neutral-500">No steps, so the chart shows straight away.</li>
    {/each}
</ol>

<div class="flex flex-wrap gap-[2px]">
    <button class="btn" onclick={() => c.anim.steps.push({ target: c.ys[0] ?? "axes", effect: "fade", ms: 1000, ease: "out", together: false })}>Add step</button>
    <button class="btn" onclick={() => (c.anim.steps = defaultSteps(c))}>Reset to default</button>
</div>

<label class="flex items-center gap-2.5 font-mono text-xs text-neutral-200">
    <input type="checkbox" class="check" bind:checked={c.anim.rescale} />Rescale the Y axis as each series comes in
</label>

<div class="grid grid-cols-2 gap-3">
    <div><label class="label" for="hold">Hold at end (ms)</label><input id="hold" type="number" min="0" step="100" class="field" bind:value={c.anim.hold} /></div>
</div>
