// Stand-in data shaped like the PBO2 undervolt temperature chart on akif.kr.
const temp = (s: number, load: number, drift: number) => {
    const ramp = 1 - Math.exp(-s / 4);
    return 45 + (load - 45) * ramp + drift * (s / 600) + (Math.sin(s * 0.11) + Math.sin(s * 0.37)) * 0.4 * ramp;
};

export const sampleCsv = [
    "Time (s),Before PBO2,After PBO2",
    ...Array.from({ length: 121 }, (_, i) => `${i * 5},${temp(i * 5, 84, 6).toFixed(1)},${temp(i * 5, 76, 3).toFixed(1)}`),
].join("\n");
