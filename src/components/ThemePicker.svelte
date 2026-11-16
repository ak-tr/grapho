<!--
    The website's theme, from Mosaic (tokens.css): Dakota Black is the default on :root, the others set
    data-theme on <html>. index.astro applies the saved one before first paint, so there's no flash.
    The chart keeps its own colours; this only changes the app around it.
-->
<script lang="ts">
    import Select from "./Select.svelte";
    import mosaic from "mosaic/tokens.json";

    const KEY = "grapho:theme";
    const themes = mosaic.themes.map((t) => ({ value: t.id, label: t.name }));
    let theme = $state(document.documentElement.dataset.theme ?? themes[0].value);

    $effect(() => {
        const root = document.documentElement;
        if (theme === themes[0].value) delete root.dataset.theme;
        else root.dataset.theme = theme;
        try {
            localStorage.setItem(KEY, theme);
        } catch {}
    });
</script>

<!-- On phones the trigger just says THEME, so the header fits -->
<Select bind:value={theme} options={themes} label="Website theme" prefix="Theme" compact class="btn py-1.5" />
