import { GridLevel } from '../../types';

export class GridCalculator {
  calculateGridLevels(centerPrice: number, spacing: number, levels: number): GridLevel[] {
    const gridLevels: GridLevel[] = [];
    
    for (let i = 1; i <= levels; i++) {
      const buyPrice = centerPrice * (1 - spacing * i);
      const sellPrice = centerPrice * (1 + spacing * i);
      
      gridLevels.push({
        price: buyPrice,
        side: 'buy',
        orderSize: 0
      });
      
      gridLevels.push({
        price: sellPrice,
        side: 'sell', 
        orderSize: 0
      });
    }
    
    return gridLevels;
  }

  calculateOrderSizes(availableBalance: number, levels: number): number {
    return (availableBalance * 0.8) / (levels * 2);
  }

  assignOrderSizes(gridLevels: GridLevel[], orderSize: number): GridLevel[] {
    return gridLevels.map(level => ({
      ...level,
      orderSize
    }));
  }
}