import { DecodedMexcOrder, DecodedMexcTickerData, DecodedMexcTradesData } from '../../types';

export const mockCredentials = {
  apiKey: 'test_api_key_123',
  apiSecret: 'test_api_secret_456'
};

export const createMockOrder = (overrides = {}): DecodedMexcOrder => ({
  orderId: 'C02__123456789',
  symbol: 'INDY/USDT',
  price: 0.12340,
  quantity: 100.00,
  side: 'buy',
  status: 'new',
  timestamp: Date.now(),
  channel: 'spot@private.orders.v3.api.pb',
  ...overrides
});

export const createMockTickerData = (overrides = {}): DecodedMexcTickerData => ({
  bidprice: '0.12340',
  askprice: '0.12350',
  bidquantity: '100.00',
  askquantity: '50.00',
  ...overrides
});

export const createMockTradesData = (overrides = {}): DecodedMexcTradesData => ({
  dealsList: [
    {
      price: '0.12345',
      quantity: '50.00',
      time: Date.now().toString(),
      tradetype: 1
    }
  ],
  eventtype: 'trade',
  ...overrides
});

export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));