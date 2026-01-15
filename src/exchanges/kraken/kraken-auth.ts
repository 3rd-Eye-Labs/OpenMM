import crypto from 'crypto';
import { ExchangeCredentials } from '../../types';
import { createLogger } from '../../utils';

export class KrakenAuth {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly logger = createLogger('kraken-auth');

  constructor(credentials: ExchangeCredentials) {
    if (!credentials.apiKey || !credentials.secret) {
      throw new Error('API key and secret are required for Kraken');
    }
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.secret;
  }

  getNonce(): string {
    return Date.now().toString();
  }

  signMessage(path: string, nonce: string, postData: string): string {
    const message = path + crypto.createHash('sha256').update(nonce + postData).digest('binary');
    const secret = Buffer.from(this.apiSecret, 'base64');
    const hmac = crypto.createHmac('sha512', secret);
    hmac.update(message, 'binary');
    return hmac.digest('base64');
  }

  getHeaders(path: string, nonce: string, postData: string): Record<string, string> {
    return {
      'API-Key': this.apiKey,
      'API-Sign': this.signMessage(path, nonce, postData),
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  async makeRequest(
    url: string,
    path: string,
    params: Record<string, unknown> = {},
    method: string = 'POST'
  ): Promise<unknown> {
    const nonce = this.getNonce();
    const bodyParams = { nonce, ...params };
    const postData = new URLSearchParams(bodyParams as Record<string, string>).toString();

    const headers = this.getHeaders(path, nonce, postData);


    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method === 'POST' ? postData : undefined,
      });

      const data = await response.json();
      

      if (data.error && data.error.length > 0) {
        this.logger.error('Kraken API error', { 
          errors: data.error,
          request: { path, params }
        });
        throw new Error(`Kraken API error: ${data.error.join(', ')}`);
      }

      return data.result;
    } catch (error) {
      this.logger.error('Request failed', { 
        method, 
        path,
        params,
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }
}