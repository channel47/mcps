/**
 * Test fixtures for Google Ads MCP Server
 * Contains mock API responses and test data
 */

// ============================================
// Campaign Performance Fixtures
// ============================================

export const MOCK_CAMPAIGNS = [
  {
    campaign: {
      id: '123456789',
      name: 'Brand Campaign',
      status: 'ENABLED',
      advertising_channel_type: 'SEARCH'
    },
    metrics: {
      cost_micros: 150000000, // $150
      clicks: 500,
      impressions: 10000,
      conversions: 25,
      conversions_value: 2500,
      ctr: 0.05,
      average_cpc: 300000,
      search_impression_share: 0.75,
      search_top_impression_share: 0.60
    }
  },
  {
    campaign: {
      id: '987654321',
      name: 'Generic Campaign',
      status: 'ENABLED',
      advertising_channel_type: 'SEARCH'
    },
    metrics: {
      cost_micros: 250000000, // $250
      clicks: 800,
      impressions: 20000,
      conversions: 10,
      conversions_value: 1000,
      ctr: 0.04,
      average_cpc: 312500,
      search_impression_share: 0.50,
      search_top_impression_share: 0.35
    }
  },
  {
    campaign: {
      id: '111222333',
      name: 'Shopping Campaign',
      status: 'ENABLED',
      advertising_channel_type: 'SHOPPING'
    },
    metrics: {
      cost_micros: 100000000, // $100
      clicks: 300,
      impressions: 15000,
      conversions: 15,
      conversions_value: 3000,
      ctr: 0.02,
      average_cpc: 333333
    }
  }
];

export const MOCK_PAUSED_CAMPAIGN = {
  campaign: {
    id: '444555666',
    name: 'Paused Campaign',
    status: 'PAUSED',
    advertising_channel_type: 'SEARCH'
  },
  metrics: {
    cost_micros: 0,
    clicks: 0,
    impressions: 0,
    conversions: 0,
    conversions_value: 0
  }
};

// ============================================
// Search Terms Fixtures
// ============================================

export const MOCK_SEARCH_TERMS = [
  {
    search_term_view: {
      search_term: 'buy running shoes online',
      status: 'ADDED'
    },
    campaign: { id: '123456789', name: 'Brand Campaign' },
    ad_group: { id: '111', name: 'Running Shoes' },
    metrics: {
      cost_micros: 50000000,
      clicks: 150,
      impressions: 3000,
      conversions: 10,
      conversions_value: 1000,
      ctr: 0.05
    }
  },
  {
    search_term_view: {
      search_term: 'free running shoes',
      status: 'NONE'
    },
    campaign: { id: '123456789', name: 'Brand Campaign' },
    ad_group: { id: '111', name: 'Running Shoes' },
    metrics: {
      cost_micros: 25000000,
      clicks: 100,
      impressions: 2000,
      conversions: 0,
      conversions_value: 0,
      ctr: 0.05
    }
  },
  {
    search_term_view: {
      search_term: 'cheap sneakers',
      status: 'NONE'
    },
    campaign: { id: '123456789', name: 'Brand Campaign' },
    ad_group: { id: '111', name: 'Running Shoes' },
    metrics: {
      cost_micros: 75000000,
      clicks: 200,
      impressions: 5000,
      conversions: 0,
      conversions_value: 0,
      ctr: 0.04
    }
  }
];

// ============================================
// Customer/Account Fixtures
// ============================================

export const MOCK_ACCOUNTS = [
  {
    customer_client: {
      id: '1234567890',
      descriptive_name: 'Main Account',
      manager: false,
      currency_code: 'USD',
      time_zone: 'America/New_York',
      status: 'ENABLED'
    }
  },
  {
    customer_client: {
      id: '0987654321',
      descriptive_name: 'Secondary Account',
      manager: false,
      currency_code: 'USD',
      time_zone: 'America/Los_Angeles',
      status: 'ENABLED'
    }
  },
  {
    customer_client: {
      id: '1111111111',
      descriptive_name: 'MCC Account',
      manager: true,
      currency_code: 'USD',
      time_zone: 'America/Chicago',
      status: 'ENABLED'
    }
  }
];

// ============================================
// Quality Score Fixtures
// ============================================

export const MOCK_QUALITY_SCORES = [
  {
    ad_group_criterion: {
      criterion_id: '1001',
      keyword: { text: 'running shoes', match_type: 'PHRASE' },
      quality_info: {
        quality_score: 7,
        search_predicted_ctr: 'ABOVE_AVERAGE',
        creative_quality_score: 'AVERAGE',
        post_click_quality_score: 'ABOVE_AVERAGE'
      }
    },
    ad_group: { id: '111', name: 'Running Shoes' },
    campaign: { id: '123456789', name: 'Brand Campaign' },
    metrics: {
      impressions: 5000,
      clicks: 250,
      cost_micros: 75000000,
      conversions: 12
    }
  },
  {
    ad_group_criterion: {
      criterion_id: '1002',
      keyword: { text: 'cheap sneakers', match_type: 'BROAD' },
      quality_info: {
        quality_score: 4,
        search_predicted_ctr: 'BELOW_AVERAGE',
        creative_quality_score: 'BELOW_AVERAGE',
        post_click_quality_score: 'AVERAGE'
      }
    },
    ad_group: { id: '112', name: 'Sneakers Generic' },
    campaign: { id: '987654321', name: 'Generic Campaign' },
    metrics: {
      impressions: 8000,
      clicks: 160,
      cost_micros: 100000000,
      conversions: 2
    }
  }
];

// ============================================
// Budget/Pacing Fixtures
// ============================================

