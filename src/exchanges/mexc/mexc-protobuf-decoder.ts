import { 
  DecodedMexcOrder,
  DecodedMexcMessage 
} from '../../types';
import { MexcUtils } from './mexc-utils';

/**
 * MEXC Protobuf Message Decoder
 *
 * This decoder supports:
 * - Private order messages for user data stream functionality
 * - Market data messages for real-time ticker, orderbook, and trade data
 * 
 * Official MEXC Protocol Buffers Documentation:
 * https://www.mexc.com/api-docs/spot-v3/websocket-market-streams#protocol-buffers-integration
 * 
 * Supported message types:
 * - spot@private.orders.v3.api.pb (private orders)
 * - spot@public.aggre.bookTicker.v3.api.pb (ticker data)
 * - spot@public.bookTicker.batch.v3.api.pb (batch ticker data)
 * - spot@public.aggre.deals.v3.api.pb (trade data)
 */

export class MexcProtobufDecoder {
  
  /**
   * Main decoder function for MEXC protobuf messages
   */
  static decode(rawMessage: string): DecodedMexcMessage {
    try {
      const channelMatch = rawMessage.match(/^(spot@[^@]*)/);
      const channel = channelMatch ? channelMatch[1] : 'unknown';

      if (rawMessage.includes('private.orders')) {
        return this.decodeOrderMessage(rawMessage, channel);
      } else if (rawMessage.includes('aggre.bookTicker') || rawMessage.includes('bookTicker.batch')) {
        return this.decodeTickerMessage(rawMessage, channel);
      } else if (rawMessage.includes('aggre.deals')) {
        return this.decodeTradesMessage(rawMessage, channel);
      } else {
        return {
          type: 'unknown',
          raw: rawMessage,
          channel,
          error: `Unsupported message type: ${channel}`
        };
      }
    } catch (error) {
      return {
        type: 'unknown',
        raw: rawMessage,
        channel: 'unknown',
        error: `Decoding error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Decode order-related protobuf messages for user data stream
   * Format: spot@private.orders.v3.api.pINDYUSDT0...
   */
  private static decodeOrderMessage(message: string, channel: string): DecodedMexcMessage {
    try {
      let symbolMatch = message.match(/\.pb([A-Z]+USDT|[A-Z]+BTC|[A-Z]+ETH|[A-Z]+BNB)/);
      if (!symbolMatch) {
        symbolMatch = message.match(/spot@private\.orders\.v3\.api\.p([A-Z]+USDT|[A-Z]+BTC|[A-Z]+ETH|[A-Z]+BNB)/);
      }

      const symbol = symbolMatch ? symbolMatch[1] : 'UNKNOWN';
      
      const orderIdMatch = message.match(/C02__(\d+)/);
      const orderId = orderIdMatch ? `C02__${orderIdMatch[1]}` : 'UNKNOWN';
      
      let price = 0;
      let quantity = 0;
      
      const priceMatch = message.match(/\*(\d+\.?\d*)"/);
      if (priceMatch) price = parseFloat(priceMatch[1]);
      
      if (price === 0) {
        const decimalMatch = message.match(/(\d+\.\d{4,6})/);
        if (decimalMatch) price = parseFloat(decimalMatch[1]);
      }
      
      const quantityMatch = message.match(/"(\d+\.?\d*)[RH]?/);
      if (quantityMatch) quantity = parseFloat(quantityMatch[1]);
      
      if (quantity === 0) {
        const intMatch = message.match(/(\d{1,4})\D/);
        if (intMatch) {
          const val = parseFloat(intMatch[1]);
          if (val > 0 && val < 1000) quantity = val;
        }
      }
      
      const side = MexcUtils.determineSide(message);
      const status = MexcUtils.extractOrderStatus(message);
      
      const decoded: DecodedMexcOrder = {
        orderId,
        symbol: symbol.includes('/') ? symbol : `${symbol.slice(0, -4)}/${symbol.slice(-4)}`,
        price,
        quantity,
        side,
        status,
        timestamp: Date.now(),
        channel
      };

      return {
        type: 'order',
        raw: message,
        channel,
        symbol: decoded.symbol,
        decoded
      };
    } catch (error) {
      return {
        type: 'order',
        raw: message,
        channel,
        error: `Order decode error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }


  /**
   * Decode ticker protobuf messages
   * Format: spot@public.aggre.bookTicker.v3.api.pb@100ms@INDYUSDT...
   */
  private static decodeTickerMessage(message: string, channel: string): DecodedMexcMessage {
    try {
      const symbolMatch = message.match(/([A-Z]{3,10}USDT)/);
      const symbol = symbolMatch ? symbolMatch[1] : 'UNKNOWN';
      
      const priceMatches = message.match(/(\d+\.\d+)/g);
      
      let bidprice = '0';
      let askprice = '0';
      let bidquantity = '0';
      let askquantity = '0';
      
      if (priceMatches && priceMatches.length >= 2) {
        bidprice = priceMatches[0];
        askprice = priceMatches[1];
        
        if (priceMatches.length >= 4) {
          bidquantity = priceMatches[2];
          askquantity = priceMatches[3];
        }
      }
      
      const decoded = {
        bidprice,
        askprice,
        bidquantity,
        askquantity
      };

      return {
        type: 'ticker',
        raw: message,
        channel,
        symbol,
        decoded
      };
    } catch (error) {
      return {
        type: 'ticker',
        raw: message,
        channel,
        error: `Ticker decode error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Decode trades protobuf messages
   * Format: spot@public.aggre.deals.v3.api.pb@100ms@INDYUSDT...
   */
  private static decodeTradesMessage(message: string, channel: string): DecodedMexcMessage {
    try {
      const symbolMatch = message.match(/([A-Z]{3,10}USDT)/);
      const symbol = symbolMatch ? symbolMatch[1] : 'UNKNOWN';
      
      const priceMatches = message.match(/(\d+\.\d+)/g);
      
      const dealsList = [];
      
      if (priceMatches && priceMatches.length >= 2) {
        dealsList.push({
          price: priceMatches[0],
          quantity: priceMatches[1] || '1.0',
          time: Date.now().toString(),
          tradetype: 1
        });
      }
      
      const decoded = {
        dealsList,
        eventtype: 'trade'
      };

      return {
        type: 'trades',
        raw: message,
        channel,
        symbol,
        decoded
      };
    } catch (error) {
      return {
        type: 'trades',
        raw: message,
        channel,
        error: `Trades decode error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}