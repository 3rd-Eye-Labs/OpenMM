# Minswap + SundaeSwap Pool Discovery Implementation Plan

**Goal:** Replace Iris-backed `discover_pools` with resilient, keyless Minswap and SundaeSwap pool discovery in both the OpenMM SDK/API and the OpenMM MCP tool.

**Architecture:** Add source-specific pool providers that normalize each API into the existing `LiquidityPool` contract (`tokenA` = requested token, `tokenB` = ADA; reserves in natural units; TVL in ADA; price in ADA/token). Aggregate providers independently so one DEX can fail without breaking discovery. Keep the old Iris classes exported only for backwards compatibility, but remove them from active REST/CLI/MCP paths.

## SDK tasks

1. Add RED unit tests for `MinswapPoolProvider`, `SundaeSwapPoolProvider`, and `CardanoPoolDiscovery`.
2. Implement Minswap pool metrics POST (`/v1/pools/metrics`) and strict schema/filtering for direct ADA/token pools.
3. Implement SundaeSwap `pools.byAsset` GraphQL discovery and strict decimal-normalized reserve conversion.
4. Implement `CardanoPoolDiscovery` with independent fallback, combined sorting, deduplication, minimum-liquidity filtering, and categorized all-provider failure.
5. Update REST and CLI consumers to use `CardanoPoolDiscovery`; normalize accepted ADA base identifiers.
6. Remove active Iris price fetching from the CLI `getPoolPrices` path by reading each discovered pool's normalized `state.price` and using `CardanoPriceService` for USD.
7. Update API/CLI docs and tests; retain `IrisPoolDiscovery` and `IrisApiClient` only as deprecated compatibility exports.
8. Add live integration tests proving INDY discovery returns Minswap and SundaeSwap pools with finite positive reserves, TVL, and price.

## MCP tasks

1. Replace direct Iris calls in `src/tools/cardano.ts` with shared keyless Minswap/SundaeSwap fetch/normalization helpers.
2. Make both `get_cardano_price` and `discover_pools` use the same normalized provider results and independent fallback.
3. Preserve existing MCP response fields while reporting real DEX source names and categorized errors.
4. Add unit tests for both-provider success, one-provider fallback, malformed responses, zero-decimal SNEK reserves, and all-provider failure.
5. Update README/CLAUDE documentation.

## Verification

- SDK: focused tests, all tests except unrelated flaky MEXC live websocket, typecheck, build, live INDY pool smoke test.
- MCP: focused tool tests, full unit tests, typecheck, lint, format, build, local MCP tool calls for `get_cardano_price` and `discover_pools`.
- Push SDK updates to PR #38. Open a separate MCP PR because it is a different repository and release lifecycle.
