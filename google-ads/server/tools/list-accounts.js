import { getCustomerClient } from '../auth.js';
import { formatSuccess, formatError } from '../utils/response-format.js';
import { buildQuery, TEMPLATES } from '../utils/gaql-templates.js';

/**
 * List all accessible Google Ads accounts
 * @param {Object} params
 * @param {boolean} [params.include_manager_accounts=false] - Include MCC accounts
 * @returns {Object} MCP response with account list
 */
export async function listAccounts(params = {}) {
  try {
    const includeManagers = params.include_manager_accounts || false;

    // Use login customer ID or default customer ID
    const customerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ||
                       process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;

    if (!customerId) {
      throw new Error(
        'Either GOOGLE_ADS_LOGIN_CUSTOMER_ID or GOOGLE_ADS_DEFAULT_CUSTOMER_ID must be set'
      );
    }

    // Get customer client
    const customer = getCustomerClient(customerId);

    // Build query with optional manager filter
    const filters = includeManagers ? '' : "WHERE customer_client.manager = false";
    const query = buildQuery(TEMPLATES.LIST_ACCOUNTS, { filters });

    // Execute query
    const results = await customer.query(query);

    // Format results
    const accounts = results.map(row => ({
      id: row.customer_client.id,
      name: row.customer_client.descriptive_name,
      is_manager: row.customer_client.manager,
      currency: row.customer_client.currency_code,
      timezone: row.customer_client.time_zone,
      status: row.customer_client.status
    }));

    const managerCount = accounts.filter(a => a.is_manager).length;
    const clientCount = accounts.length - managerCount;

    return formatSuccess({
      summary: `Found ${accounts.length} accessible account${accounts.length !== 1 ? 's' : ''} (${clientCount} client, ${managerCount} manager)`,
      data: accounts,
      metadata: {
        totalAccounts: accounts.length,
        clientAccounts: clientCount,
        managerAccounts: managerCount
      }
    });

  } catch (error) {
    return formatError(error);
  }
}
