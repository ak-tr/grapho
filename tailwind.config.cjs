/** @type {import('tailwindcss').Config} */
module.exports = {
    // Colours, fonts and prose styles come from Mosaic. See node_modules/mosaic/DESIGN.md.
    presets: [require("mosaic/tailwind-preset.cjs")],
    content: ["./src/**/*.{astro,svelte,ts}"],
    theme: {
        extend: {
            // Touch screens fire hover on tap and leave it stuck, so hover styles go behind this
            screens: { "can-hover": { raw: "(hover: hover)" } },
        },
    },
};
