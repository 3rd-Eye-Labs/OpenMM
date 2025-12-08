import { Command } from 'commander';
import chalk from 'chalk';
import { ExchangeFactory } from '../exchange-factory';
import { 
  validateExchange, 
  validateSymbol, 
  validateOrderId, 
  validatePositiveNumber,
  validateOrderType,
  validateOrderSide 
} from '../utils/validation';
import { executeCommand, displayTable, showSuccess, handleError } from '../utils/error-handler';

export const ordersCommand = new Command('orders')
  .description('Manage orders on specified exchange');

ordersCommand
  .command('list')
  .description('List orders')
  .requiredOption('-e, --exchange <exchange>', 'Exchange to query')
  .option('-s, --symbol <symbol>', 'Filter by trading pair (e.g., BTC/USDT)')
  .option('-l, --limit <limit>', 'Number of orders to display (default: all)', 'all')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    await executeCommand(async () => {
      const exchange = validateExchange(options.exchange);
      const symbol = options.symbol ? validateSymbol(options.symbol) : undefined;
      
      let limit: number | undefined;
      if (options.limit !== 'all') {
        limit = parseInt(options.limit);
        if (isNaN(limit) || limit <= 0) {
          console.error(chalk.red('❌ Limit must be a positive number or "all"'));
          process.exit(1);
        }
      }
      
      try {
        const connector = await ExchangeFactory.getExchange(exchange);
        let orders = await connector.getOpenOrders(symbol);

        if (limit) {
          orders = orders.slice(0, limit);
        }

        if (options.json) {
          console.log(JSON.stringify(orders, null, 2));
        } else {
          if (orders.length === 0) {
            console.log(chalk.yellow('No open orders found'));
            return;
          }

          const orderData = orders.map(order => ({
            ID: order.id,
            Symbol: order.symbol,
            Side: order.side.toUpperCase(),
            Type: order.type.toUpperCase(),
            Amount: order.amount.toFixed(8),
            Price: order.price ? order.price.toFixed(8) : 'Market',
            Filled: order.filled.toFixed(8),
            Status: order.status.toUpperCase()
          }));

          const limitText = limit ? ` (showing ${Math.min(limit, orders.length)})` : '';
          console.log(`\n${chalk.bold.cyan('Open Orders')}${symbol ? ` for ${symbol}` : ''}${limitText}:`);
          displayTable(orderData);
        }
      } catch (error) {
        handleError(error as Error, 'List Orders');
      }
    }, 'list orders');
  });

ordersCommand
  .command('get')
  .description('Get specific order details')
  .requiredOption('-e, --exchange <exchange>', 'Exchange to query')
  .requiredOption('-i, --id <orderId>', 'Order ID')
  .requiredOption('-s, --symbol <symbol>', 'Trading pair symbol')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    await executeCommand(async () => {
      const exchange = validateExchange(options.exchange);
      const orderId = validateOrderId(options.id);
      const symbol = validateSymbol(options.symbol);
      
      try {
        const connector = await ExchangeFactory.getExchange(exchange);
        const order = await connector.getOrder(orderId, symbol);

        if (options.json) {
          console.log(JSON.stringify(order, null, 2));
        } else {
          console.log(`\n${chalk.bold.cyan('Order Details')}:`);
          console.log(`  ID:        ${order.id}`);
          console.log(`  Symbol:    ${order.symbol}`);
          console.log(`  Side:      ${chalk.bold(order.side.toUpperCase())}`);
          console.log(`  Type:      ${order.type.toUpperCase()}`);
          console.log(`  Amount:    ${order.amount.toFixed(8)}`);
          console.log(`  Price:     ${order.price ? order.price.toFixed(8) : 'Market'}`);
          console.log(`  Filled:    ${chalk.green(order.filled.toFixed(8))}`);
          console.log(`  Remaining: ${chalk.yellow(order.remaining.toFixed(8))}`);
          console.log(`  Status:    ${chalk.bold(order.status.toUpperCase())}`);
        }
      } catch (error) {
        handleError(error as Error, 'Get Order');
      }
    }, 'get order');
  });

