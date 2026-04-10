import type {
  EdgeMeasurements,
  FractionDenominator,
  MeasurementUnit,
  SizeInput,
} from "../types/framing";

export const UNIT_LABELS: Record<MeasurementUnit, string> = {
  in: "in",
  cm: "cm",
};

export const FRACTION_PRECISION_OPTIONS: FractionDenominator[] = [8, 16, 32];
export const MIN_PREVIEW_SNAP_INCREMENT_INCHES = 1 / 16;
export const MAX_PREVIEW_SNAP_INCREMENT_INCHES = 1;
export const DEFAULT_PREVIEW_SNAP_INCREMENT_INCHES = 1 / 2;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function parseMeasurement(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatMeasurement(
  value: string | number | null | undefined,
  unit: MeasurementUnit,
  precision: FractionDenominator = 16
) {
  const parsed = parseMeasurement(value);
  if (parsed === null) {
    return "Not set";
  }

  if (unit === "cm") {
    return `${Number(parsed.toFixed(1)).toString()} cm`;
  }

  const sign = parsed < 0 ? "-" : "";
  const absoluteValue = Math.abs(parsed);
  const whole = Math.floor(absoluteValue);
  let numerator = Math.round((absoluteValue - whole) * precision);
  let normalizedWhole = whole;

  if (numerator >= precision) {
    normalizedWhole += 1;
    numerator = 0;
  }

  if (numerator === 0) {
    return `${sign}${normalizedWhole} in`;
  }

  const divisor = gcd(numerator, precision);
  const fraction = `${numerator / divisor}/${precision / divisor}`;

  if (normalizedWhole === 0) {
    return `${sign}${fraction} in`;
  }

  return `${sign}${normalizedWhole} ${fraction} in`;
}

export function formatMeasurementValue(
  value: string | number | null | undefined,
  unit: MeasurementUnit,
  precision: FractionDenominator = 16
) {
  const label = formatMeasurement(value, unit, precision);
  return label.replace(` ${UNIT_LABELS[unit]}`, "");
}

export function formatSize(
  size: SizeInput,
  unit: MeasurementUnit,
  precision: FractionDenominator = 16
) {
  if (!size.width || !size.height) {
    return "Not set";
  }

  return `${formatMeasurementValue(size.width, unit, precision)} × ${formatMeasurementValue(size.height, unit, precision)} ${UNIT_LABELS[unit]}`;
}

export function formatEdges(
  edges: EdgeMeasurements,
  unit: MeasurementUnit,
  precision: FractionDenominator = 16
) {
  const entries = [
    ["Top", edges.top],
    ["Right", edges.right],
    ["Bottom", edges.bottom],
    ["Left", edges.left],
  ].filter((entry) => entry[1]);

  if (entries.length === 0) {
    return "Not set";
  }

  return entries
    .map(([label, value]) => `${label}: ${formatMeasurement(value, unit, precision)}`)
    .join("  •  ");
}

export function roundMeasurementString(value: number) {
  return Number(value.toFixed(4)).toString();
}

export function sanitizePreviewSnapIncrementInches(value: string | number | null | undefined) {
  const parsed = parseMeasurement(value);

  if (parsed === null) {
    return DEFAULT_PREVIEW_SNAP_INCREMENT_INCHES;
  }

  const clamped = Math.max(
    MIN_PREVIEW_SNAP_INCREMENT_INCHES,
    Math.min(MAX_PREVIEW_SNAP_INCREMENT_INCHES, parsed)
  );

  return Math.round(clamped * 16) / 16;
}

export function getSnapIncrement(
  unit: MeasurementUnit,
  previewSnapIncrementInches: number
) {
  const inchIncrement = sanitizePreviewSnapIncrementInches(previewSnapIncrementInches);

  if (unit === "cm") {
    return Number((inchIncrement * 2.54).toFixed(4));
  }

  return inchIncrement;
}

export function snapMeasurement(
  value: number,
  unit: MeasurementUnit,
  previewSnapIncrementInches: number
) {
  const increment = getSnapIncrement(unit, previewSnapIncrementInches);
  return Math.round(value / increment) * increment;
}
