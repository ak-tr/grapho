import geistMono from "@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2?url";
import onest from "@fontsource/onest/files/onest-latin-400-normal.woff2?url";
import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { BufferTarget, CanvasSource, getFirstEncodableVideoCodec, Mp4OutputFormat, Output, QUALITY_HIGH } from "mediabunny";
import type { Table } from "./data.ts";
import { FONTS, render, type Config, type Font } from "./render.ts";
import { total } from "./timeline.ts";

export type Job = { table: Table; config: Config; name: string; scale: number; progress: (p: number) => void };

// Exported SVGs and rasterised frames can't see the page's fonts, so web fonts go inline. System fonts need nothing.
const files: Partial<Record<Font, string>> = { "geist-mono": geistMono, onest };
const cache = new Map<Font, Promise<string>>();
async function inline(font: Font) {
    const file = files[font];
    if (!file) return "";
    const blob = await (await fetch(file)).blob();
    const url = await new Promise<string>((done) => {
        const reader = new FileReader();
        reader.onload = () => done(reader.result as string);
        reader.readAsDataURL(blob);
    });
    return `@font-face{font-family:"${FONTS[font].name}";src:url(${url}) format("woff2")}`;
}
function fontCss(c: Config) {
    const font = c.font in FONTS ? c.font : "geist-mono";
    if (!cache.has(font)) cache.set(font, inline(font));
    return cache.get(font)!;
}

const slug = (s: string) => s.trim().toLowerCase().replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "chart";

function save(blob: Blob, name: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function canvas(c: Config, scale: number, even = false) {
    const size = (v: number) => (even ? Math.round((v * scale) / 2) * 2 : Math.round(v * scale));
    const el = document.createElement("canvas");
    el.width = size(c.width);
    el.height = size(c.height);
    return { el, ctx: el.getContext("2d", { willReadFrequently: true })! };
}

async function draw(svg: string, { el, ctx }: ReturnType<typeof canvas>) {
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
        await img.decode();
        ctx.clearRect(0, 0, el.width, el.height);
        ctx.drawImage(img, 0, 0, el.width, el.height);
    } finally {
        URL.revokeObjectURL(img.src);
    }
}

/** Draws every frame of the animation onto `cv`, calling `each` after each one. */
async function frames(job: Job, fps: number, cv: ReturnType<typeof canvas>, each: (i: number) => Promise<void> | void) {
    const css = await fontCss(job.config);
    const opaque = { ...job.config, colors: { ...job.config.colors, transparent: false } };
    const n = Math.floor((total(opaque.anim) / 1000) * fps) + 1;
    for (let i = 0; i < n; i++) {
        await draw(render(job.table, opaque, (i * 1000) / fps, css), cv);
        await each(i);
        job.progress((i + 1) / n);
    }
}

export async function svg(job: Job) {
    const out = render(job.table, job.config, total(job.config.anim), await fontCss(job.config));
    save(new Blob([out], { type: "image/svg+xml" }), `${slug(job.name)}.svg`);
}

export async function png(job: Job) {
    const cv = canvas(job.config, job.scale);
    await draw(render(job.table, job.config, total(job.config.anim), await fontCss(job.config)), cv);
    save(await new Promise<Blob>((done) => cv.el.toBlob((b) => done(b!), "image/png")), `${slug(job.name)}.png`);
}

export async function mp4(job: Job) {
    const fps = job.config.anim.fps;
    const cv = canvas(job.config, job.scale, true); // H.264 needs even dimensions
    const codec = await getFirstEncodableVideoCodec(["avc", "hevc", "vp9", "av1"], { width: cv.el.width, height: cv.el.height });
    if (!codec) throw new Error("This browser can't encode video. Try a recent Chrome, Edge, Safari or Firefox.");
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const source = new CanvasSource(cv.el, { codec, bitrate: QUALITY_HIGH });
    output.addVideoTrack(source, { frameRate: fps });
    await output.start();
    await frames(job, fps, cv, (i) => source.add(i / fps, 1 / fps));
    await output.finalize();
    save(new Blob([output.target.buffer!], { type: "video/mp4" }), `${slug(job.name)}.mp4`);
}

export async function gif(job: Job) {
    // GIF delays are whole 1/100 s, so only rates that divide 100 play at the right speed (GIF_FPS in timeline.ts)
    const fps = job.config.anim.gifFps ?? 25;
    const cv = canvas(job.config, job.scale);
    const { width: w, height: h } = cv.el;
    // One palette from the finished chart, so colours don't flicker between frames
    await draw(render(job.table, { ...job.config, colors: { ...job.config.colors, transparent: false } }, total(job.config.anim), await fontCss(job.config)), cv);
    const palette = quantize(cv.ctx.getImageData(0, 0, w, h).data, 256);
    const enc = GIFEncoder();
    await frames(job, fps, cv, (i) => {
        const index = applyPalette(cv.ctx.getImageData(0, 0, w, h).data, palette);
        enc.writeFrame(index, w, h, i === 0 ? { palette, delay: 1000 / fps } : { delay: 1000 / fps });
    });
    enc.finish();
    save(new Blob([enc.bytes()], { type: "image/gif" }), `${slug(job.name)}.gif`);
}
