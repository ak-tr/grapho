/** @type {import('tailwindcss').Config} */
module.exports = {
    // Colours, fonts and prose styles come from Mosaic. See node_modules/mosaic/DESIGN.md.
    presets: [require("mosaic/tailwind-preset.cjs")],
    content: ["./src/**/*.{astro,svelte,ts}"],
    plugins: [
        // Touch screens fire hover on tap and leave it stuck, so hover styles go behind this. A variant, not a
        // screen: a non-width screen turns off Tailwind's max-* variants (max-md: and the like).
        ({ addVariant }) => addVariant("can-hover", "@media (hover: hover)"),
    ],
};
