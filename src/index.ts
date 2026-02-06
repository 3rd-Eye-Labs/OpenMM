export * from './types';

// Core components
export { BaseExchangeConnector } from './core/exchange/base-exchange-connector';
export { BaseStrategy } from './core/strategy/base-strategy';

// Exchange connectors
export { MexcConnector } from './exchanges/mexc/mexc-connector';
export { GateioConnector } from './exchanges/gateio/gateio-connector';
export { BitgetConnector } from './exchanges/bitget/bitget-connector';
export  { KrakenConnector } from './exchanges/kraken/kraken-connector';

// Exchange factory
export { ExchangeFactory, SupportedExchange } from './cli/exchange-factory';
import { createLogger } from './utils';

export class OpenMM {
  private logger = createLogger('openmm', './logs/openmm.log');

  constructor() {
    this.logger.info('OpenMM Universal Market Making Toolkit initialized');
  }

  public start(): void {
    this.logger.info('Starting OpenMM Market Making Toolkit');
  }

  public stop(): void {
    this.logger.info('Stopping OpenMM Market Making Toolkit');
  }
}

export default OpenMM;
