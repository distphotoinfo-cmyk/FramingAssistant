function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, value));
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export function normalizeHex(input: string | null | undefined, fallback = "#000000") {
  if (!input) {
    return fallback.toUpperCase();
  }

  const trimmed = input.trim().replace(/^#/, "");
  const expanded =
    trimmed.length === 3
      ? trimmed
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : trimmed;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return fallback.toUpperCase();
  }

  return `#${expanded.toUpperCase()}`;
}

export function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex);
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function rgbToHsl(r: number, g: number, b: number): HslColor {
  const rUnit = clampChannel(r) / 255;
  const gUnit = clampChannel(g) / 255;
  const bUnit = clampChannel(b) / 255;

  const max = Math.max(rUnit, gUnit, bUnit);
  const min = Math.min(rUnit, gUnit, bUnit);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === rUnit) {
      hue = ((gUnit - bUnit) / delta) % 6;
    } else if (max === gUnit) {
      hue = (bUnit - rUnit) / delta + 2;
    } else {
      hue = (rUnit - gUnit) / delta + 4;
    }
  }

  const lightness = (max + min) / 2;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  return {
    h: ((hue * 60) + 360) % 360,
    s: clampUnit(saturation),
    l: clampUnit(lightness),
  };
}

export function hexToHsl(hex: string): HslColor {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

function hueToRgb(p: number, q: number, t: number) {
  let value = t;

  if (value < 0) {
    value += 1;
  }
  if (value > 1) {
    value -= 1;
  }
  if (value < 1 / 6) {
    return p + (q - p) * 6 * value;
  }
  if (value < 1 / 2) {
    return q;
  }
  if (value < 2 / 3) {
    return p + (q - p) * (2 / 3 - value) * 6;
  }
  return p;
}

export function hslToRgb(h: number, s: number, l: number) {
  const hue = ((h % 360) + 360) % 360 / 360;
  const saturation = clampUnit(s);
  const lightness = clampUnit(l);

  if (saturation === 0) {
    const gray = clampChannel(lightness * 255);
    return { r: gray, g: gray, b: gray };
  }

  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;

  return {
    r: clampChannel(hueToRgb(p, q, hue + 1 / 3) * 255),
    g: clampChannel(hueToRgb(p, q, hue) * 255),
    b: clampChannel(hueToRgb(p, q, hue - 1 / 3) * 255),
  };
}

export function hslToHex(h: number, s: number, l: number) {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

export function mixHexColors(baseHex: string, targetHex: string, amount: number) {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  const ratio = clampUnit(amount);

  return rgbToHex(
    base.r + (target.r - base.r) * ratio,
    base.g + (target.g - base.g) * ratio,
    base.b + (target.b - base.b) * ratio
  );
}

export function getSwatchBorderColor(hex: string, isDarkUi: boolean) {
  const { l } = hexToHsl(hex);

  if (l > 0.8) {
    return isDarkUi ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)";
  }

  return "transparent";
}
