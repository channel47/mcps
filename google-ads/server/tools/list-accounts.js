import { getCustomerClient } from '../auth.js';
import { formatSuccess, formatError } from '../utils/response-format.js';
import { buildQuery, TEMPLATES } from '../utils/gaql-templates.js';

/**
 * List all accessible Google Ads accounts
 * @param {Object} params
 * @param {string} [params.login_customer_id] - MCC account ID to enumerate (overrides env var)
 * @param {boolean} [params.include_manager_accounts=false] - Include MCC accounts
 * @returns {Object} MCP response with account list
 */
export async function listAccounts(params = {}) {
  try {
    const includeManagers = params.include_manager_accounts || false;

    // Resolve MCC to enumerate. list_accounts always needs an MCC, so it also
    // falls back to the default customer ID.
    const loginCustomerId = params.login_customer_id ||
                            process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ||
                            process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;

    if (!loginCustomerId) {
      throw new Error(
        'Either login_customer_id parameter, GOOGLE_ADS_LOGIN_CUSTOMER_ID, or GOOGLE_ADS_DEFAULT_CUSTOMER_ID must be set'
      );
    }

    // The MCC is both the query target and the login customer
    const customer = getCustomerClient(loginCustomerId, loginCustomerId);

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
