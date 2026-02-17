# Bing Ads REST API Reference

## Base URLs (v13)

- Campaign Management: `https://campaign.api.bingads.microsoft.com/CampaignManagement/v13`
- Reporting: `https://reporting.api.bingads.microsoft.com/Reporting/v13`
- Customer Management: `https://clientcenter.api.bingads.microsoft.com/CustomerManagement/v13`

## OAuth Token Refresh

Token endpoint:

`POST https://login.microsoftonline.com/common/oauth2/v2.0/token`

Required fields:

- `client_id`
- `client_secret`
- `refresh_token`
- `grant_type=refresh_token`
- `scope=https://ads.microsoft.com/msads.manage offline_access`

## Required Headers

- `Authorization: Bearer <access_token>`
- `DeveloperToken: <BING_ADS_DEVELOPER_TOKEN>`
- `Content-Type: application/json`

Campaign Management and Reporting endpoints also use:

- `CustomerAccountId: <account_id>`
- `CustomerId: <customer_id>`

## Tool Endpoint Mapping

- `list_accounts` -> `POST /CustomerManagement/v13/AccountsInfo/Query`
- `query` campaigns -> `POST /CampaignManagement/v13/Campaigns/QueryByAccountId`
- `query` ad_groups -> `POST /CampaignManagement/v13/AdGroups/QueryByCampaignId`
- `query` keywords -> `POST /CampaignManagement/v13/Keywords/QueryByAdGroupId`
- `query` ads -> `POST /CampaignManagement/v13/Ads/QueryByAdGroupId`
- `report` submit -> `POST /Reporting/v13/GenerateReport/Submit`
- `report` poll -> `POST /Reporting/v13/GenerateReport/Poll`

