import { RiskManager } from '../../../../core/risk-management/risk-manager';
import { Order } from '../../../../types';
import { Balance } from '../../../../types';
import { AggregatedPrice } from '../../../../types';

describe('RiskManager', () => {
  let riskManager: RiskManager;

  beforeEach(() => {
    riskManager = new RiskManager({
      maxPositionSize: 0.8,
      safetyReservePercentage: 0.2,
      minConfidence: 0.6
    });
  });

  describe('validatePosition', () => {
    it('should allow orders within 80% position limit', () => {
      const order: Order = {
        id: 'test-order',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'buy',
        amount: 100,
        price: 0.42,
        filled: 0,
        remaining: 100,
        status: 'open',
        timestamp: Date.now()
      };

      const balance: Balance = {
        asset: 'USDT',
        free: 600,
        used: 200,
        total: 1000,
        available: 600
      };

      const isValid = riskManager.validatePosition(order, balance);

      expect(isValid).toBe(true);
    });

    it('should reject orders exceeding 80% position limit', () => {
      const order: Order = {
        id: 'test-order',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'buy',
        amount: 1000,
        price: 0.42,
        filled: 0,
        remaining: 1000,
        status: 'open',
        timestamp: Date.now()
      };

      const balance: Balance = {
        asset: 'USDT',
        free: 200,
        used: 400,
        total: 1000,
        available: 200
      };

      const isValid = riskManager.validatePosition(order, balance);

      expect(isValid).toBe(false);
    });
  });

  describe('checkPriceConfidence', () => {
    it('should accept price confidence above threshold', () => {
      const aggregatedPrice: AggregatedPrice = {
        symbol: 'INDY/USDT',
        price: 0.42,
        confidence: 0.8,
        timestamp: new Date(),
        sources: []
      };

      const isValid = riskManager.checkPriceConfidence(aggregatedPrice);

      expect(isValid).toBe(true);
    });

    it('should reject price confidence below threshold', () => {
      const aggregatedPrice: AggregatedPrice = {
        symbol: 'INDY/USDT',
        price: 0.42,
        confidence: 0.4,
        timestamp: new Date(),
        sources: []
      };

      const isValid = riskManager.checkPriceConfidence(aggregatedPrice);

      expect(isValid).toBe(false);
    });
  });

  describe('calculateAvailableBalance', () => {
    it('should calculate 80% of total balance as available', () => {
      const balance: Balance = {
        asset: 'USDT',
        free: 800,
        used: 200,
        total: 1000,
        available: 800
      };

      const available = riskManager.calculateAvailableBalance(balance);

      expect(available).toBe(800); // 1000 * (1 - 0.2) = 800
    });
  });

  describe('validateTrade', () => {
    it('should validate trade with good confidence and position size', () => {
      const order: Order = {
        id: 'test-order',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'buy',
        amount: 100,
        price: 0.42,
        filled: 0,
        remaining: 100,
        status: 'open',
        timestamp: Date.now()
      };

      const balance: Balance = {
        asset: 'USDT',
        free: 600,
        used: 200,
        total: 1000,
        available: 600
      };

      const aggregatedPrice: AggregatedPrice = {
        symbol: 'INDY/USDT',
        price: 0.42,
        confidence: 0.8,
        timestamp: new Date(),
        sources: []
      };

      const result = riskManager.validateTrade(order, balance, aggregatedPrice);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject trade with low confidence', () => {
      const order: Order = {
        id: 'test-order',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'buy',
        amount: 100,
        price: 0.42,
        filled: 0,
        remaining: 100,
        status: 'open',
        timestamp: Date.now()
      };

      const balance: Balance = {
        asset: 'USDT',
        free: 600,
        used: 200,
        total: 1000,
        available: 600
      };

      const aggregatedPrice: AggregatedPrice = {
        symbol: 'INDY/USDT',
        price: 0.42,
        confidence: 0.4,
        timestamp: new Date(),
        sources: []
      };

      const result = riskManager.validateTrade(order, balance, aggregatedPrice);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Price confidence too low');
    });

    it('should reject trade exceeding position limit', () => {
      const order: Order = {
        id: 'test-order',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'buy',
        amount: 2000,
        price: 0.42,
        filled: 0,
        remaining: 2000,
        status: 'open',
        timestamp: Date.now()
      };

      const balance: Balance = {
        asset: 'USDT',
        free: 200,
        used: 600,
        total: 1000,
        available: 200
      };

      const aggregatedPrice: AggregatedPrice = {
        symbol: 'INDY/USDT',
        price: 0.42,
        confidence: 0.8,
        timestamp: new Date(),
        sources: []
      };

      const result = riskManager.validateTrade(order, balance, aggregatedPrice);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Position size would exceed 80% limit');
    });
  });
});