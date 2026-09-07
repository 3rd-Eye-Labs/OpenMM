# Minswap + SundaeSwap Cardano Price Fix Implementation Plan

> **For Hermes:** Use strict TDD to implement this plan task-by-task.

**Goal:** Replace the retired Iris dependency in `CardanoPriceService.getTokenPrice()` with resilient, keyless price aggregation from the live Minswap REST API and SundaeSwap GraphQL API.

**Architecture:** Introduce a small source-agnostic `CardanoDexPriceProvider` contract. A Minswap provider reads token/ADA price and ADA liquidity from its public asset-metrics endpoint. A SundaeSwap provider fetches all pools containing the token, keeps direct ADA pairs, calculates each pool’s token/ADA spot price from decimal-normalized reserves, and liquidity-weights the pools. `CardanoPriceService` calls both providers independently, discards failed providers when another succeeds, combines valid quotes by ADA liquidity, then uses the existing multi-CEX ADA/USD aggregation to produce TOKEN/USD.

**Tech Stack:** TypeScript, native `fetch`, Jest, existing OpenMM `AggregatedPrice` and `PriceData` types.

**Scope:** Fix `getTokenPrice()` only. The existing Iris-based `discover_pools` route remains a separately tracked migration because its response contract exposes individual pool details rather than an aggregate price.

---

### Task 1: Establish the provider contract and RED tests

**Objective:** Define the behavior expected from Minswap and SundaeSwap before writing production code.

**Files:**
- Create: `src/core/price-aggregation/cardano-dex-price-provider.ts`
- Create: `src/tests/unit/core/price-aggregation/minswap-price-provider.test.ts`
- Create: `src/tests/unit/core/price-aggregation/sundaeswap-price-provider.test.ts`

**Provider contract:**

```ts
export interface CardanoDexPriceQuote {
  provider: 'minswap' | 'sundaeswap';
  priceAda: number;
  liquidityAda: number;
  poolsUsed: number;
  timestamp: Date;
}

export interface CardanoDexPriceProvider {
  readonly id: CardanoDexPriceQuote['provider'];
  getTokenAdaQuote(token: CardanoTokenConfig): Promise<CardanoDexPriceQuote>;
}
```

**Minswap test cases:**
- Builds the asset ID as `policyId + assetName`.
- Calls `/v1/assets/{assetId}/metrics` without credentials.
- Parses positive `price` and `liquidity` values as ADA-denominated values.
- Rejects HTTP errors, malformed JSON shapes, zero/negative price, and zero/negative liquidity.

**SundaeSwap test cases:**
- Builds the GraphQL token ID as `policyId.assetName`.
- Calls `https://api.sundae.fi/graphql` and queries `pools.byAsset`.
- Keeps only direct `ada.lovelace`/token pools.
- Correctly handles ADA as either pool side.
- Normalizes reserves using each asset’s decimals, including zero-decimal tokens such as SNEK.
- Excludes malformed/empty pools.
- Liquidity-weights pool prices using `2 × ADA reserve`.
- Rejects HTTP errors, GraphQL errors, and absence of valid ADA pools.

**Step 1:** Write the tests importing providers that do not exist yet.

**Step 2:** Run:

```bash
npm test -- --runInBand \
  src/tests/unit/core/price-aggregation/minswap-price-provider.test.ts \
  src/tests/unit/core/price-aggregation/sundaeswap-price-provider.test.ts
```

**Expected:** FAIL because the provider modules are missing.

---

### Task 2: Implement Minswap provider (GREEN)

**Objective:** Return a validated token/ADA quote from Minswap’s public REST API.

**Files:**
- Create: `src/core/price-aggregation/minswap-price-provider.ts`
- Modify: `src/core/price-aggregation/index.ts`

**Implementation details:**
- Base URL: `https://api-mainnet-prod.minswap.org`.
- Endpoint: `/v1/assets/{policyId}{assetName}/metrics`.
- Use an `AbortController` timeout of 10 seconds.
- Parse `price` and `liquidity` as finite positive numbers.
- Return `provider: 'minswap'`, `poolsUsed: 1`, and `timestamp: new Date()`.
- Convert network/HTTP/schema failures into contextual `Minswap price API ...` errors without logging request payloads.

**Verification:** Run the Minswap provider test file; expected PASS.

---

### Task 3: Implement SundaeSwap provider (GREEN)

**Objective:** Produce a robust liquidity-weighted token/ADA quote from direct SundaeSwap pools.

**Files:**
- Create: `src/core/price-aggregation/sundaeswap-price-provider.ts`
- Modify: `src/core/price-aggregation/index.ts`

