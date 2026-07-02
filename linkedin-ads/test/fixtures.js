export const MOCK_LIST_ACCOUNTS_RESPONSE = {
  elements: [
    {
      id: 512345678,
      name: 'Primary LinkedIn Account',
      status: 'ACTIVE',
      currency: 'USD',
      type: 'BUSINESS',
      test: false,
      reference: 'urn:li:organization:2414183',
      servingStatuses: ['RUNNABLE']
    },
    {
      id: 522333444,
      name: 'Canceled Account',
      status: 'CANCELED',
      currency: 'USD',
      type: 'BUSINESS',
      test: true,
      servingStatuses: ['STOPPED']
    }
  ]
};

export const MOCK_QUERY_CAMPAIGNS_PAGE_1 = {
  elements: [
    {
      id: 1001,
      name: 'Brand Awareness Q3',
      status: 'ACTIVE',
      campaignGroup: 'urn:li:sponsoredCampaignGroup:601',
      costType: 'CPM'
    },
    {
      id: 1002,
      name: 'Lead Gen Webinar',
      status: 'PAUSED',
      campaignGroup: 'urn:li:sponsoredCampaignGroup:601',
      costType: 'CPC'
    }
  ],
  metadata: {
    nextPageToken: 'token_page_2'
  }
};

export const MOCK_QUERY_CAMPAIGNS_PAGE_2 = {
  elements: [
    {
      id: 1003,
      name: 'Retargeting Always-On',
      status: 'ACTIVE',
      campaignGroup: 'urn:li:sponsoredCampaignGroup:602',
      costType: 'CPC'
    }
  ],
  metadata: {}
};

export const MOCK_CREATIVES_RESPONSE = {
  elements: [
    {
      id: 'urn:li:sponsoredCreative:301',
      campaign: 'urn:li:sponsoredCampaign:1001',
      intendedStatus: 'ACTIVE',
      isServing: true
    }
  ],
  metadata: {}
};

export const MOCK_ANALYTICS_RESPONSE = {
  elements: [
    {
      impressions: 10000,
      clicks: 332,
      costInLocalCurrency: '145.44',
      externalWebsiteConversions: 12,
      dateRange: {
        start: { year: 2026, month: 6, day: 1 },
        end: { year: 2026, month: 6, day: 1 }
      },
      pivotValues: ['urn:li:sponsoredCampaign:1001']
    }
  ]
};

export const MOCK_MUTATE_CREATE_RESPONSE = {
  restliId: '99887766'
};

export const MOCK_MUTATE_UPDATE_RESPONSE = {};
