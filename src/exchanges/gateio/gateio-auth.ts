import crypto from 'crypto';
import { ExchangeCredentials } from '../../types';
import { createLogger } from '../../utils';

/**
 * Gate.io Authentication and Request Handler
 *
 * Handles API authentication, request signing, and HTTP requests to Gate.io API.
 * Implements Gate.io's HMAC-SHA512 signature generation with hex encoding.
 *
 * @see https://www.gate.io/docs/developers/apiv4/en/
 */
export class GateioAuth {
  private readonly credentials: ExchangeCredentials;
  private readonly baseUrl: string;
  private logger = createLogger('gateio-auth');

  /**
   * Initialize Gate.io authentication handler
   *
   * @param credentials - Gate.io API credentials including API key and secret
   * @param baseUrl - Base URL for Gate.io API (defaults to production)
   */
  constructor(credentials: ExchangeCredentials, baseUrl: string = 'https://api.gateio.ws') {
    this.credentials = credentials;
    this.baseUrl = baseUrl;
    this.validateCredentials();
  }

  /**
   * Generate HMAC-SHA512 signature for Gate.io API requests
   *
   * Signature format: HMAC-SHA512 of (method + "\n" + "/api/v4" + url_path + "\n" + query_string + "\n" + payload_hash + "\n" + timestamp)
   * - url_path MUST include "/api/v4" prefix
   * - payload_hash: SHA512 hash of request body (empty string if no body) - hex encoded
   * - timestamp: Unix timestamp in SECONDS (not milliseconds)
   */
  generateSignature(
    timestamp: number,
    method: string,
    requestPath: string,
    queryString: string = '',
    body: string = ''
  ): string {
    const fullPath = requestPath.startsWith('/api/v4') ? requestPath : `/api/v4${requestPath}`;

    const payloadHash = crypto.createHash('sha512').update(body).digest('hex');

    const signatureString = `${method.toUpperCase()}\n${fullPath}\n${queryString}\n${payloadHash}\n${timestamp}`;

    try {
      const hmac = crypto.createHmac('sha512', this.credentials.secret);
      hmac.update(signatureString);
      return hmac.digest('hex');
    } catch (error) {
      this.logger.error('Failed to generate signature', { error });
      throw new Error(`Failed to generate Gate.io API signature: ${error}`);
    }
  }

  /**
   * Generate signature for Gate.io WebSocket authentication
   * WebSocket signature format: channel=<channel>&event=<event>&time=<timestamp>
   *
   * @param channel - WebSocket channel name (e.g., 'spot.orders')
   * @param event - Event type (e.g., 'subscribe')
   * @param timestamp - Unix timestamp in seconds
   * @returns HMAC-SHA512 hex signature
   */
  generateWebSocketSignature(channel: string, event: string, timestamp: number): string {
    const signString = `channel=${channel}&event=${event}&time=${timestamp}`;

    try {
      const hmac = crypto.createHmac('sha512', this.credentials.secret);
      hmac.update(signString);
      return hmac.digest('hex');
    } catch (error) {
      this.logger.error('Failed to generate WebSocket signature', { error });
      throw new Error(`Failed to generate Gate.io WebSocket signature: ${error}`);
    }
  }

  /**
   * Get required headers for authenticated Gate.io API requests
   */
  getHeaders(
    method: string,
    requestPath: string,
    queryString: string = '',
    body: string = '',
    timestamp?: number
  ): Record<string, string> {
    const requestTimestamp = timestamp || Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(
      requestTimestamp,
      method,
      requestPath,
      queryString,
      body
    );

    return {
      'Content-Type': 'application/json',
      KEY: this.credentials.apiKey,
      SIGN: signature,
      Timestamp: requestTimestamp.toString(),
    };
  }

  /**
   * Get headers for public API endpoints
   */
  getPublicHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make authenticated request to Gate.io API
   */
  async makeRequest(
    endpoint: string,
    params: Record<string, unknown> = {},
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<any> {
    const timestamp = Math.floor(Date.now() / 1000);

    const queryString = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');

    const requestBody = body ? JSON.stringify(body) : '';

    const headers = this.getHeaders(method, endpoint, queryString, requestBody, timestamp);

    const url = queryString
      ? `${this.baseUrl}/api/v4${endpoint}?${queryString}`
      : `${this.baseUrl}/api/v4${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' ? requestBody || undefined : undefined,
      });

      return await this.handleResponse(response, endpoint);
    } catch (error) {
      this.logger.error('Request failed', { endpoint, method, error });
      throw new Error(`Gate.io API request failed: ${error}`);
    }
  }

  /**
   * Make public request to Gate.io API
   */
  async makePublicRequest(endpoint: string, params: Record<string, unknown> = {}): Promise<any> {
    const queryString = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');

    const url = queryString
      ? `${this.baseUrl}/api/v4${endpoint}?${queryString}`
      : `${this.baseUrl}/api/v4${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: this.getPublicHeaders(),
      });

      return await this.handleResponse(response, endpoint);
    } catch (error) {
      this.logger.error('Public request failed', { endpoint, error });
      throw new Error(`Gate.io public API request failed: ${error}`);
    }
  }

  /**
   * Handle API response and extract meaningful error messages
   */
  private async handleResponse(response: Response, endpoint: string): Promise<any> {
    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorData = JSON.parse(responseText);
        if (errorData.message) {
          errorMessage = `Gate.io API Error: ${errorData.message} (Label: ${errorData.label || 'Unknown'})`;
        }
      } catch {
        errorMessage = `HTTP ${response.status}: ${responseText.substring(0, 200)}`;
      }

      this.logger.error('Gate.io API request failed', {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        error: errorMessage,
      });

      throw new Error(errorMessage);
    }

    try {
      return JSON.parse(responseText);
    } catch (error) {
      this.logger.error('Failed to parse response JSON', {
        endpoint,
        responseText: responseText.substring(0, 200),
      });
      throw new Error(`Invalid JSON response from Gate.io API: ${error}`);
    }
  }

  /**
   * Validate that all required credentials are provided
   */
  private validateCredentials(): void {
    const missing: string[] = [];

    if (!this.credentials.apiKey) missing.push('apiKey');
    if (!this.credentials.secret) missing.push('secret');

    if (missing.length > 0) {
      throw new Error(`Missing required Gate.io credentials: ${missing.join(', ')}`);
    }
  }

  /**
   * Check if credentials are properly configured
   */
  validateCredentialsExist(): boolean {
    try {
      this.validateCredentials();
      return true;
    } catch {
      return false;
    }
  }
}
