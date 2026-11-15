<script lang="ts">
    import type { Doc } from "../lib/store.ts";

    let { docs, current, onopen, ondelete, onnew }: { docs: Doc[]; current: string; onopen: (d: Doc) => void; ondelete: (id: string) => void; onnew: () => void } = $props();
    const date = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
</script>

<button class="btn btn-primary" onclick={onnew}>New chart →</button>

<div>
    <p class="label">Saved in this browser / {String(docs.length).padStart(2, "0")}</p>
    <ul class="grid gap-[2px]">
        {#each docs as d (d.id)}
            <li class="grid grid-cols-[1fr_auto] gap-[2px]">
                <button
                    class="grid gap-1 p-3 text-left outline-none focus-visible:bg-invert focus-visible:text-black can-hover:hover:bg-invert can-hover:hover:text-black {d.id === current ? 'bg-tile-2' : 'bg-tile'}"
                    onclick={() => onopen(d)}
                >
                    <span class="font-mono text-[11px] uppercase opacity-55">{d.config.type} / {date(d.updated)}{d.id === current ? " / Open" : ""}</span>
                    <span class="truncate font-medium">{d.name}</span>
                </button>
                <button class="btn" aria-label="Delete {d.name}" onclick={() => confirm(`Delete "${d.name}"? This can't be undone.`) && ondelete(d.id)}>×</button>
            </li>
        {/each}
    </ul>
</div>
