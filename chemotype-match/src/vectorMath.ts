import {
  BatchCOA,
  ChemotypeVector,
  DEFAULT_MATCH_SCORE_PARAMS,
  DIMENSION_KEYS,
  DimensionWeights,
  MatchResult,
  MatchScoreParams,
  RatedBatch,
} from "./types";

/** Builds a fully-populated ChemotypeVector from partial COA percentages, defaulting missing dimensions to 0. */
export function toVector(
  profile: Partial<Record<(typeof DIMENSION_KEYS)[number], number>>
): ChemotypeVector {
  const vector = {} as ChemotypeVector;
  for (const key of DIMENSION_KEYS) {
    vector[key] = profile[key] ?? 0;
  }
  return vector;
}

export function zeroVector(): ChemotypeVector {
  return toVector({});
}

export function dot(a: ChemotypeVector, b: ChemotypeVector): number {
  let sum = 0;
  for (const key of DIMENSION_KEYS) sum += a[key] * b[key];
  return sum;
}

export function magnitude(a: ChemotypeVector): number {
  return Math.sqrt(dot(a, a));
}

/**
 * Cosine similarity of terpene/cannabinoid ratio "shape". A zero vector
 * (e.g. an unrated cold-start user) has no direction, so it's defined as
 * 0 similarity to anything rather than producing NaN.
 */
export function cosineSimilarity(a: ChemotypeVector, b: ChemotypeVector): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dot(a, b) / (magA * magB);
}

export function weightedEuclideanDistance(
  a: ChemotypeVector,
  b: ChemotypeVector,
  weights: DimensionWeights
): number {
  let sum = 0;
  for (const key of DIMENSION_KEYS) {
    const diff = a[key] - b[key];
    sum += weights[key] * diff * diff;
  }
  return Math.sqrt(sum);
}

export function magnitudeSimilarity(distance: number, gamma: number): number {
  return Math.exp(-gamma * distance);
}

/**
 * Final combined match score (0-100) between a user's preference vector
 * and a candidate batch, blending shape (cosine) and potency (weighted
 * Euclidean) similarity per the spec's alpha/gamma hyperparameters.
 */
export function calculateMatchScore(
  user: ChemotypeVector,
  batch: BatchCOA,
  params: MatchScoreParams = DEFAULT_MATCH_SCORE_PARAMS
): MatchResult {
  const shapeSimilarity = cosineSimilarity(user, batch.vector);
  const magnitudeDistance = weightedEuclideanDistance(user, batch.vector, params.weights);
  const magSimilarity = magnitudeSimilarity(magnitudeDistance, params.gamma);
  const score =
    (params.alpha * shapeSimilarity + (1 - params.alpha) * magSimilarity) * 100;

  return {
    batchId: batch.id,
    shapeSimilarity,
    magnitudeDistance,
    magnitudeSimilarity: magSimilarity,
    score,
  };
}

/**
 * Exponential moving average update applied when a user likes/dislikes a
 * scanned batch: U_new = U_old + eta * (B_scanned - U_old). A negative
 * rating can be modeled by the caller pre-scaling eta (or negating it) —
 * this function only implements the vector step.
 */
export function updateUserVector(
  oldVector: ChemotypeVector,
  scannedVector: ChemotypeVector,
  eta: number = 0.15
): ChemotypeVector {
  const next = {} as ChemotypeVector;
  for (const key of DIMENSION_KEYS) {
    next[key] = oldVector[key] + eta * (scannedVector[key] - oldVector[key]);
  }
  return next;
}

/**
 * Cold-start initialization from an onboarding rating survey: a
 * rating-weighted average of the batch vectors the user rated,
 * U = sum(r_i * B_i) / sum(r_i).
 */
export function initColdStartVector(ratings: RatedBatch[]): ChemotypeVector {
  const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
  if (totalRating <= 0) return zeroVector();

  const next = zeroVector();
  for (const { vector, rating } of ratings) {
    for (const key of DIMENSION_KEYS) {
      next[key] += (rating * vector[key]) / totalRating;
    }
  }
  return next;
}
