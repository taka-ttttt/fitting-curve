export const DISPLAY_POINT_LIMIT = 4_000;
export const MIN_EXPORT_POINT_COUNT = 20;
export const LCINT_POINT_COUNT = 1_001;
export const EXPORT_SIGNIFICANT_DIGITS = 6;

export const EXPORT_BANDS = [
  { start: 0, end: 0.05, share: 0.5 },
  { start: 0.05, end: 0.2, share: 0.35 },
  { start: 0.2, end: Number.POSITIVE_INFINITY, share: 0.15 },
] as const;
