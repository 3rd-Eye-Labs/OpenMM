import { GridCalculator } from '../../../../strategies/grid/grid-calculator';

describe('GridCalculator', () => {
  let calculator: GridCalculator;

  beforeEach(() => {
    calculator = new GridCalculator();
  });

  describe('calculateGridLevels', () => {
    it('should calculate correct grid levels around center price', () => {
      const centerPrice = 0.42;
      const spacing = 0.02; // 2%
      const levels = 3;

      const gridLevels = calculator.calculateGridLevels(centerPrice, spacing, levels);

      expect(gridLevels).toHaveLength(6); // 3 buy + 3 sell

      const buyOrders = gridLevels.filter(level => level.side === 'buy');
      const sellOrders = gridLevels.filter(level => level.side === 'sell');

      expect(buyOrders).toHaveLength(3);
      expect(sellOrders).toHaveLength(3);

      expect(buyOrders[0].price).toBeCloseTo(centerPrice * 0.98); // -2%
      expect(buyOrders[1].price).toBeCloseTo(centerPrice * 0.96); // -4%
      expect(buyOrders[2].price).toBeCloseTo(centerPrice * 0.94); // -6%

      expect(sellOrders[0].price).toBeCloseTo(centerPrice * 1.02); // +2%
      expect(sellOrders[1].price).toBeCloseTo(centerPrice * 1.04); // +4%
      expect(sellOrders[2].price).toBeCloseTo(centerPrice * 1.06); // +6%
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

      expect(orderSize).toBe(80); // 1000 * 0.8 / (5 * 2) = 80
    });

    it('should handle small balances', () => {
      const availableBalance = 100;
      const levels = 2;

      const orderSize = calculator.calculateOrderSizes(availableBalance, levels);

      expect(orderSize).toBe(20); // 100 * 0.8 / (2 * 2) = 20
    });
  });

  describe('assignOrderSizes', () => {
    it('should assign order sizes to all grid levels', () => {
      const gridLevels = [
        { price: 0.40, side: 'buy' as const, orderSize: 0 },
        { price: 0.44, side: 'sell' as const, orderSize: 0 }
      ];
      const orderSize = 50;

      const result = calculator.assignOrderSizes(gridLevels, orderSize);

      expect(result).toHaveLength(2);
      expect(result[0].orderSize).toBe(50);
      expect(result[1].orderSize).toBe(50);
      expect(result[0].price).toBe(0.40);
      expect(result[1].price).toBe(0.44);
    });
  });
});