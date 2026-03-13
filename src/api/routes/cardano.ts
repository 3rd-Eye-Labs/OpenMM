import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CardanoPriceService } from '../../core/price-aggregation/cardano-price-service';
import { IrisPoolDiscovery } from '../../core/price-aggregation/iris-pool-discovery';
import { getTokenConfig, isTokenSupported } from '../../config/price-aggregation';

interface PriceParams {
  symbol: string;
}

interface PoolsParams {
  symbol: string;
}

interface PoolsQuery {
  minLiquidity?: number;
  limit?: number;
}

export async function cardanoRoutes(app: FastifyInstance): Promise<void> {
  const priceService = new CardanoPriceService();
  const poolDiscovery = new IrisPoolDiscovery();

  // GET /cardano/price/:symbol - Get Cardano token price (QBT-365)
  app.get<{ Params: PriceParams }>('/cardano/price/:symbol', {
    schema: {
      tags: ['Cardano'],
      summary: 'Get Cardano DEX token price',
      description: 'Returns aggregated price for a Cardano token from DEX pools via Iris Protocol. Price is TOKEN/USDT calculated via ADA bridge.',
      params: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: { type: 'string', description: 'Token symbol (e.g., SNEK, INDY, MIN)', example: 'SNEK' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Trading pair' },
            price: { type: 'number', description: 'Price in USDT' },
            confidence: { type: 'number', description: 'Confidence score (0-1)' },
            sources: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  exchange: { type: 'string' },
                },
              },
            },
            timestamp: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: PriceParams }>, reply: FastifyReply) => {
    const { symbol } = request.params;
    
    try {
      const result = await priceService.getTokenPrice(symbol.toUpperCase());

      return {
        symbol: result.symbol,
        price: result.price,
        confidence: result.confidence,
        sources: result.sources.map(s => ({
          id: s.id,
          name: s.name,
          exchange: s.exchange,
        })),
        timestamp: result.timestamp.toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('Unsupported token')) {
        return reply.status(400).send({ error: message });
      }
      return reply.status(500).send({ error: `Failed to fetch price: ${message}` });
    }
  });

  // GET /cardano/pools/:symbol - Discover liquidity pools for a token (QBT-366)
  app.get<{ Params: PoolsParams; Querystring: PoolsQuery }>('/cardano/pools/:symbol', {
    schema: {
      tags: ['Cardano'],
      summary: 'Discover liquidity pools for a Cardano token',
      description: 'Returns a list of DEX liquidity pools for a token, sorted by TVL. Uses Iris Protocol for pool discovery.',
      params: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: { type: 'string', description: 'Token symbol (e.g., SNEK, INDY, MIN)', example: 'INDY' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          minLiquidity: { type: 'number', description: 'Minimum TVL filter (in ADA)', default: 0 },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 10, description: 'Max pools to return' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            pools: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  dex: { type: 'string', description: 'DEX name (e.g., Minswap, SundaeSwap)' },
                  identifier: { type: 'string', description: 'Pool identifier' },
                  tvl: { type: 'number', description: 'Total value locked (ADA)' },
                  price: { type: 'number', description: 'Token price in ADA' },
                  reserveA: { type: 'number', description: 'Reserve of token A' },
                  reserveB: { type: 'number', description: 'Reserve of token B' },
                  tokenA: { type: 'string', description: 'Token A symbol' },
                  tokenB: { type: 'string', description: 'Token B symbol' },
                },
              },
            },
            count: { type: 'number' },
            timestamp: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: PoolsParams; Querystring: PoolsQuery }>, reply: FastifyReply) => {
    const { symbol } = request.params;
    const { minLiquidity = 0, limit = 10 } = request.query;
    const upperSymbol = symbol.toUpperCase();

    // Check if token is supported
    if (!isTokenSupported(upperSymbol)) {
      return reply.status(400).send({ 
        error: `Unsupported token: ${symbol}. Supported: INDY, SNEK, NIGHT, MIN` 
      });
    }

    try {
      const tokenConfig = getTokenConfig(upperSymbol);
      
      // Override minLiquidity if provided in query
      const configWithOverride = {
        ...tokenConfig,
        minLiquidityThreshold: minLiquidity > 0 ? minLiquidity : tokenConfig.minLiquidityThreshold,
      };

      const pools = await poolDiscovery.discoverPools('ADA', configWithOverride);

      // Apply limit
      const limitedPools = pools.slice(0, limit);

      // Format response
      const formattedPools = limitedPools.map(pool => ({
        dex: pool.dex,
        identifier: pool.identifier,
        tvl: pool.state?.tvl ?? 0,
        price: pool.state?.price ?? 0,
        reserveA: pool.state?.reserveA ?? 0,
        reserveB: pool.state?.reserveB ?? 0,
        tokenA: pool.pair?.tokenA?.ticker ?? pool.pair?.tokenA?.name ?? 'ADA',
        tokenB: pool.pair?.tokenB?.ticker ?? pool.pair?.tokenB?.name ?? upperSymbol,
      }));

      return {
        symbol: upperSymbol,
        pools: formattedPools,
        count: formattedPools.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send({ error: `Failed to discover pools: ${message}` });
    }
  });
}
