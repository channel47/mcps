export const MOCK_OAUTH_ADVERTISERS_RESPONSE = {
  code: 0,
  message: 'OK',
  request_id: 'req-oauth-1',
  data: {
    list: [
      { advertiser_id: '7000000000000000001', advertiser_name: 'Primary TikTok Account' },
      { advertiser_id: '7000000000000000002', advertiser_name: 'Secondary TikTok Account' }
    ]
  }
};

export const MOCK_ADVERTISER_INFO_RESPONSE = {
  code: 0,
  message: 'OK',
  request_id: 'req-info-1',
  data: {
    list: [
      {
        advertiser_id: '7000000000000000001',
        name: 'Primary TikTok Account',
        status: 'STATUS_ENABLE',
        currency: 'USD',
        timezone: 'America/Los_Angeles',
        company: 'Channel47 LLC',
        country: 'US',
        create_time: 1700000000
      },
      {
        advertiser_id: '7000000000000000002',
        name: 'Secondary TikTok Account',
        status: 'STATUS_DISABLE',
        currency: 'USD',
        timezone: 'America/New_York',
        company: null,
        country: 'US',
        create_time: 1700000001
      }
    ]
  }
};

export const MOCK_QUERY_CAMPAIGNS_PAGE_1 = {
  code: 0,
  message: 'OK',
  request_id: 'req-campaign-1',
  data: {
    list: [
      {
        campaign_id: '1001',
        campaign_name: 'Brand Awareness',
        operation_status: 'ENABLE',
        objective_type: 'REACH'
      },
      {
        campaign_id: '1002',
        campaign_name: 'Conversions Prospecting',
        operation_status: 'DISABLE',
        objective_type: 'WEB_CONVERSIONS'
      }
    ],
    page_info: {
      page: 1,
      page_size: 2,
      total_number: 3,
      total_page: 2
    }
  }
};

export const MOCK_QUERY_CAMPAIGNS_PAGE_2 = {
  code: 0,
  message: 'OK',
  request_id: 'req-campaign-2',
  data: {
    list: [
      {
        campaign_id: '1003',
        campaign_name: 'Spark Ads Retargeting',
        operation_status: 'ENABLE',
        objective_type: 'TRAFFIC'
      }
    ],
    page_info: {
      page: 2,
      page_size: 2,
      total_number: 3,
      total_page: 2
    }
  }
};

export const MOCK_REPORT_RESPONSE = {
  code: 0,
  message: 'OK',
  request_id: 'req-report-1',
  data: {
    list: [
      {
        dimensions: {
          campaign_id: '1001',
          stat_time_day: '2026-06-30 00:00:00'
        },
        metrics: {
          spend: '145.44',
          impressions: '10000',
          clicks: '332',
          ctr: '3.32',
          conversion: '12'
        }
      }
    ],
    page_info: {
      page: 1,
      page_size: 100,
      total_number: 1,
      total_page: 1
    }
  }
};

export const MOCK_MUTATE_CREATE_CAMPAIGN_RESPONSE = {
  code: 0,
  message: 'OK',
  request_id: 'req-create-1',
  data: {
    campaign_id: '99887766'
  }
};

export const MOCK_MUTATE_UPDATE_RESPONSE = {
  code: 0,
  message: 'OK',
  request_id: 'req-update-1',
  data: {
    campaign_id: '9001'
  }
};

export const MOCK_MUTATE_STATUS_RESPONSE = {
  code: 0,
  message: 'OK',
  request_id: 'req-status-1',
  data: {
    campaign_ids: ['9002'],
    status: 'DELETE'
  }
};
