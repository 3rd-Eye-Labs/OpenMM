import { Command } from 'commander';
import { ExchangeFactory } from '../exchange-factory';
import { validateExchange } from '../utils/validation';
import { executeCommand, displayBalance, handleError } from '../utils/error-handler';

export const balanceCommand = new Command('balance')
  .description('Get account balance from specified exchange')
  .requiredOption('-e, --exchange <exchange>', 'Exchange to query (mexc, gateio, bitget, kraken)')
  .option('-a, --asset <asset>', 'Specific asset to query (e.g., BTC, USDT)')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    await executeCommand(async () => {
      const exchange = validateExchange(options.exchange);
      
      try {
        const connector = await ExchangeFactory.getExchange(exchange);
        
        const allBalances = await connector.getBalance();
        let balance;
        
        if (options.asset) {
          const asset = options.asset.toUpperCase();
          balance = allBalances[asset] || {
            asset,
            free: 0,
            used: 0,
            total: 0,
            available: 0
          };
        } else {
          balance = allBalances;
        }

        if (options.json) {
          console.log(JSON.stringify(balance, null, 2));
        } else {
          displayBalance(balance, options.asset?.toUpperCase());
        }

      } catch (error) {
        handleError(error as Error, 'Balance Query');
      }
    }, 'balance command');
  });

balanceCommand.addHelpText('after', `
Examples:
  $ openmm balance --exchange mexc                    # Get all balances
  $ openmm balance --exchange mexc --asset BTC        # Get BTC balance only
  $ openmm balance --exchange mexc --json             # Output as JSON
`);