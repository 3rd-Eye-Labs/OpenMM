#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { balanceCommand } from './commands/balance';
import { ordersCommand } from './commands/orders';
import { tickerCommand } from './commands/ticker';
import { orderbookCommand } from './commands/orderbook';
import { tradesCommand } from './commands/trades';
import { poolDiscoveryCommand } from './commands/pool-discovery';

const program = new Command();

program
  .name('openmm')
  .description('OpenMM - Universal Market Making Toolkit')
  .version('1.0.0');

program.addCommand(balanceCommand);
program.addCommand(ordersCommand);
program.addCommand(tickerCommand);
program.addCommand(orderbookCommand);
program.addCommand(tradesCommand);
program.addCommand(poolDiscoveryCommand);

program.exitOverride((err) => {
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