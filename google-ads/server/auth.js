#!/usr/bin/env node
import { GoogleAdsApi } from 'google-ads-api';

// Required environment variables for OAuth 2.0 authentication
const REQUIRED_ENV_VARS = [
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'GOOGLE_ADS_CLIENT_ID',
  'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_REFRESH_TOKEN',
];

/**
 * Validate all required environment variables are present
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);

  return {
    valid: missing.length === 0,
    missing
  };
}

let cachedClient = null;

/**
 * Initialize and return Google Ads API client
 * Caches client instance for reuse
 * @returns {GoogleAdsApi}
 * @throws {Error} If environment variables are missing or invalid
 */
export function initializeGoogleAdsClient() {
  if (cachedClient) {
    return cachedClient;
  }

  // Validate environment first
  const { valid, missing } = validateEnvironment();
  if (!valid) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please set these variables before starting the server.`
    );
  }

  // Initialize Google Ads client
  try {
    cachedClient = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });

    return cachedClient;
  } catch (error) {
    throw new Error(`Failed to initialize Google Ads client: ${error.message}`);
  }
}

/**
 * Get authenticated customer client for a specific account
 * @param {string} customerId - Google Ads account ID (without dashes)
 * @returns {Customer}
 */
export function getCustomerClient(customerId) {
  const client = initializeGoogleAdsClient();

  return client.Customer({
    customer_id: customerId,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  });
}
