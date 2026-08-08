# Chemotype Match — "Tinder for Cannabis Chemotypes"

Architecture scaffold for a swipe-based app that scans packaging (label OCR
or QR → COA lookup), maintains a per-user chemotype preference vector, and
ranks live dispensary menu batches by cosine/magnitude match score.

This is step 1 of the build: the vector math core and its data models,
independent of any storage or UI layer so it can be unit-tested and reused
from a mobile client, an API route, or a batch scoring job.

## Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Mobile UI | React Native (Expo) | One codebase for camera access, swipe gestures (`react-native-deck-swiper` / Reanimated), and background scan uploads. Expo's camera + on-device ML Kit text recognition gives fast offline OCR for the common case. |
| Web / kiosk | Next.js (App Router) | Reuses the same TypeScript vector math package; serves a dispensary-kiosk or desktop "browse matches" experience off the same API. |
| Scanner engine | On-device OCR (ML Kit / Vision) + QR/barcode (`expo-camera`) with cloud vision fallback | Labels are photographed in poor lighting; on-device OCR is fast and free, a cloud VLM (vision-capable Claude/GPT call) is the fallback for low-confidence reads. QR codes usually resolve straight to a lab's hosted COA (Confident Cannabis, SC Labs, Kaycha, TagLeaf) — those are scraped/parsed directly instead of OCR'd. |
| API | Next.js API routes or a small Fastify/tRPC service | Owns COA parsing → vectorization, scan ingestion, and match scoring endpoints. |
| Database | PostgreSQL + Prisma | Relational integrity across `Users` / `UserVector` / `Products` / `BatchCOA` / `UserScans`. Chemotype vectors are only 13 dimensions, so exact in-app scoring beats standing up a vector DB; `pgvector` can be added later purely as an index if a menu catalog grows into the tens of thousands of batches. |
| Auth | Clerk or Supabase Auth | Standard email/social auth, low lift. |
| Vector math | This package (`chemotype-match/src`) | Pure, dependency-free TypeScript so it runs identically on-device (Expo/Hermes), in an API route, and in a Node scoring job — no drift between "what the app shows" and "what the backend computed." |

## What's in this package

- `src/types.ts` — dimension keys, `ChemotypeVector`, `BatchCOA`, `UserVector`, `MatchResult`, and the default match/weight hyperparameters from the spec.
- `src/vectorMath.ts` — `cosineSimilarity`, `weightedEuclideanDistance`, `magnitudeSimilarity`, `calculateMatchScore`, `updateUserVector` (EMA preference update), and `initColdStartVector` (weighted-average cold start from an onboarding rating survey).
- `src/example.ts` — a runnable walkthrough: cold start → simulate a "like" → score a live menu batch.

## Next steps (not in this pass)

1. `prisma/schema.prisma` — `Users`, `UserVector`, `Products`, `BatchCOA`, `UserScans`.
2. OCR/QR parsing prompt strategy → normalized COA JSON → `toVector()`.
3. Swipe UI (React Native) wired to a `/api/matches` endpoint that calls `calculateMatchScore` per candidate batch.
