<script lang="ts">
    import type { Snippet } from "svelte";
    import { usePart, type PrimitiveHandle } from "@ui-sdk/svelte/primitive";
    import { stepList } from "../../lib/primitives.ts";

    let { handle, value, children }: { handle: PrimitiveHandle<typeof stepList>; value: string; children: Snippet } = $props();
    const part = usePart(handle, "item", () => ({ value }));
</script>

<!-- --drag-y is set on the <li> around it while a pointer drags it -->
<div
    {...part.slot({
        "aria-describedby": "steps-help",
        class: "relative grid gap-2 bg-tile p-3 data-[grabbed]:z-10 data-[grabbed]:outline data-[grabbed]:outline-1 data-[grabbed]:outline-neutral-400 data-[grabbed]:[transform:translateY(var(--drag-y,0px))]",
    })}
>
    {@render children()}
</div>
