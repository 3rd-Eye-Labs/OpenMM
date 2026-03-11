import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import chalk from 'chalk';

interface Exchange {
  id: string;
  name: string;
  fields: { key: string; label: string }[];
  docsUrl: string;
}

const EXCHANGES: Exchange[] = [
  {
    id: 'mexc',
    name: 'MEXC',
    fields: [
      { key: 'MEXC_API_KEY', label: 'API Key' },
      { key: 'MEXC_SECRET', label: 'Secret Key' },
    ],
    docsUrl: 'https://www.mexc.com/api',
  },
  {
    id: 'gateio',
    name: 'Gate.io',
    fields: [
      { key: 'GATEIO_API_KEY', label: 'API Key' },
      { key: 'GATEIO_SECRET', label: 'Secret Key' },
    ],
    docsUrl: 'https://www.gate.io/myaccount/api_key_manage',
  },
  {
    id: 'kraken',
    name: 'Kraken',
    fields: [
      { key: 'KRAKEN_API_KEY', label: 'API Key' },
      { key: 'KRAKEN_SECRET', label: 'Private Key' },
    ],
    docsUrl: 'https://www.kraken.com/u/security/api',
  },
  {
    id: 'bitget',
    name: 'Bitget',
    fields: [
      { key: 'BITGET_API_KEY', label: 'API Key' },
      { key: 'BITGET_SECRET', label: 'Secret Key' },
      { key: 'BITGET_PASSPHRASE', label: 'Passphrase' },
    ],
    docsUrl: 'https://www.bitget.com/account/newapi',
  },
];

const BANNER = `
${chalk.cyan('╔═══════════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}                                                               ${chalk.cyan('║')}
${chalk.cyan('║')}    ${chalk.bold.white('██████╗ ██████╗ ███████╗███╗   ██╗███╗   ███╗███╗   ███╗')}   ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.white('██╔═══██╗██╔══██╗██╔════╝████╗  ██║████╗ ████║████╗ ████║')}   ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.white('██║   ██║██████╔╝█████╗  ██╔██╗ ██║██╔████╔██║██╔████╔██║')}   ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.white('██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║╚██╔╝██║██║╚██╔╝██║')}   ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.white('╚██████╔╝██║     ███████╗██║ ╚████║██║ ╚═╝ ██║██║ ╚═╝ ██║')}   ${chalk.cyan('║')}
${chalk.cyan('║')}    ${chalk.bold.white('╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚═╝     ╚═╝╚═╝     ╚═╝')}   ${chalk.cyan('║')}
${chalk.cyan('║')}                                                               ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.gray('AI-Native Market Making Infrastructure')}                      ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.gray('Configure your exchange API credentials')}                     ${chalk.cyan('║')}
${chalk.cyan('║')}                                                               ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════════════════════════╝')}
`;

function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      resolve(answer.trim());
    });
  });
}

function selectMultiple(
  rl: readline.Interface,
  prompt: string,
  options: { id: string; name: string }[]
): Promise<string[]> {
  return new Promise(resolve => {
    console.log(`\n${chalk.bold(prompt)}`);
    options.forEach((opt, i) => console.log(`  ${chalk.cyan(i + 1)}. ${opt.name}`));
    console.log(`\n  ${chalk.gray('Enter numbers separated by commas (e.g., 1,2,3)')}`);
    console.log(`  ${chalk.gray('Or press Enter for all exchanges')}`);
    rl.question(`\n${chalk.yellow('Your selection:')} `, answer => {
      if (!answer.trim()) {
        resolve(options.map(o => o.id));
        return;
      }
      const indices = answer
        .split(',')
        .map(s => parseInt(s.trim()) - 1)
        .filter(i => i >= 0 && i < options.length);
      if (indices.length === 0) {
        resolve(options.map(o => o.id));
      } else {
        resolve(indices.map(i => options[i].id));
      }
    });
  });
}

function readEnvFile(envPath: string): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key) {
            env[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
    }
  } catch {
    // File doesn't exist or is unreadable
  }
  return env;
}