ordersCommand
  .command('create')
  .description('Create a new order')
  .requiredOption('-e, --exchange <exchange>', 'Exchange to use')
  .requiredOption('-s, --symbol <symbol>', 'Trading pair (e.g., BTC/USDT)')
  .requiredOption('--side <side>', 'Order side (buy/sell)')
  .requiredOption('--type <type>', 'Order type (market/limit)')
  .requiredOption('--amount <amount>', 'Order amount')
  .option('--price <price>', 'Order price (required for limit orders)')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    await executeCommand(async () => {
      const exchange = validateExchange(options.exchange);
      const symbol = validateSymbol(options.symbol);
      const side = validateOrderSide(options.side);
      const type = validateOrderType(options.type);
      const amount = validatePositiveNumber(options.amount, 'Amount');
      
      let price: number | undefined;
      if (type === 'limit') {
        if (!options.price) {
          console.error(chalk.red('❌ Price is required for limit orders'));
          process.exit(1);
        }
        price = validatePositiveNumber(options.price, 'Price');
      }
      
      try {
        const connector = await ExchangeFactory.getExchange(exchange);
        const order = await connector.createOrder(symbol, type, side, amount, price);

        if (options.json) {
          console.log(JSON.stringify(order, null, 2));
        } else {
          showSuccess(`Order created successfully!`);
          console.log(`  Order ID:  ${chalk.bold(order.id)}`);
          console.log(`  Symbol:    ${order.symbol}`);
          console.log(`  Side:      ${chalk.bold(side.toUpperCase())}`);
          console.log(`  Type:      ${type.toUpperCase()}`);
          console.log(`  Amount:    ${amount.toFixed(8)}`);
          if (price) {
            console.log(`  Price:     ${price.toFixed(8)}`);
          }
          console.log(`  Status:    ${chalk.green(order.status.toUpperCase())}`);
        }
      } catch (error) {
        handleError(error as Error, 'Create Order');
      }
    }, 'create order');
  });

ordersCommand
  .command('cancel')
  .description('Cancel a specific order')
  .requiredOption('-e, --exchange <exchange>', 'Exchange to use')
  .requiredOption('-i, --id <orderId>', 'Order ID to cancel')
  .requiredOption('-s, --symbol <symbol>', 'Trading pair symbol')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    await executeCommand(async () => {
      const exchange = validateExchange(options.exchange);
      const orderId = validateOrderId(options.id);
      const symbol = validateSymbol(options.symbol);
      
      try {
        const connector = await ExchangeFactory.getExchange(exchange);
        await connector.cancelOrder(orderId, symbol);

        if (options.json) {
          console.log(JSON.stringify({ 
            success: true, 
            orderId, 
            symbol, 
            message: 'Order cancelled successfully' 
          }, null, 2));
        } else {
          showSuccess(`Order cancelled successfully!`);
          console.log(`  Order ID:  ${chalk.bold(orderId)}`);
          console.log(`  Symbol:    ${symbol}`);
          console.log(`  Status:    ${chalk.red('CANCELLED')}`);
        }
      } catch (error) {
        handleError(error as Error, 'Cancel Order');
      }
    }, 'cancel order');
  });

ordersCommand.addHelpText('after', `
Examples:
  $ openmm orders list --exchange mexc                           # List all open orders
  $ openmm orders list --exchange mexc --limit 5                 # List only 5 orders
  $ openmm orders list --exchange mexc --symbol BTC/USDT        # List orders for BTC/USDT
  $ openmm orders get --exchange mexc --id 12345 --symbol BTC/USDT  # Get specific order
  $ openmm orders create --exchange mexc --symbol BTC/USDT --side buy --type limit --amount 0.001 --price 50000
  $ openmm orders cancel --exchange mexc --id 12345 --symbol BTC/USDT  # Cancel specific order
`);