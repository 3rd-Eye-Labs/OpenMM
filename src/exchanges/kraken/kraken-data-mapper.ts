import {
  Order,
  OrderBook,
  Ticker,
  Trade,
  Balance
} from '../../types';
import { KrakenUtils } from './kraken-utils';

export class KrakenDataMapper {
  mapBalance(balances: Record<string, string>): Record<string, Balance> {
    const result: Record<string, Balance> = {};
    for (const [asset, amount] of Object.entries(balances)) {
      const total = parseFloat(amount);
      result[asset] = {
        asset,
        free: total,
        used: 0,
        total,
        available: total,
      };
    }
    return result;
  }

  mapTicker(data: Record<string, unknown>): Ticker {
    const ask = data.a as string[];
    const bid = data.b as string[];
    const last = data.c as string[];
    const volume = data.v as string[];

    return {
      symbol: '',
      bid: parseFloat(bid[0]),
      ask: parseFloat(ask[0]),
      last: parseFloat(last[0]),
      baseVolume: parseFloat(volume[1]),
      quoteVolume: parseFloat(volume[0]),
      timestamp: Date.now(),
    };
  }

  mapOrderBook(data: Record<string, unknown>): OrderBook {
    const asks = (data.asks as Array<[string, string, number]>).map(([price, volume]) => ({
      price: parseFloat(price),
      amount: parseFloat(volume),
    }));

    const bids = (data.bids as Array<[string, string, number]>).map(([price, volume]) => ({
      price: parseFloat(price),
      amount: parseFloat(volume),
    }));

    return {
      symbol: '',
      bids,
      asks,
      timestamp: Date.now(),
    };
  }

  mapTrade(trade: unknown): Trade {
    const tradeArray = trade as [string, string, number, string, string, string];
    const [price, volume, time, side] = tradeArray;
    return {
      id: time.toString(),
      symbol: '',
      price: parseFloat(price),
      amount: parseFloat(volume),
      side: side === 'b' ? 'buy' : 'sell',
      timestamp: KrakenUtils.parseTimestamp(time),
    };
  }

  mapTrades(trades: Array<[string, string, number, string, string, string]>): Trade[] {
    return trades.map(([price, volume, time, side]) => ({
      id: time.toString(),
      symbol: '',
      price: parseFloat(price),
      amount: parseFloat(volume),
      side: side === 'b' ? 'buy' : 'sell',
      timestamp: KrakenUtils.parseTimestamp(time),
    }));
  }

  mapOrder(order: Record<string, unknown>): Order {
    const descr = order.descr as Record<string, string>;
    const status = KrakenUtils.mapOrderStatus(order.status as string);
    const side = KrakenUtils.fromKrakenOrderSide(descr.type.startsWith('buy') ? 'buy' : 'sell');
    const type = KrakenUtils.fromKrakenOrderType(descr.ordertype);

    return {
      id: order.txid as string,
      symbol: descr.pair,
      type,
      side,
      price: parseFloat(descr.price || '0'),
      amount: parseFloat(order.vol as string),
      filled: parseFloat(order.vol_exec as string),
      remaining: parseFloat(order.vol as string) - parseFloat(order.vol_exec as string),
      status,
      timestamp: KrakenUtils.parseTimestamp(order.opentm as number),
    };
  }

  parseKrakenSymbol(krakenSymbol: string): string {
    return KrakenUtils.fromKrakenSymbol(krakenSymbol);
  }

  toKrakenSymbol(symbol: string): string {
    return KrakenUtils.toKrakenSymbol(symbol);
  }
}