function writeEnvFile(envPath: string, env: Record<string, string>): void {
  const lines: string[] = [
    '# OpenMM Exchange Credentials',
    '# Generated by OpenMM Setup Wizard',
    '',
  ];

  // Group by exchange
  const exchangeKeys: Record<string, string[]> = {
    MEXC: ['MEXC_API_KEY', 'MEXC_SECRET', 'MEXC_UID'],
    GATEIO: ['GATEIO_API_KEY', 'GATEIO_SECRET'],
    KRAKEN: ['KRAKEN_API_KEY', 'KRAKEN_SECRET'],
    BITGET: ['BITGET_API_KEY', 'BITGET_SECRET', 'BITGET_PASSPHRASE'],
  };

  const usedKeys = new Set<string>();

  for (const [exchange, keys] of Object.entries(exchangeKeys)) {
    const hasAny = keys.some(k => env[k]);
    if (hasAny) {
      lines.push(`# ${exchange}`);
      for (const key of keys) {
        if (env[key]) {
          lines.push(`${key}=${env[key]}`);
          usedKeys.add(key);
        }
      }
      lines.push('');
    }
  }

  // Add any remaining keys
  for (const [key, value] of Object.entries(env)) {
    if (!usedKeys.has(key) && value) {
      lines.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(envPath, lines.join('\n'));
}

async function runSetup(): Promise<void> {
  console.log(BANNER);

  const rl = createReadlineInterface();
  const envPath = path.join(process.cwd(), '.env');

  try {
    // Read existing .env
    const existingEnv = readEnvFile(envPath);

    // Select exchanges
    const exchangeOptions = EXCHANGES.map(e => ({ id: e.id, name: e.name }));
    const selectedExchangeIds = await selectMultiple(
      rl,
      'Which exchanges do you want to configure?',
      exchangeOptions
    );

    const selectedExchanges = EXCHANGES.filter(e => selectedExchangeIds.includes(e.id));

    if (selectedExchanges.length === 0) {
      console.log(chalk.yellow('\n⚠️  No exchanges selected. Exiting.'));
      process.exit(0);
    }

    // Collect credentials
    const newEnv: Record<string, string> = {};

    for (const exchange of selectedExchanges) {
      console.log(`\n${chalk.cyan('🔐')} ${chalk.bold(exchange.name)} credentials`);
      console.log(`   ${chalk.gray(`Get your API key at: ${exchange.docsUrl}`)}`);

      for (const field of exchange.fields) {
        const existingValue = existingEnv[field.key];
        const hint = existingValue ? chalk.gray(` (current: ${existingValue.slice(0, 8)}...)`) : '';
        const value = await question(rl, `   ${field.label}${hint}: `);
        if (value) {
          newEnv[field.key] = value;
        } else if (existingValue) {
          newEnv[field.key] = existingValue;
        }
      }
    }

    // Merge with existing env
    const mergedEnv = { ...existingEnv, ...newEnv };

    // Write .env file
    writeEnvFile(envPath, mergedEnv);

    console.log(`\n${chalk.green('✅')} Credentials saved to ${chalk.cyan('.env')}`);

    // Show configured exchanges
    const configuredExchanges: string[] = [];
    if (mergedEnv.MEXC_API_KEY) configuredExchanges.push('MEXC');
    if (mergedEnv.GATEIO_API_KEY) configuredExchanges.push('Gate.io');
    if (mergedEnv.KRAKEN_API_KEY) configuredExchanges.push('Kraken');
    if (mergedEnv.BITGET_API_KEY) configuredExchanges.push('Bitget');

    if (configuredExchanges.length > 0) {
      console.log(`\n${chalk.cyan('📊')} Configured exchanges: ${chalk.bold(configuredExchanges.join(', '))}`);
    }

    console.log(`\n${chalk.yellow('💡')} Try running: ${chalk.cyan('openmm balance --exchange mexc')}\n`);
  } finally {
    rl.close();
  }
}

export const setupCommand = new Command('setup')
  .description('Interactive setup wizard for exchange API credentials')
  .action(async () => {
    await runSetup();
  });
