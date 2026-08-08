import { BatchCOA } from "./types";
import { calculateMatchScore, initColdStartVector, toVector, updateUserVector } from "./vectorMath";

const blueDream: BatchCOA = {
  id: "batch-001",
  brand: "Sunrise Farms",
  strainName: "Blue Dream",
  batchId: "BD-2408-A",
  source: "qr",
  cannabinoids: { thc: 22.4, cbd: 0.1 },
  terpenes: { myrcene: 0.6, pinene: 0.3, caryophyllene: 0.2 },
  vector: toVector({ thc: 22.4, cbd: 0.1, myrcene: 0.6, pinene: 0.3, caryophyllene: 0.2 }),
};

const gsc: BatchCOA = {
  id: "batch-002",
  brand: "Coastal Cultivars",
  strainName: "Girl Scout Cookies",
  batchId: "GSC-2407-C",
  source: "ocr",
  cannabinoids: { thc: 24.1, cbd: 0.05 },
  terpenes: { caryophyllene: 0.7, limonene: 0.4, humulene: 0.2 },
  vector: toVector({ thc: 24.1, cbd: 0.05, caryophyllene: 0.7, limonene: 0.4, humulene: 0.2 }),
};

// Cold start: onboarding survey asked the user to rate two reference batches.
let userVector = initColdStartVector([
  { vector: blueDream.vector, rating: 0.9 },
  { vector: gsc.vector, rating: 0.4 },
]);
console.log("Cold-start vector:", userVector);

// User scans a new jar in the wild and swipes right on it.
const skywalkerOg = toVector({ thc: 26.8, cbd: 0.0, myrcene: 0.9, limonene: 0.2 });
userVector = updateUserVector(userVector, skywalkerOg, 0.15);
console.log("Vector after liking Skywalker OG:", userVector);

// Score today's dispensary menu against the updated preference vector.
for (const batch of [blueDream, gsc]) {
  const result = calculateMatchScore(userVector, batch);
  console.log(
    `${batch.strainName.padEnd(20)} -> ${result.score.toFixed(1)}% match ` +
      `(shape ${result.shapeSimilarity.toFixed(3)}, magnitude sim ${result.magnitudeSimilarity.toFixed(3)})`
  );
}
