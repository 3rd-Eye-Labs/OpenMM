# Authentication

The OpenMM API server uses environment-based authentication. API credentials are configured server-side, not passed in requests.

## Server Configuration

Before starting the API server, configure exchange credentials in your environment:

```bash
# .env file
MEXC_API_KEY=your-api-key
MEXC_SECRET=your-secret-key

GATEIO_API_KEY=your-api-key
GATEIO_SECRET_KEY=your-secret-key

BITGET_API_KEY=your-api-key
BITGET_SECRET_KEY=your-secret-key
BITGET_PASSPHRASE=your-passphrase

KRAKEN_API_KEY=your-api-key
KRAKEN_SECRET_KEY=your-secret-key
```

## Security Considerations

### Local Development
The API server is designed for local use or trusted network environments.

### Production Deployment
For production deployments, consider:

1. **Reverse Proxy** — Use nginx/caddy with TLS termination
2. **API Gateway** — Add authentication layer (JWT, API keys)
3. **Network Isolation** — Run on private network only
4. **Rate Limiting** — Implement request throttling

### Example: Basic Auth with nginx

```nginx
location /api/ {
    auth_basic "OpenMM API";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://localhost:3000;
}
```

## Request Headers

No special headers required for local use.

For future x402 micropayment support:
```
X-402-Payment: <payment-token>
```
