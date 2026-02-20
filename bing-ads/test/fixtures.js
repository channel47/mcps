import { deflateRawSync } from 'node:zlib';

export function buildSingleFileZip(filename, text) {
  const filenameBuffer = Buffer.from(filename, 'utf8');
  const uncompressed = Buffer.from(text, 'utf8');
  const compressed = deflateRawSync(uncompressed);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(0, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(uncompressed.length, 22);
  localHeader.writeUInt16LE(filenameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralDirectory = Buffer.alloc(46);
  centralDirectory.writeUInt32LE(0x02014b50, 0);
  centralDirectory.writeUInt16LE(20, 4);
  centralDirectory.writeUInt16LE(20, 6);
  centralDirectory.writeUInt16LE(0, 8);
  centralDirectory.writeUInt16LE(8, 10);
  centralDirectory.writeUInt16LE(0, 12);
  centralDirectory.writeUInt16LE(0, 14);
  centralDirectory.writeUInt32LE(0, 16);
  centralDirectory.writeUInt32LE(compressed.length, 20);
  centralDirectory.writeUInt32LE(uncompressed.length, 24);
  centralDirectory.writeUInt16LE(filenameBuffer.length, 28);
  centralDirectory.writeUInt16LE(0, 30);
  centralDirectory.writeUInt16LE(0, 32);
  centralDirectory.writeUInt16LE(0, 34);
  centralDirectory.writeUInt16LE(0, 36);
  centralDirectory.writeUInt32LE(0, 38);
  centralDirectory.writeUInt32LE(0, 42);

  const centralDirectoryOffset = localHeader.length + filenameBuffer.length + compressed.length;
  const centralDirectorySize = centralDirectory.length + filenameBuffer.length;

  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(1, 8);
  endOfCentralDirectory.writeUInt16LE(1, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectorySize, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([
    localHeader,
    filenameBuffer,
    compressed,
    centralDirectory,
    filenameBuffer,
    endOfCentralDirectory
  ]);
}

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
      EditorialStatus: 'Active',
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
      EditorialStatus: 'ActiveLimited',
      Headlines: [
        { Asset: { Text: 'Official Channel 47' }, EditorialStatus: 'Active' }
      ],
      Descriptions: [
        { Asset: { Text: 'Shop direct from Channel 47.' }, EditorialStatus: 'Disapproved' }
      ],
      FinalUrls: [
        'https://www.channel47.com'
      ]
    }
  ]
};

export const MOCK_EDITORIAL_REASONS_RESPONSE = {
  EditorialReasons: [
    {
      AdGroupId: 444444444,
      AdOrKeywordId: 666666666,
      AppealStatus: 'AppealPending',
      Reasons: [
        {
          Location: 'Ad Description',
          PublisherCountries: ['US', 'CA'],
          ReasonCode: 8,
          Term: 'unsubstantiated claim'
        }
      ]
    }
  ],
  PartialErrors: []
};

export const MOCK_PRODUCTS_RESPONSE = {
  resources: [
    {
      id: 'online:en:US:sku-1',
      offerId: 'sku-1',
      title: 'Blue Shirt',
      link: 'https://www.channel47.com/products/sku-1',
      price: { value: '19.99', currency: 'USD' },
      availability: 'in stock',
      brand: 'Channel47',
      imageLink: 'https://www.channel47.com/images/sku-1.jpg'
    }
  ],
  nextPageToken: 'next-page-token'
};

export const MOCK_STORES_RESPONSE = {
  BMCStores: [
    {
      Id: 12345,
      Name: 'Channel 47 Store',
      StoreUrl: 'https://www.channel47.com',
      IsActive: true,
      HasCatalog: true,
      IsProductAdsEnabled: true,
      SubType: null
    }
  ]
};

export const SAMPLE_REPORT_CSV = [
  'AccountName,CampaignName,CampaignId,Impressions,Clicks,Spend,Conversions',
  '"Channel 47","Search - Brand",333333333,1000,120,55.75,12',
  '"Channel 47","Shopping (US)",444444444,2000,180,78.11,20'
].join('\n');

// --- Mutation response fixtures ---

export const MOCK_CAMPAIGNS_ADD_RESPONSE = {
  CampaignIds: [777, null],
  PartialErrors: [
    {
      Code: 1030,
      Details: '',
      ErrorCode: 'CampaignServiceInvalidCampaignName',
      FieldPath: null,
      ForwardCompatibilityMap: null,
      Index: 1,
      Message: 'The campaign name is not valid.',
      Type: 'BatchError'
    }
  ]
};

export const MOCK_KEYWORDS_ADD_RESPONSE = {
  KeywordIds: [888, 999],
  PartialErrors: []
};

export const MOCK_UPDATE_RESPONSE = {
  PartialErrors: []
};

export const MOCK_DELETE_RESPONSE = {
  PartialErrors: []
};

export const MOCK_NEGATIVE_KW_RESPONSE = {
  NegativeKeywordIds: [
    { Ids: [111, 222] }
  ],
  NestedPartialErrors: []
};

export const MOCK_NEGATIVE_KW_PARTIAL_ERROR_RESPONSE = {
  NegativeKeywordIds: [
    { Ids: [111, null] }
  ],
  NestedPartialErrors: [
    {
      BatchErrors: [
        {
          Code: 4802,
          Details: '',
          ErrorCode: 'NegativeKeywordMatchTypeNotValid',
          FieldPath: null,
          ForwardCompatibilityMap: null,
          Index: 1,
          Message: 'The negative keyword match type is not valid.',
          Type: 'BatchError'
        }
      ],
      Code: 0,
      Details: '',
      ErrorCode: null,
      FieldPath: null,
      ForwardCompatibilityMap: null,
      Index: 0,
      Message: null,
      Type: 'BatchError'
    }
  ]
};

export const MOCK_PARTIAL_FAILURE_RESPONSE = {
  PartialErrors: [
    {
      Code: 1100,
      Details: '',
      ErrorCode: 'CampaignServiceInvalidBudget',
      FieldPath: null,
      ForwardCompatibilityMap: null,
      Index: 0,
      Message: 'The budget amount is not valid.',
      Type: 'BatchError'
    }
  ]
};
