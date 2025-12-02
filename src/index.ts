export * from './types';

// Core components
export { BaseExchangeConnector } from './core/exchange/base-exchange-connector';
export { BaseStrategy } from './core/strategy/base-strategy';

// Exchange connectors
export { MexcConnector } from './exchanges/mexc/mexc-connector';

export { ValidationUtils } from './utils/validation';

import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'openmm' },
  transports: [
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

export class OpenMM {
  private logger = logger;

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