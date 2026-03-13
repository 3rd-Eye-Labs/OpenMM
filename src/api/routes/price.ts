import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ExchangeFactory, SupportedExchange } from '../../cli/exchange-factory';

interface PriceCompareQuery {
  symbol: string;
  exchanges?: string;
}

interface ExchangePrice {
  exchange: string;
  bid: number;
  ask: number;
  last: number;
  spread: number;
  spreadPercent: number;
}

interface PriceCompareResponse {
  symbol: string;
  prices: ExchangePrice[];
  bestBid: { exchange: string; price: number };
  bestAsk: { exchange: string; price: number };
  arbitrageOpportunity: number;
  arbitragePercent: number;
  timestamp: number;
}

export async function priceRoutes(app: FastifyInstance): Promise<void> {
  // GET /price/compare - Cross-exchange price comparison (QBT-367)
  app.get<{ Querystring: PriceCompareQuery }>('/price/compare', {
    schema: {
      tags: ['Price'],
      summary: 'Cross-exchange price comparison',
      description: 'Compares prices across multiple exchanges and identifies arbitrage opportunities.',
      querystring: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: { type: 'string', description: 'Trading pair', example: 'BTC/USDT' },
          exchanges: { 
            type: 'string', 
            description: 'Comma-separated list of exchanges (default: all)',
            example: 'mexc,gateio,bitget',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            prices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  exchange: { type: 'string' },
                  bid: { type: 'number' },
                  ask: { type: 'number' },
                  last: { type: 'number' },
                  spread: { type: 'number' },
                  spreadPercent: { type: 'number' },
                },
              },
            },
            bestBid: {
              type: 'object',
              properties: {
                exchange: { type: 'string' },
                price: { type: 'number' },
              },
            },
            bestAsk: {
              type: 'object',
              properties: {
                exchange: { type: 'string' },
                price: { type: 'number' },
              },
            },
            arbitrageOpportunity: { type: 'number', description: 'Best bid - best ask (positive = arb exists)' },
            arbitragePercent: { type: 'number', description: 'Arbitrage as percentage' },
            timestamp: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: PriceCompareQuery }>, reply: FastifyReply): Promise<PriceCompareResponse> => {
    const { symbol, exchanges: exchangesParam } = request.query;
    
    const allExchanges: SupportedExchange[] = ['mexc', 'gateio', 'bitget', 'kraken'];
    const targetExchanges: SupportedExchange[] = exchangesParam 
      ? exchangesParam.split(',').filter(e => allExchanges.includes(e as SupportedExchange)) as SupportedExchange[]
      : allExchanges;

    const prices: ExchangePrice[] = [];
    
    // Fetch prices from all exchanges in parallel
    const results = await Promise.allSettled(
      targetExchanges.map(async (exchange) => {
        try {
          const connector = await ExchangeFactory.getExchange(exchange);
          const ticker = await connector.getTicker(symbol);
          const spread = ticker.ask - ticker.bid;
          const midPrice = (ticker.ask + ticker.bid) / 2;
          const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 0;
          
          return {
            exchange,
            bid: ticker.bid,
            ask: ticker.ask,
            last: ticker.last,
            spread,
            spreadPercent: Math.round(spreadPercent * 10000) / 10000,
          };
        } catch {
          return null;
        }
      })
    );

    // Collect successful results
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        prices.push(result.value);
      }
    }

    if (prices.length === 0) {
      return reply.status(500).send({ error: 'Failed to fetch prices from any exchange' });
    }

    // Find best bid and ask
    const bestBidPrice = prices.reduce((max, p) => p.bid > max.bid ? p : max, prices[0]);
    const bestAskPrice = prices.reduce((min, p) => p.ask < min.ask ? p : min, prices[0]);

    // Calculate arbitrage opportunity
    const arbitrageOpportunity = bestBidPrice.bid - bestAskPrice.ask;
    const arbitragePercent = bestAskPrice.ask > 0 
      ? (arbitrageOpportunity / bestAskPrice.ask) * 100 
      : 0;

    return {
      symbol,
      prices,
      bestBid: { exchange: bestBidPrice.exchange, price: bestBidPrice.bid },
      bestAsk: { exchange: bestAskPrice.exchange, price: bestAskPrice.ask },
      arbitrageOpportunity: Math.round(arbitrageOpportunity * 100000000) / 100000000,
      arbitragePercent: Math.round(arbitragePercent * 10000) / 10000,
      timestamp: Date.now(),
    };
  });
}
