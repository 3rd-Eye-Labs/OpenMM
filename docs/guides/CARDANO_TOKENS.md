# Cardano Token Setup for Market Making

Quick guide to add and test Cardano tokens before market making.

## 🔍 Check Supported Tokens

```bash
openmm pool-discovery supported
```

## ➕ Add New Token

### 1. Get Token Info
Find these on [Cardanoscan.io](https://cardanoscan.io):
- **Policy ID** 
- **Asset Name** (hex)

### 2. Add to Configuration
Edit `src/config/price-aggregation.ts`:

```typescript
'YOUR_TOKEN': {
  symbol: 'YOUR_TOKEN',
  policyId: 'policy_id_here',
  assetName: 'hex_asset_name',
  minLiquidityThreshold: 50000
}
```

Or generate with CLI:
```bash
openmm pool-discovery custom <POLICY_ID> <ASSET_NAME_HEX> <SYMBOL>
```

## 🧪 Test Before Market Making

### 1. Find Pools
```bash
openmm pool-discovery discover YOUR_TOKEN --limit 3
```

✅ **Look for**: Active pools (✅), TVL > $25K, multiple DEXes

### 2. Test Pricing
```bash
openmm pool-discovery prices YOUR_TOKEN
```
---