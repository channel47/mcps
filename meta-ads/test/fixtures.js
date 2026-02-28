export const MOCK_LIST_ACCOUNTS_RESPONSE = {
  data: [
    {
      id: 'act_1234567890',
      name: 'Primary Meta Account',
      account_status: 1,
      currency: 'USD',
      timezone_name: 'America/Los_Angeles',
      business: {
        name: 'Channel47 LLC'
      }
    },
    {
      id: 'act_222333444',
      name: 'Disabled Account',
      account_status: 2,
      currency: 'USD',
      timezone_name: 'America/New_York',
      business: null
    }
  ]
};

export const MOCK_QUERY_CAMPAIGNS_PAGE_1 = {
  data: [
    {
      id: '1001',
      name: 'Brand Search',
      status: 'ACTIVE'
    },
    {
      id: '1002',
      name: 'Non-Brand Search',
      status: 'PAUSED'
    }
  ],
  paging: {
    cursors: {
      after: 'cursor_page_2'
    }
  }
};

export const MOCK_QUERY_CAMPAIGNS_PAGE_2 = {
  data: [
    {
      id: '1003',
      name: 'Shopping Prospecting',
      status: 'ACTIVE'
    }
  ],
  paging: {
    cursors: {}
  }
};

export const MOCK_INSIGHTS_RESPONSE = {
  data: [
    {
      spend: '145.44',
      impressions: '10000',
      clicks: '332',
      ctr: '3.32'
    }
  ]
};

export const MOCK_MUTATE_CREATE_RESPONSE = {
  id: '99887766'
};

export const MOCK_MUTATE_UPDATE_RESPONSE = {
  success: true
};

export const MOCK_MUTATE_DELETE_RESPONSE = {
  success: true
};
