import { Command } from 'commander';
import chalk from 'chalk';
import { startApiServer } from '../../api';

export const serveCommand = new Command('serve')
  .description('Start the OpenMM REST API server')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-h, --host <host>', 'Host to bind to', '0.0.0.0')
  .option('--no-swagger', 'Disable Swagger/OpenAPI docs')
  .option('--no-cors', 'Disable CORS')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    const host = options.host;

    console.log(chalk.cyan('🚀 Starting OpenMM API Server...'));
    console.log(chalk.gray(`   Host: ${host}`));
    console.log(chalk.gray(`   Port: ${port}`));
    console.log(chalk.gray(`   Swagger: ${options.swagger ? 'enabled' : 'disabled'}`));
    console.log(chalk.gray(`   CORS: ${options.cors ? 'enabled' : 'disabled'}`));
    console.log();

    try {
      await startApiServer({
        host,
        port,
        enableSwagger: options.swagger,
        enableCors: options.cors,
      });

      console.log(chalk.green(`✓ API server running at http://${host}:${port}`));
      if (options.swagger) {
        console.log(chalk.blue(`📚 OpenAPI docs: http://${host}:${port}/docs`));
      }
      console.log();
      console.log(chalk.gray('Press Ctrl+C to stop'));

      // Keep process running
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n👋 Shutting down...'));
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        console.log(chalk.yellow('\n👋 Shutting down...'));
        process.exit(0);
      });
    } catch (error) {
      console.error(chalk.red('Failed to start server:'), error);
      process.exit(1);
    }
  });
