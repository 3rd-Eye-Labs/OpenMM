import crypto from 'crypto';
import { ExchangeCredentials } from '../../types';
import { createLogger } from '../../utils';

/**
 * MEXC Authentication and Request Handler
 * 
 * Handles API authentication, request signing, and HTTP requests to MEXC API.
 * Provides both authenticated and public request methods
 */
export class MexcAuth {
  private readonly credentials: ExchangeCredentials;
  private readonly baseUrl: string;
  private logger = createLogger('mexc-auth');

  constructor(credentials: ExchangeCredentials, baseUrl: string = 'https://api.mexc.com/api/v3') {
    this.credentials = credentials;
    this.baseUrl = baseUrl;
  }

  /**
   * Create headers for public endpoints
   */
  createPublicHeaders(): Record<string, string> {
    return {
      'x-mexc-apikey': this.credentials.apiKey,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Create headers for private API calls (with authentication)
   */
  private createPrivateHeaders(timestamp: number, signature: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-mexc-apikey': this.credentials.apiKey,
      'X-MEXC-TIMESTAMP': timestamp.toString(),
      'X-MEXC-SIGNATURE': signature
    };
  }

  /**
   * Generate HMAC-SHA256 signature for MEXC API
   */
  private generateSignature(params: string): string {
    return crypto.createHmac('sha256', this.credentials.secret).update(params).digest('hex');
  }

  /**
   * Make authenticated request to MEXC API
   */
  async makeRequest(
      endpoint: string,
      params: Record<string, unknown> = {},
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'
  ): Promise<any> {
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp };

    const queryString = Object.entries(queryParams)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

    const signature = this.generateSignature(queryString);
    const signedQuery = `${queryString}&signature=${signature}`;

    let url: string;
    let body: string | undefined;

    if (method === 'GET') {
      url = `${this.baseUrl}${endpoint}?${signedQuery}`;
    } else {
      url = `${this.baseUrl}${endpoint}`;
      body = signedQuery;
    }

    const response = await fetch(url, {
      method,
      headers: this.createPrivateHeaders(timestamp, signature),
      body: method !== 'GET' ? body : undefined
    });

    return this.handleResponse(response, endpoint);
  }

  /**
   * Handle API response and extract meaningful error messages
   */
  private async handleResponse(response: Response, endpoint: string): Promise<any> {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${errorText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.msg) {
          errorMessage = `MEXC API Error: ${errorData.msg} (Code: ${errorData.code || 'Unknown'})`;
        }
      } catch {
        // Use original HTTP error message
      }
      
      this.logger.error('MEXC API request failed', {
        endpoint,
        status: response.status,
        error: errorMessage
      });
      
      throw new Error(errorMessage);
    }

    return await response.json();
  }

  /**
   * Make public request (no authentication required)
   */
  async makePublicRequest(endpoint: string, params: Record<string, unknown> = {}): Promise<any> {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    const url = queryString 
      ? `${this.baseUrl}${endpoint}?${queryString}`
      : `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      headers: this.createPublicHeaders()
    });

    return this.handleResponse(response, endpoint);
  }

  /**
   * Check if credentials are valid (basic validation)
   */
  validateCredentials(): boolean {
    return !!(this.credentials.apiKey && this.credentials.secret);
  }
}