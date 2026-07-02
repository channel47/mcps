export const MOCK_LIST_ACCOUNTS_PAGE_1 = {
  items: [
    {
      id: '549755885175',
      name: 'Primary Pinterest Account',
      currency: 'USD',
      country: 'US',
      owner: {
        id: '2680059080000',
        username: 'channel47'
      },
      time_zone: 'America/Los_Angeles',
      permissions: ['OWNER']
    }
  ],
  bookmark: 'account_cursor_2'
};

export const MOCK_LIST_ACCOUNTS_PAGE_2 = {
  items: [
    {
      id: '549755885288',
      name: 'Shared Client Account',
      currency: 'EUR',
      country: 'DE',
      owner: {
        id: '2680059089999',
        username: 'client-team'
      },
      time_zone: 'Europe/Berlin',
      permissions: ['ANALYST']
    }
  ],
  bookmark: null
};

export const MOCK_QUERY_CAMPAIGNS_PAGE_1 = {
  items: [
    {
      id: '626735565838',
      ad_account_id: '549755885175',
      name: 'Summer Launch',
      status: 'ACTIVE',
      objective_type: 'WEB_CONVERSION'
    },
    {
      id: '626735565839',
      ad_account_id: '549755885175',
      name: 'Brand Awareness',
      status: 'PAUSED',
      objective_type: 'AWARENESS'
    }
  ],
  bookmark: 'campaign_cursor_2'
};

export const MOCK_QUERY_CAMPAIGNS_PAGE_2 = {
  items: [
    {
      id: '626735565840',
      ad_account_id: '549755885175',
      name: 'Catalog Retargeting',
      status: 'ACTIVE',
      objective_type: 'CATALOG_SALES'
    }
  ],
  bookmark: null
};

export const MOCK_ANALYTICS_RESPONSE = [
  {
    AD_ACCOUNT_ID: '549755885175',
    DATE: '2026-06-01',
    SPEND_IN_DOLLAR: 145.44,
    IMPRESSION_2: 10000,
    CLICKTHROUGH_2: 332,
    CTR_2: 0.0332,
    TOTAL_CONVERSIONS: 12
  }
];

export const MOCK_MUTATE_CREATE_RESPONSE = {
  items: [
    {
      data: {
        id: '626744128982',
        name: 'Campaign A',
        status: 'PAUSED'
      },
      exceptions: []
    }
  ]
};

export const MOCK_MUTATE_UPDATE_RESPONSE = {
  items: [
    {
      data: {
        id: '626735565838',
        status: 'PAUSED'
      },
      exceptions: []
    }
  ]
};

export const MOCK_MUTATE_EXCEPTION_RESPONSE = {
  items: [
    {
      data: null,
      exceptions: [
        {
          code: 2384,
          message: 'Invalid objective type for this campaign'
        }
      ]
    }
  ]
};