export const MOCK_BUDGET_DATA = [
  {
    campaign: {
      id: '123456789',
      name: 'Brand Campaign',
      status: 'ENABLED',
      advertising_channel_type: 'SEARCH'
    },
    campaign_budget: {
      id: 'budget_1',
      name: 'Brand Budget',
      amount_micros: 100000000, // $100/day
      explicitly_shared: false,
      has_recommended_budget: true,
      recommended_budget_amount_micros: 150000000,
      period: 'DAILY'
    },
    metrics: {
      cost_micros: 450000000, // $450 MTD
      impressions: 25000,
      clicks: 1250,
      conversions: 50
    }
  },
  {
    campaign: {
      id: '987654321',
      name: 'Generic Campaign',
      status: 'ENABLED',
      advertising_channel_type: 'SEARCH'
    },
    campaign_budget: {
      id: 'budget_2',
      name: 'Generic Budget',
      amount_micros: 50000000, // $50/day
      explicitly_shared: true,
      has_recommended_budget: false,
      period: 'DAILY'
    },
    metrics: {
      cost_micros: 200000000, // $200 MTD
      impressions: 10000,
      clicks: 400,
      conversions: 8
    }
  }
];

// ============================================
// Shopping Product Fixtures
// ============================================

export const MOCK_SHOPPING_PRODUCTS = [
  {
    shopping_product: {
      item_id: 'SKU-001',
      title: 'Running Shoes - Blue',
      brand: 'Nike',
      channel: 'ONLINE',
      language_code: 'en',
      feed_label: 'US',
      status: 'ELIGIBLE',
      price_micros: 99990000,
      currency_code: 'USD',
      merchant_center_id: '123456',
      issues: []
    },
    campaign: { id: '111222333', name: 'Shopping Campaign' }
  },
  {
    shopping_product: {
      item_id: 'SKU-002',
      title: 'Running Shoes - Red',
      brand: 'Adidas',
      channel: 'ONLINE',
      language_code: 'en',
      feed_label: 'US',
      status: 'NOT_ELIGIBLE',
      price_micros: 89990000,
      currency_code: 'USD',
      merchant_center_id: '123456',
      issues: [
        {
          type: 'MISSING_GTIN',
          severity: 'ERROR',
          description: 'Missing GTIN',
          detail: 'Product is missing a valid GTIN identifier'
        }
      ]
    },
    campaign: { id: '111222333', name: 'Shopping Campaign' }
  }
];

// ============================================
// Performance by Dimension Fixtures
// ============================================

export const MOCK_HOUR_OF_DAY = Array.from({ length: 24 }, (_, hour) => ({
  segments: { hour },
  metrics: {
    cost_micros: Math.floor(Math.random() * 20000000) + 5000000,
    clicks: Math.floor(Math.random() * 100) + 10,
    impressions: Math.floor(Math.random() * 2000) + 200,
    conversions: Math.random() > 0.5 ? Math.floor(Math.random() * 5) : 0,
    conversions_value: Math.floor(Math.random() * 500),
    ctr: Math.random() * 0.05 + 0.01,
    average_cpc: Math.floor(Math.random() * 500000) + 100000
  }
}));

export const MOCK_DEVICE_PERFORMANCE = [
  {
    segments: { device: 'MOBILE' },
    metrics: {
      cost_micros: 120000000,
      clicks: 400,
      impressions: 12000,
      conversions: 15,
      conversions_value: 1500,
      ctr: 0.033,
      average_cpc: 300000
    }
  },
  {
    segments: { device: 'DESKTOP' },
    metrics: {
      cost_micros: 180000000,
      clicks: 350,
      impressions: 8000,
      conversions: 25,
      conversions_value: 3500,
      ctr: 0.044,
      average_cpc: 514000
    }
  },
  {
    segments: { device: 'TABLET' },
    metrics: {
      cost_micros: 30000000,
      clicks: 80,
      impressions: 2000,
      conversions: 3,
      conversions_value: 300,
      ctr: 0.04,
      average_cpc: 375000
    }
  }
];

// ============================================
// Error Response Fixtures
// ============================================

export const MOCK_API_ERRORS = {
  authError: {
    code: 'AUTHENTICATION_ERROR',
    message: 'Invalid credentials',
    details: 'The refresh token has expired'
  },
  rateLimitError: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests',
    details: 'API quota exceeded for the day'
  },
  notFoundError: {
    code: 'NOT_FOUND',
    message: 'Resource not found',
    details: 'Campaign with ID 999 does not exist'
  },
  invalidQueryError: {
    code: 'QUERY_ERROR',
    message: 'Invalid GAQL query',
    details: 'Syntax error near "SELCT"'
  }
};

// ============================================
// Mock Customer Client Factory
// ============================================

/**
 * Create a mock customer client for testing
 * @param {Object} options - Mock configuration
 * @param {Array} [options.queryResults] - Results to return from query()
 * @param {Error} [options.queryError] - Error to throw from query()
 * @returns {Object} Mock customer client
 */
export function createMockCustomer(options = {}) {
  return {
    query: async (query) => {
      if (options.queryError) {
        throw options.queryError;
      }
      return options.queryResults || [];
    },
    mutate: async (operations) => {
      if (options.mutateError) {
        throw options.mutateError;
      }
      return options.mutateResults || { results: [] };
    }
  };
}

/**
 * Create a mock Google Ads API client
 * @param {Object} mockCustomer - Mock customer to return
 * @returns {Object} Mock API client
 */
export function createMockGoogleAdsClient(mockCustomer) {
  return {
    Customer: () => mockCustomer
  };
}
