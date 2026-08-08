export const CANNABINOID_KEYS = ["thc", "cbd", "cbg", "cbn", "thcv"] as const;

export const TERPENE_KEYS = [
  "myrcene",
  "caryophyllene",
  "limonene",
  "terpinolene",
  "linalool",
  "pinene",
  "humulene",
  "ocimene",
] as const;

export const DIMENSION_KEYS = [...CANNABINOID_KEYS, ...TERPENE_KEYS] as const;

export type CannabinoidKey = (typeof CANNABINOID_KEYS)[number];
export type TerpeneKey = (typeof TERPENE_KEYS)[number];
export type DimensionKey = (typeof DIMENSION_KEYS)[number];

/**
 * n-dimensional chemotype vector (cannabinoid + terpene percentages by
 * weight). Every dimension is required so downstream math never has to
 * null-check — use `toVector()` to build one from partial COA data.
 */
export type ChemotypeVector = Record<DimensionKey, number>;

/** Per-dimension weights w_j for the magnitude/potency distance term. */
export type DimensionWeights = Record<DimensionKey, number>;

export const DEFAULT_DIMENSION_WEIGHTS: DimensionWeights = {
  thc: 1.0,
  cbd: 1.0,
  cbg: 0.6,
  cbn: 0.6,
  thcv: 0.6,
  myrcene: 0.3,
  caryophyllene: 0.3,
  limonene: 0.3,
  terpinolene: 0.3,
  linalool: 0.3,
  pinene: 0.3,
  humulene: 0.3,
  ocimene: 0.3,
};

export interface MatchScoreParams {
  /** Blend between shape (cosine) and magnitude (potency) similarity. */
  alpha: number;
  /** Decay rate applied to the weighted Euclidean distance. */
  gamma: number;
  /** Per-dimension weights for the magnitude distance term. */
  weights: DimensionWeights;
}

export const DEFAULT_MATCH_SCORE_PARAMS: MatchScoreParams = {
  alpha: 0.7,
  gamma: 0.1,
  weights: DEFAULT_DIMENSION_WEIGHTS,
};

export type ScanSource = "ocr" | "qr" | "manual";

/** A single scanned/looked-up batch Certificate of Analysis. */
export interface BatchCOA {
  id: string;
  brand: string;
  strainName: string;
  batchId: string;
  labName?: string;
  testedAt?: string;
  source: ScanSource;
  /** Raw cannabinoid/terpene percentages as read off the COA. */
  cannabinoids: Partial<Record<CannabinoidKey, number>>;
  terpenes: Partial<Record<TerpeneKey, number>>;
  /** Derived from `cannabinoids`/`terpenes` via `toVector()`. */
  vector: ChemotypeVector;
}

/** A user's rating of a scanned batch, r_i in [0, 1]. */
export interface RatedBatch {
  vector: ChemotypeVector;
  rating: number;
}

export interface UserVector {
  userId: string;
  vector: ChemotypeVector;
  /** Number of scans folded into this vector so far. */
  sampleCount: number;
  updatedAt: string;
}

export interface MatchResult {
  batchId: string;
  shapeSimilarity: number;
  magnitudeDistance: number;
  magnitudeSimilarity: number;
  /** Final blended score, 0-100. */
  score: number;
}
