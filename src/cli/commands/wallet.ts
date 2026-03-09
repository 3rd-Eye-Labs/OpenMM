/**
 * OpenMM Wallet CLI Commands
 * Manage x402 payment wallets for EVM and Solana chains.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  createWallet,
  listWallets,
  showWallet,
  exportWallet,
  setDefaultWallet,
  deleteWallet,
  resolvePassword,
  getWalletConfig,
  checkX402Balance,
} from '../../x402';

export const walletCommand = new Command('wallet')
  .description('Manage x402 payment wallets')
  .addHelpText(
    'after',
    `
Examples:
  $ openmm wallet create my-wallet              # Create new wallet (requires OPENMM_WALLET_PASSWORD)
  $ openmm wallet create --unsafe-no-password   # Create unencrypted wallet (NOT RECOMMENDED)
  $ openmm wallet list                          # List all wallets
  $ openmm wallet show my-wallet                # Show wallet addresses
  $ openmm wallet balance                       # Check default wallet USDC balance
  $ openmm wallet default my-wallet             # Set default wallet
  $ openmm wallet fund                          # Show deposit addresses
  $ openmm wallet export my-wallet              # Export private keys (DANGER)
  $ openmm wallet delete my-wallet              # Delete a wallet

Environment:
  OPENMM_WALLET_PASSWORD    Wallet encryption password (required for create/export/delete)
  OPENMM_BASE_RPC          Custom Base network RPC endpoint
`
  );

// Create wallet
walletCommand
  .command('create [name]')
  .description('Create a new wallet pair (EVM + Solana)')
  .option('--unsafe-no-password', 'Store keys unencrypted (NOT RECOMMENDED)')
  .option('--json', 'Output in JSON format')
  .action(async (name: string | undefined, options: { unsafeNoPassword?: boolean; json?: boolean }) => {
    const walletName = name || 'default';

    let password: string | null;
    if (options.unsafeNoPassword) {
      console.error(
        chalk.yellow(
          'WARNING: --unsafe-no-password is set. Private keys will be stored UNENCRYPTED on disk.\n' +
            'Anyone with access to this machine can steal your funds.'
        )
      );
      password = null;
    } else {
      password = resolvePassword();
      if (!password) {
        console.error(
          chalk.red('Error: OPENMM_WALLET_PASSWORD environment variable is required.\n\n') +
            'Set it before creating a wallet:\n' +
            chalk.cyan('  export OPENMM_WALLET_PASSWORD="your-secure-password-here"\n') +
            '  openmm wallet create ' +
            walletName +
            '\n\n' +
            'Password must be at least 12 characters.\n' +
            'Or use --unsafe-no-password to skip encryption (NOT RECOMMENDED).'
        );
        process.exit(1);
      }
    }

    try {
      const result = createWallet(walletName, password);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.green(`\n✓ Wallet "${result.name}" created\n`));
        console.log(`  EVM:    ${result.evm}`);
        console.log(`  Solana: ${result.solana}`);
        if (result.isDefault) console.log(chalk.cyan('  ★ Set as default wallet'));
        console.log('');
        console.log(chalk.yellow('  Fund this wallet to start making API calls:'));
        console.log(`    Base: send USDC to ${result.evm}`);
        console.log(`    Solana: send USDC to ${result.solana}`);
        console.log('');
        if (password === null) {
          console.log(
            chalk.red(
              '  ⚠️  This is an UNENCRYPTED hot wallet — private keys are stored in plaintext on disk.'
            )
          );
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// List wallets
walletCommand
  .command('list')
  .description('List all wallets')
  .option('--json', 'Output in JSON format')
  .action((options: { json?: boolean }) => {
    const result = listWallets();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (result.wallets.length === 0) {
      console.log(chalk.yellow('No wallets found. Create one with: openmm wallet create'));
      return;
    }

    console.log('');
    for (const w of result.wallets) {
      const star = w.isDefault ? chalk.cyan(' ★') : '';
      console.log(`  ${w.name}${star}`);
      console.log(`    EVM:    ${w.evm}`);
      console.log(`    Solana: ${w.solana || 'N/A'}`);
      console.log('');
    }
  });

// Show wallet
walletCommand
  .command('show <name>')
  .description('Show wallet addresses')
  .option('--json', 'Output in JSON format')
  .action((name: string, options: { json?: boolean }) => {
    try {
      const result = showWallet(name);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        const star = result.isDefault ? chalk.cyan(' ★') : '';
        console.log(`\n  ${result.name}${star}`);
        console.log(`    EVM:     ${result.evm}`);
        console.log(`    Solana:  ${result.solana || 'N/A'}`);
        console.log(`    Created: ${result.createdAt}\n`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Balance
walletCommand
  .command('balance')
  .description('Check wallet USDC balance')
  .option('--network <network>', 'Network to check (default: eip155:8453 for Base)', 'eip155:8453')
  .option('--json', 'Output in JSON format')
  .action(async (options: { network: string; json?: boolean }) => {
    try {
      const result = await checkX402Balance(options.network);

      if (!result) {
        console.error(chalk.red('Could not check balance. Make sure you have a default wallet.'));
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('');
        console.log(`  Address: ${result.address}`);
        console.log(`  Network: ${result.network}`);
        console.log(
          `  Balance: ${chalk.green(result.balance.toFixed(6))} ${result.symbol}`
        );
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Fund
walletCommand
  .command('fund')
  .description('Show deposit addresses for default wallet')
  .action(() => {
    const result = listWallets();

    if (!result.defaultWallet) {
      console.error(chalk.red('No default wallet. Create one with: openmm wallet create'));
      process.exit(1);
    }

    const wallet = result.wallets.find(w => w.name === result.defaultWallet);
    if (!wallet) {
      console.error(chalk.red('Default wallet not found.'));
      process.exit(1);
    }

    console.log(chalk.cyan('\n  Fund your wallet to enable x402 payments:\n'));
    console.log(`  ${chalk.bold('Base (EVM) - USDC:')}`);
    console.log(`    ${wallet.evm}\n`);
    if (wallet.solana) {
      console.log(`  ${chalk.bold('Solana - USDC:')}`);
      console.log(`    ${wallet.solana}\n`);
    }
    console.log(chalk.dim('  Send USDC to the appropriate address for your network.\n'));
  });

// Default
walletCommand
  .command('default <name>')
  .description('Set the default wallet')
  .action((name: string) => {
    try {
      const result = setDefaultWallet(name);
      console.log(chalk.green(`✓ Default wallet set to "${result.defaultWallet}"`));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Export
walletCommand
  .command('export <name>')
  .description('Export private keys (DANGER: handle with care)')
  .option('--json', 'Output in JSON format')
  .action((name: string, options: { json?: boolean }) => {
    const config = getWalletConfig();
    let password: string | null = null;

    if (config.passwordHash) {
      password = resolvePassword();
      if (!password) {
        console.error(
          chalk.red('Error: OPENMM_WALLET_PASSWORD is required for encrypted wallets.')
        );
        process.exit(1);
      }
    }

    try {
      const result = exportWallet(name, password);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.red(`\n⚠️  Private keys for "${result.name}" — do not share!\n`));
        console.log(`  EVM:`);
        console.log(`    Address:     ${result.evm.address}`);
        console.log(`    Private Key: ${result.evm.privateKey}`);
        if (result.solana) {
          console.log(`  Solana:`);
          console.log(`    Address:     ${result.solana.address}`);
          console.log(`    Private Key: ${result.solana.privateKey}`);
        }
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Delete
walletCommand
  .command('delete <name>')
  .description('Delete a wallet')
  .option('--force', 'Skip confirmation')
  .action((name: string, options: { force?: boolean }) => {
    const config = getWalletConfig();
    let password: string | null = null;

    if (config.passwordHash) {
      password = resolvePassword();
      if (!password) {
        console.error(
          chalk.red('Error: OPENMM_WALLET_PASSWORD is required for encrypted wallets.')
        );
        process.exit(1);
      }
    }

    if (!options.force) {
      console.log(
        chalk.yellow(
          `Warning: This will permanently delete wallet "${name}" and its private keys.`
        )
      );
      console.log(chalk.yellow('Use --force to skip this warning.'));
      process.exit(1);
    }

    try {
      const result = deleteWallet(name, password);
      console.log(chalk.green(`✓ Wallet "${result.deleted}" deleted`));
      if (result.newDefault) {
        console.log(`  New default: ${result.newDefault}`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });
