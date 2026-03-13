import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CardanoPriceService } from '../../core/price-aggregation/cardano-price-service';

interface PriceParams {
  symbol: string;
}

export async function cardanoRoutes(app: FastifyInstance): Promise<void> {
  const priceService = new CardanoPriceService();

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
}
