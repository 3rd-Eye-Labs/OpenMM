import { GridCalculator } from '../../../../strategies/grid/grid-calculator';

describe('GridCalculator', () => {
  let calculator: GridCalculator;
  beforeEach(() => {
    calculator = new GridCalculator();
  });

  describe('calculateGridLevels', () => {
    it('should calculate correct grid levels around center price', () => {
      const centerPrice = 0.42;
      const spacing = 0.02;
      const levels = 3;
      const gridLevels = calculator.calculateGridLevels(centerPrice, spacing, levels);
      expect(gridLevels).toHaveLength(6);
      const buyOrders = gridLevels.filter(level => level.side === 'buy');
      const sellOrders = gridLevels.filter(level => level.side === 'sell');
      expect(buyOrders).toHaveLength(3);
      expect(sellOrders).toHaveLength(3);
      expect(buyOrders[0].price).toBeCloseTo(centerPrice * 0.98);
      expect(buyOrders[1].price).toBeCloseTo(centerPrice * 0.96);
      expect(buyOrders[2].price).toBeCloseTo(centerPrice * 0.94);
      expect(sellOrders[0].price).toBeCloseTo(centerPrice * 1.02);
      expect(sellOrders[1].price).toBeCloseTo(centerPrice * 1.04);
      expect(sellOrders[2].price).toBeCloseTo(centerPrice * 1.06);
    });

    it('should handle single level grid', () => {
      const centerPrice = 1.0;
      const spacing = 0.01;
      const levels = 1;
      const gridLevels = calculator.calculateGridLevels(centerPrice, spacing, levels);
      expect(gridLevels).toHaveLength(2);
      expect(gridLevels.find(l => l.side === 'buy')?.price).toBeCloseTo(0.99);
      expect(gridLevels.find(l => l.side === 'sell')?.price).toBeCloseTo(1.01);
    });
  });

  describe('calculateOrderSizes', () => {
    it('should calculate equal order sizes using 80% of available balance', () => {
      const availableBalance = 1000;
      const levels = 5;
      const orderSize = calculator.calculateOrderSizes(availableBalance, levels);
      expect(orderSize).toBe(80);
    });

    it('should handle small balances', () => {
      const availableBalance = 100;
      const levels = 2;
      const orderSize = calculator.calculateOrderSizes(availableBalance, levels);
      expect(orderSize).toBe(20);
    });
  });

  describe('assignOrderSizes', () => {
    it('should assign order sizes to all grid levels with currency conversion', () => {
      const gridLevels = [
        { price: 0.4, side: 'buy' as const, orderSize: 0 },
        { price: 0.44, side: 'sell' as const, orderSize: 0 },
      ];
      const orderSizeInQuote = 50;
      const result = calculator.assignOrderSizes(gridLevels, orderSizeInQuote);
      expect(result).toHaveLength(2);

      expect(result[0].orderSize).toBe(125);
      expect(result[1].orderSize).toBeCloseTo(113.636, 2);

      expect(result[0].price).toBe(0.4);
      expect(result[1].price).toBe(0.44);
    });
  });
});
