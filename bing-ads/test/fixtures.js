export const MOCK_ACCOUNTS_RESPONSE = {
  AccountsInfo: [
    {
      Id: 111111111,
      Name: 'Primary Search Account',
      Number: 'F12345AB',
      AccountLifeCycleStatus: 'Active',
      PauseReason: null
    },
    {
      Id: 222222222,
      Name: 'Shopping Account',
      Number: 'F54321BA',
      AccountLifeCycleStatus: 'Paused',
      PauseReason: 3
    }
  ]
};

export const MOCK_CAMPAIGNS_RESPONSE = {
  Campaigns: [
    {
      Id: 333333333,
      Name: 'Search - Brand',
      Status: 'Active',
      CampaignType: 'Search',
      BudgetType: 'DailyBudgetStandard',
      DailyBudget: 150,
      BiddingScheme: {
        Type: 'EnhancedCpcBiddingScheme'
      }
    }
  ]
};

export const MOCK_AD_GROUPS_RESPONSE = {
  AdGroups: [
    {
      Id: 444444444,
      Name: 'Brand Exact',
      Status: 'Active',
      CampaignId: 333333333,
      CpcBid: {
        Amount: 1.5
      }
    }
  ]
};

export const MOCK_KEYWORDS_RESPONSE = {
  Keywords: [
    {
      Id: 555555555,
      Text: 'channel 47',
      MatchType: 'Exact',
      Status: 'Active',
      Bid: {
        Amount: 2.15
      }
    }
  ]
};

export const MOCK_ADS_RESPONSE = {
  Ads: [
    {
      Id: 666666666,
      Type: 'ResponsiveSearchAd',
      Status: 'Active',
      Headlines: [
        { Text: 'Official Channel 47' }
      ],
      Descriptions: [
        { Text: 'Shop direct from Channel 47.' }
      ],
      FinalUrls: [
        'https://www.channel47.com'
      ]
    }
  ]
};

export const SAMPLE_REPORT_CSV = [
  'AccountName,CampaignName,CampaignId,Impressions,Clicks,Spend,Conversions',
  '"Channel 47","Search - Brand",333333333,1000,120,55.75,12',
  '"Channel 47","Shopping (US)",444444444,2000,180,78.11,20'
].join('\n');