**Implementation details:**
- GraphQL endpoint: `https://api.sundae.fi/graphql`.
- Query `pools.byAsset(asset: $asset)` with pool ID, version, asset IDs/decimals, and current reserve quantities.
- Asset IDs are `ada.lovelace` and `{policyId}.{assetName}`.
- Convert raw reserve quantities to natural units using `10 ** decimals`.
- For each direct ADA pool:
  - `priceAda = normalizedAdaReserve / normalizedTokenReserve`.
  - `liquidityAda = 2 * normalizedAdaReserve`.
- Aggregate pool prices weighted by `liquidityAda`.
- Use a 10-second timeout and reject any GraphQL `errors` response.

**Verification:** Run the SundaeSwap provider test file; expected PASS.

---

### Task 4: Replace Iris in CardanoPriceService (RED → GREEN)

**Objective:** Aggregate Minswap and SundaeSwap quotes while tolerating one unavailable DEX.

**Files:**
- Modify: `src/core/price-aggregation/cardano-price-service.ts`
- Rewrite relevant assertions in: `src/tests/unit/core/price-aggregation/cardano-price-service.test.ts`

**Test cases:**
- Combines Minswap and SundaeSwap using ADA-liquidity weighting.
- Continues with Minswap when SundaeSwap fails.
- Continues with SundaeSwap when Minswap fails.
- Fails with a categorized message when both providers fail.
- Reports only successful DEX providers in `sources` plus the ADA/USD source.
- Preserves unsupported-token behavior and CEX fallback behavior.

**Implementation details:**
- Constructor accepts optional providers for testing; defaults to Minswap and SundaeSwap.
- Call providers concurrently with independently handled failures.
- Require at least one valid quote.
- Compute:

```text
tokenAda = Σ(priceAda × liquidityAda) / Σ(liquidityAda)
tokenUsd = tokenAda × adaUsd
```

- Derive confidence conservatively:
  - one provider: `0.70`;
  - two providers: start at `0.90`, reduce when relative spread is material.
- Replace hard-coded `iris-dex` result metadata with one source entry per successful provider.
- Do not alter existing ADA/USD CEX aggregation in this PR.

**Verification:** Run the CardanoPriceService unit tests; expected PASS.

---

### Task 5: Replace the misleading live integration test

**Objective:** Ensure CI exercises both live replacement providers rather than the retired Iris hostname.

**Files:**
- Modify: `src/tests/integration/price-aggregation/cardano-price-service.test.ts`

**Changes:**
- Update descriptions from Iris to Minswap/SundaeSwap.
- Keep live INDY and SNEK success assertions.
- Remove retry loops that obscure deterministic provider failures; providers already isolate individual upstream failures.
- Assert that at least one returned source is `minswap` or `sundaeswap`.

**Verification:**

```bash
npm test -- --runInBand src/tests/integration/price-aggregation/cardano-price-service.test.ts
```

Expected: PASS against live APIs.

---

### Task 6: Update documentation and remove get-price Iris claims

**Objective:** Make public documentation match the new implementation without claiming that pool discovery has already migrated.

**Files:**
- Modify: `docs/CLI.md`
- Modify: `docs/api/endpoints/cardano-price.md`
- Modify: `src/api/routes/cardano.ts`
- Modify: `src/config/price-aggregation.ts`

**Changes:**
- Describe Cardano pricing as aggregation across Minswap and SundaeSwap.
- Keep Iris documentation only where it still accurately describes the separate pool-discovery route.
- Replace `IRIS_CONFIG` usage for price fetching with provider-specific constants; do not remove compatibility exports used by the existing pool-discovery code.

**Verification:** Search for stale claims that `getTokenPrice()` uses Iris and inspect every remaining match.

---

### Task 7: Full verification and PR

**Objective:** Prove the change works locally and publish a reviewable PR.

**Commands:**

```bash
npm run typecheck
npm run lint
npm run format:check
npm test -- --runInBand
npm run build
```

**Live smoke test:** Call `new CardanoPriceService().getTokenPrice('INDY')` from the built package and verify:
- finite positive USD price;
- at least one Minswap/SundaeSwap source;
- no Iris network request or Iris source metadata.

**Git workflow:**

```bash
git checkout -b fix/cardano-price-dex-providers
git add <changed files>
git commit -m "fix(cardano): replace retired Iris price source"
git push -u origin HEAD
gh pr create --repo 3rd-Eye-Labs/OpenMM
```

**PR description must include:**
- root cause and live failing Iris integration test;
- provider/fallback behavior;
- exact local verification commands and results;
- note that Iris-based `discover_pools` migration remains separate;
- reference `QBT-Labs/openmm-mcp#17` without claiming it is closed until deployment consumes the released SDK.
