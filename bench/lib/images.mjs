// Comparación visual: diferencia media absoluta entre dos recortes en escala de grises reducidos al mismo tamaño.
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";

export const readPng = (file) => PNG.sync.read(readFileSync(file));

/** Recorta (y rellena de blanco si el recorte se sale de la imagen). */
export function crop(png, x, y, w, h) {
  const out = new PNG({ width: w, height: h });
  out.data.fill(255);
  for (let yy = 0; yy < h; yy++) {
    const sy = y + yy;
    if (sy < 0 || sy >= png.height) continue;
    for (let xx = 0; xx < w; xx++) {
      const sx = x + xx;
      if (sx < 0 || sx >= png.width) continue;
      const si = (sy * png.width + sx) * 4, di = (yy * w + xx) * 4;
      out.data[di] = png.data[si]; out.data[di + 1] = png.data[si + 1]; out.data[di + 2] = png.data[si + 2]; out.data[di + 3] = 255;
    }
  }
  return out;
}

const gray = (png) => {
  const g = new Float32Array(png.width * png.height);
  for (let i = 0; i < g.length; i++) g[i] = (0.299 * png.data[i * 4] + 0.587 * png.data[i * 4 + 1] + 0.114 * png.data[i * 4 + 2]) / 255;
  return g;
};

const reduce = (g, w, h, f) => {
  const rw = Math.ceil(w / f), rh = Math.ceil(h / f);
  const out = new Float32Array(rw * rh);
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    let sum = 0, n = 0;
    for (let yy = y * f; yy < Math.min(h, (y + 1) * f); yy++) for (let xx = x * f; xx < Math.min(w, (x + 1) * f); xx++) { sum += g[yy * w + xx]; n++; }
    out[y * rw + x] = sum / n;
  }
  return out;
};

/** Diferencia media (0 a 100) entre dos recortes del mismo tamaño, tras reducirlos 4 veces. 0 = idénticos. */
export function visualDifference(a, b, factor = 4) {
  if (a.width !== b.width || a.height !== b.height) throw new Error("Los recortes deben tener el mismo tamaño");
  const ga = reduce(gray(a), a.width, a.height, factor), gb = reduce(gray(b), b.width, b.height, factor);
  let sum = 0;
  for (let i = 0; i < ga.length; i++) sum += Math.abs(ga[i] - gb[i]);
  return +((sum / ga.length) * 100).toFixed(2);
}
