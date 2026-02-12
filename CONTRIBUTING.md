# Contributing to OpenMM

Thanks for your interest in contributing to OpenMM! This guide will help you get started.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature
   ```

## Development Setup

1. Copy the environment template and configure your exchange API keys:
   ```bash
   cp .env.example .env
   ```
2. Build the project:
   ```bash
   npm run build
   ```
3. Run tests:
   ```bash
   npm test
   ```

## Project Structure

- `src/core/` — Core market making engine and strategy logic
- `src/exchanges/` — Custom CEX adapters (MEXC, Gate.io, Bitget, Kraken)
- `src/strategies/` — Trading strategy implementations
- `src/cli/` — CLI entry point and commands
- `src/config/` — Configuration management

## Making Changes

- Follow the existing code style and conventions
- Use TypeScript for all new code
- Write tests for new functionality
- Keep exchange-specific logic in adapter modules

## Submitting a Pull Request

1. Ensure your code builds cleanly:
   ```bash
   npm run build
   ```
2. Run the test suite:
   ```bash
   npm test
   ```
3. Lint your code:
   ```bash
   npm run lint
   ```
4. Commit with a clear, descriptive message
5. Push to your fork and open a PR against `main`
6. Describe what your PR does and why

## Adding Exchange Support

When adding a new exchange:

1. Implement the exchange adapter following the existing adapter pattern
2. Test authentication, ticker, orderbook, and order placement
3. Document any exchange-specific quirks or rate limits
4. Add the exchange to the supported list in the README

## Adding Strategies

When adding a new strategy:

1. Extend the base strategy interface
2. Include configurable parameters with sensible defaults
3. Implement dry-run mode for preview without placing orders
4. Add tests covering edge cases (empty orderbook, API errors)
5. Document the strategy parameters in the README

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Include steps to reproduce for bugs
- Mention which exchange(s) and trading pair(s) are affected if relevant

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
