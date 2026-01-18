import {
  Order,
  OrderBook,
  Ticker,
  Trade,
  Balance,
  KrakenRawTickerData,
  KrakenRawOrderBookData,
  KrakenRawTradeData,
  KrakenRawOrderData,
} from '../../types';
import { KrakenUtils } from './kraken-utils';

export class KrakenDataMapper {
  mapBalance(balances: Record<string, string>): Record<string, Balance> {
    const result: Record<string, Balance> = {};
    for (const [krakenAsset, amount] of Object.entries(balances)) {
      const total = parseFloat(amount);
      const standardAsset = KrakenUtils.fromKrakenAsset(krakenAsset);
      result[standardAsset] = {
        asset: standardAsset,
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

  mapWebSocketTicker(data: KrakenRawTickerData): Ticker {
    return {
      symbol: '',
      bid: parseFloat(data.bid || '0'),
      ask: parseFloat(data.ask || '0'),
      last: parseFloat(data.last || '0'),
      baseVolume: parseFloat(data.volume || '0'),
      quoteVolume: parseFloat(data.volume_quote || '0'),
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
    };
  }

  mapWebSocketOrderBook(data: KrakenRawOrderBookData): OrderBook {
    const asks = (data.asks || []).map((ask: any) => ({
      price: parseFloat(ask.price || ask[0]),
      amount: parseFloat(ask.qty || ask[1]),
    }));

    const bids = (data.bids || []).map((bid: any) => ({
      price: parseFloat(bid.price || bid[0]),
      amount: parseFloat(bid.qty || bid[1]),
    }));

    return {
      symbol: '',
      bids,
      asks,
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
    };
  }

  mapWebSocketTrade(data: KrakenRawTradeData): Trade {
    return {
      id: data.trade_id || data.ord_id || Date.now().toString(),
      symbol: '',
      price: parseFloat(data.price),
      amount: parseFloat(data.qty || data.volume || '0'),
      side: data.side === 'buy' ? 'buy' : 'sell',
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
    };
  }

  mapWebSocketOrder(data: KrakenRawOrderData): Order {
    const rawStatus = data.order_status || data.ord_status || data.status || 'open';
    const status = KrakenUtils.mapOrderStatus(rawStatus);

    const symbol = data.symbol ? KrakenUtils.fromKrakenSymbol(data.symbol) : '';

    const cumQty =
      typeof data.cum_qty === 'number' ? data.cum_qty : parseFloat(data.cum_qty || '0');
    const filled =
      cumQty || parseFloat(data.cum_exec_qty || data.exec_qty || data.filled_qty || '0');

    let amount = parseFloat(data.order_qty || data.qty || '0');
    if (amount === 0 && filled > 0) {
      amount = filled;
    }

    const remaining = amount > 0 ? Math.max(0, amount - filled) : 0;

    let finalStatus = status;

    if (data.order_status === 'filled' || data.exec_type === 'filled') {
      finalStatus = 'filled';
    } else if (
      data.order_status === 'partially_filled' ||
      (data.exec_type === 'trade' && filled > 0 && filled < amount)
    ) {
      finalStatus = 'partially_filled';
    } else if (data.order_status === 'new' || data.exec_type === 'new') {
      finalStatus = 'open';
    } else if (data.order_status === 'canceled' || data.exec_type === 'canceled') {
      finalStatus = 'cancelled';
    }

    return {
      id: data.order_id || data.ord_id || data.orderId || Date.now().toString(),
      symbol,
      type: data.order_type === 'market' ? 'market' : 'limit',
      side: data.side === 'buy' ? 'buy' : 'sell',
      price: parseFloat(
        data.avg_price ? String(data.avg_price) : data.limit_price || data.price || '0'
      ),
      amount,
      filled,
      remaining,
      status: finalStatus,
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
    };
  }
}
