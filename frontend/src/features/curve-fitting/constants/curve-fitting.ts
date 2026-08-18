export const DISPLAY_POINT_LIMIT = 4_000;
export const MIN_EXPORT_POINT_COUNT = 20;
export const LCINT_POINT_COUNT = 1_001;
export const EXPORT_SIGNIFICANT_DIGITS = 6;
export const PROPORTIONAL_LIMIT_PLASTIC_STRAIN_THRESHOLD = 1e-4;
export const PROPORTIONAL_LIMIT_CONSECUTIVE_POINTS = 3;
export const CURVE_POINT_TOLERANCE = 1e-10;

export const CURVE_COLORS = {
  engineering: "#2563eb",
  trueTotal: "#dc2626",
  plastic: "#059669",
  reference: "#d97706",
  proportionalLimit: "#7c3aed",
  connection: "#be123c",
  ludwik: "#2563eb",
  swift: "#0f172a",
  voce: "#ea580c",
} as const;

export const HARDENING_MODEL_LABELS = {
  ludwik: "Ludwik",
  swift: "Swift",
  voce: "Voce",
} as const;

export const HARDENING_MODELS = ["ludwik", "swift", "voce"] as const;

export const EXPORT_BANDS = [
  { start: 0, end: 0.05, share: 0.5 },
  { start: 0.05, end: 0.2, share: 0.35 },
  { start: 0.2, end: Number.POSITIVE_INFINITY, share: 0.15 },
] as const;
