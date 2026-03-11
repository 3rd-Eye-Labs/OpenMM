#!/usr/bin/env node

// Handle setup command before importing modules that require credentials
if (process.argv[2] === 'setup') {
  import('./commands/setup.js').then(({ setupCommand }) => {
    const { Command } = require('commander');
    const program = new Command();
    program.name('openmm').description('OpenMM - Universal Market Making Toolkit').version('1.0.0');
    program.addCommand(setupCommand);
    program.parse(process.argv);
  });
} else {
  // Normal CLI with all commands
  runCli();
}

async function runCli() {
  const { Command } = await import('commander');
  const chalk = (await import('chalk')).default;
  const { balanceCommand } = await import('./commands/balance.js');
  const { ordersCommand } = await import('./commands/orders.js');
  const { tickerCommand } = await import('./commands/ticker.js');
  const { orderbookCommand } = await import('./commands/orderbook.js');
  const { tradesCommand } = await import('./commands/trades.js');
  const { ohlcvCommand } = await import('./commands/ohlcv.js');
  const { poolDiscoveryCommand } = await import('./commands/pool-discovery.js');
  const { tradeCommand } = await import('./commands/trade.js');
  const { priceComparisonCommand } = await import('./commands/price-comparison.js');
  const { walletCommand } = await import('./commands/wallet.js');
  const { setupCommand } = await import('./commands/setup.js');

  const program = new Command();

  program.name('openmm').description('OpenMM - Universal Market Making Toolkit').version('1.0.0');

  program.addCommand(setupCommand);
  program.addCommand(balanceCommand);
  program.addCommand(ordersCommand);
  program.addCommand(tickerCommand);
  program.addCommand(orderbookCommand);
  program.addCommand(tradesCommand);
  program.addCommand(ohlcvCommand);
  program.addCommand(poolDiscoveryCommand);
  program.addCommand(tradeCommand);
  program.addCommand(priceComparisonCommand);
  program.addCommand(walletCommand);

  program.exitOverride(err => {
    if (err.code === 'commander.unknownCommand') {
      console.error(chalk.red(`Unknown command: ${err.message}`));
      console.log(chalk.yellow('Run "openmm --help" to see available commands'));
      process.exit(1);
    }
    if (err.code === 'commander.helpDisplayed') {
      process.exit(0);
    }
    throw err;
  });

  program.parse(process.argv);

  if (process.argv.length === 2) {
    program.help();
  }
}
