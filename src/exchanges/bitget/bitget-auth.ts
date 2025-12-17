import crypto from 'crypto';
import {ExchangeCredentials} from '../../types';
import {createLogger} from '../../utils';

/**
 * Extended credentials for Bitget that includes passphrase
 */
export interface BitgetCredentials extends ExchangeCredentials {
  passphrase: string;
}

/**
 * Bitget Authentication and Request Handler
 * 
 * Handles API authentication, request signing, and HTTP requests to Bitget API.
 * Implements Bitget's HMAC-SHA256 signature generation with BASE64 encoding.
 * 
 * @see https://www.bitget.com/api-doc/common/signature
 */
export class BitgetAuth {
  private readonly credentials: BitgetCredentials;
  private readonly baseUrl: string;
  private logger = createLogger('bitget-auth');

  /**
   * Initialize Bitget authentication handler
   * 
   * @param credentials - Bitget API credentials including API key, secret, and passphrase
   * @param baseUrl - Base URL for Bitget API (defaults to production)
   */
  constructor(credentials: BitgetCredentials, baseUrl: string = 'https://api.bitget.com') {
    this.credentials = credentials;
    this.baseUrl = baseUrl;
    this.validateCredentials();
  }

  /**
   * Generate HMAC-SHA256 signature for Bitget API requests
   */
  generateSignature(
    timestamp: number,
    method: string,
    requestPath: string,
    queryString: string = '',
    body: string = ''
  ): string {
    const queryPart = queryString ? `?${queryString}` : '';
    const signatureString = `${timestamp}${method.toUpperCase()}${requestPath}${queryPart}${body}`;
    

    try {
      const hmac = crypto.createHmac('sha256', this.credentials.secret);
      hmac.update(signatureString);
      return hmac.digest('base64');
    } catch (error) {
      this.logger.error('Failed to generate signature', { error });
      throw new Error(`Failed to generate Bitget API signature: ${error}`);
    }
  }

  /**
   * Get required headers for authenticated Bitget API requests
   */
  getHeaders(
    method: string,
    requestPath: string,
    queryString: string = '',
    body: string = '',
    timestamp?: number
  ): Record<string, string> {
    const requestTimestamp = timestamp || Date.now();
    const signature = this.generateSignature(requestTimestamp, method, requestPath, queryString, body);
    
    return {
      'Content-Type': 'application/json',
      'ACCESS-KEY': this.credentials.apiKey,
      'ACCESS-SIGN': signature,
      'ACCESS-TIMESTAMP': requestTimestamp.toString(),
      'ACCESS-PASSPHRASE': this.credentials.passphrase
    };
  }

  /**
   * Get headers for public API endpoints
   */
  getPublicHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Make authenticated request to Bitget API
   */
  async makeRequest(
    endpoint: string,
    params: Record<string, unknown> = {},
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<any> {
    const timestamp = Date.now();
    
    const queryString = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    
    const requestBody = body ? JSON.stringify(body) : '';
    
    const headers = this.getHeaders(method, endpoint, queryString, requestBody, timestamp);
    
    const url = queryString 
      ? `${this.baseUrl}${endpoint}?${queryString}`
      : `${this.baseUrl}${endpoint}`;


    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' ? requestBody || undefined : undefined
      });

      return await this.handleResponse(response, endpoint);
    } catch (error) {
      this.logger.error('Request failed', { endpoint, method, error });
      throw new Error(`Bitget API request failed: ${error}`);
    }
  }

  /**
   * Make public request to Bitget API
   */
  async makePublicRequest(
    endpoint: string,
    params: Record<string, unknown> = {}
  ): Promise<any> {
    const queryString = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    
    const url = queryString 
      ? `${this.baseUrl}${endpoint}?${queryString}`
      : `${this.baseUrl}${endpoint}`;


    try {
      const response = await fetch(url, {
        headers: this.getPublicHeaders()
      });

      return await this.handleResponse(response, endpoint);
    } catch (error) {
      this.logger.error('Public request failed', { endpoint, error });
      throw new Error(`Bitget public API request failed: ${error}`);
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
        if (errorData.msg) {
          errorMessage = `Bitget API Error: ${errorData.msg} (Code: ${errorData.code || 'Unknown'})`;
        }
      } catch {
        errorMessage = `HTTP ${response.status}: ${responseText.substring(0, 200)}`;
      }
      
      this.logger.error('Bitget API request failed', {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        error: errorMessage
      });
      
      throw new Error(errorMessage);
    }

    try {
      const data = JSON.parse(responseText);
      
      if (data.code && data.code !== '00000') {
        const apiError = `Bitget API Error: ${data.msg || 'Unknown error'} (Code: ${data.code})`;
        this.logger.error('Bitget API returned error', {
          endpoint,
          code: data.code,
          message: data.msg,
          data: data.data
        });
        throw new Error(apiError);
      }
      
      return data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Bitget API Error')) {
        throw error;
      }
      
      this.logger.error('Failed to parse response JSON', { endpoint, responseText: responseText.substring(0, 200) });
      throw new Error(`Invalid JSON response from Bitget API: ${error}`);
    }
  }

  /**
   * Validate that all required credentials are provided
   */
  private validateCredentials(): void {
    const missing: string[] = [];
    
    if (!this.credentials.apiKey) missing.push('apiKey');
    if (!this.credentials.secret) missing.push('secret');
    if (!this.credentials.passphrase) missing.push('passphrase');
    
    if (missing.length > 0) {
      throw new Error(`Missing required Bitget credentials: ${missing.join(', ')}`);
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