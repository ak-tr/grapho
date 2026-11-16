<script lang="ts">
    import { usePart, type PrimitiveHandle } from "@ui-sdk/svelte/primitive";
    import { stepList } from "../../lib/primitives.ts";

    let { handle, value, label }: { handle: PrimitiveHandle<typeof stepList>; value: string; label: string } = $props();
    const part = usePart(handle, "handle", () => ({ value }));
</script>

<button {...part.slot({ "aria-label": label, class: "btn cursor-grab touch-none select-none px-2 py-1 aria-pressed:btn-primary" })}>⠿</button>
