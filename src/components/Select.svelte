<!--
    Custom select after the akif.kr theme picker: a popover tile panel, rows invert on hover/focus,
    a small filled square marks the current one. Popover gives Esc and outside-click closing for free.
-->
<script lang="ts" generics="T extends string | number">
    type Option = { value: T; label: string; style?: string };
    let { value = $bindable(), options, id, label }: { value: T; options: Option[]; id?: string; label?: string } = $props();

    const uid = $props.id();
    let trigger: HTMLButtonElement;
    let menu: HTMLDivElement;
    let open = $state(false);
    const current = $derived(options.find((o) => o.value === value));

    // The menu sits in the top layer, so it's placed against the viewport; scrolling anything else closes it
    const closeOnScroll = (e: Event) => e.target !== menu && menu.hidePopover();

    // Placed before it shows (beforetoggle), so it never flashes in the corner
    function place(e: Event) {
        if ((e as ToggleEvent).newState !== "open") return;
        const r = trigger.getBoundingClientRect();
        const below = innerHeight - r.bottom - 8;
        const above = r.top - 8;
        const up = below < 200 && above > below;
        Object.assign(menu.style, {
            left: `${r.left}px`,
            minWidth: `${r.width}px`,
            top: up ? "" : `${r.bottom + 2}px`,
            bottom: up ? `${innerHeight - r.top + 2}px` : "",
            maxHeight: `${Math.min(320, up ? above : below)}px`,
        });
    }

    function toggle(e: Event) {
        open = (e as ToggleEvent).newState === "open";
        if (!open) return removeEventListener("scroll", closeOnScroll, true);
        addEventListener("scroll", closeOnScroll, true);
        requestAnimationFrame(() => (menu.querySelector<HTMLElement>('[aria-pressed="true"]') ?? menu.querySelector("button"))?.focus());
    }

    function pick(v: T) {
        value = v;
        menu.hidePopover();
        trigger.focus();
    }

    function keys(e: KeyboardEvent) {
        const items = [...menu.querySelectorAll("button")];
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        const to = ({ ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 } as Record<string, number>)[e.key];
        if (to === undefined) return;
        e.preventDefault();
        items[(to + items.length) % items.length]?.focus();
    }

    $effect(() => {
        menu.addEventListener("beforetoggle", place);
        menu.addEventListener("toggle", toggle);
        return () => (menu.removeEventListener("beforetoggle", place), menu.removeEventListener("toggle", toggle), removeEventListener("scroll", closeOnScroll, true));
    });
</script>

<button
    bind:this={trigger}
    {id}
    type="button"
    popovertarget="{uid}-menu"
    aria-haspopup="true"
    aria-expanded={open}
    aria-label={label}
    class="field flex items-center justify-between gap-2 text-left"
    onkeydown={(e) => (e.key === "ArrowDown" || e.key === "ArrowUp") && (e.preventDefault(), menu.showPopover())}
>
    <span class="truncate" style={current?.style}>{current?.label ?? ""}</span>
    <span aria-hidden="true" class="text-[10px] text-neutral-500">▼</span>
</button>
<div bind:this={menu} id="{uid}-menu" popover class="fixed inset-auto m-0 overflow-y-auto border border-neutral-800 bg-tile p-0 font-mono text-xs text-neutral-400" onkeydown={keys} role="presentation">
    {#each options as o (o.value)}
        <button
            type="button"
            aria-pressed={o.value === value}
            style={o.style}
            onclick={() => pick(o.value)}
            class="group flex w-full items-center justify-between gap-6 px-3 py-2.5 text-left outline-none aria-pressed:text-white focus-visible:bg-invert focus-visible:text-black can-hover:hover:bg-invert can-hover:hover:text-black"
        >
            <span class="truncate">{o.label}</span>
            <span class="size-1.5 shrink-0 bg-current opacity-0 group-aria-pressed:opacity-100" aria-hidden="true"></span>
        </button>
    {/each}
</div>
