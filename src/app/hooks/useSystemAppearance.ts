import { useEffect, useState } from "react";

type Rgb = [number, number, number];

const toRgb = (hex: string): Rgb => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const toHex = (c: Rgb) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const luminance = ([r, g, b]: Rgb) => {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => v + (b[i] - v) * t) as Rgb;

/**
 * Move `base` toward `toward` until it reaches `ratio` against every colour in
 * `against`. Used to keep the user's accent legible on each theme's surfaces.
 */
function shade(base: Rgb, toward: Rgb, against: Rgb[], ratio: number): Rgb {
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const c = mix(base, toward, t);
    if (against.every((bg) => contrast(c, bg) >= ratio)) return c;
  }
  return toward;
}

/**
 * Adopt the user's Windows accent colour for `--system-blue`.
 *
 * Windows itself uses a darker accent shade in light mode and a lighter one in
 * dark mode. We do the same, verifying contrast so that accent-coloured text
 * meets 4.5:1 on the theme's surfaces and label text on accent fills does too.
 * In a browser the main process is absent and the stylesheet default stands.
 */
export function useSystemAccentColor(): void {
  useEffect(() => {
    if (!window.electron?.getAccentColor) return;
    let applied = true;

    window.electron
      .getAccentColor()
      .then((color) => {
        if (!applied || !color) return;
        const hex = (color.startsWith("#") ? color.slice(1) : color).slice(0, 6);
        if (!/^[0-9a-fA-F]{6}$/.test(hex)) return;
        const base = toRgb(hex);
        const white: Rgb = [255, 255, 255];
        const black: Rgb = [0, 0, 0];
        // Light surfaces: #ffffff, #fbfbfb card, #f3f3f3 window; white label text.
        const light = shade(base, black, [[243, 243, 243], [229, 241, 251], white], 5.2);
        // Dark surfaces: #202020 window, #2b2b2b card; black label text.
        const dark = shade(base, white, [[43, 43, 43], [55, 55, 55], [37, 59, 70]], 5.2);
        const darkWithLabel = contrast(dark, black) >= 4.5 ? dark : shade(dark, white, [black], 4.5);
        const root = document.documentElement.style;
        root.setProperty("--accent-fill-light", toHex(light));
        root.setProperty("--accent-fill-dark", toHex(darkWithLabel));
      })
      .catch(() => {
        // Keep the stylesheet default.
      });

    return () => {
      applied = false;
    };
  }, []);
}

/** Track whether the window is in full screen, to adjust top-bar insets. */
export function useFullScreen(): boolean {
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (!window.electron?.onFullScreenChange) return;
    return window.electron.onFullScreenChange(setIsFullScreen);
  }, []);

  return isFullScreen;
}
