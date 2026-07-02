# channel47 MCP Servers

Standalone MCP servers published independently. npm workspaces monorepo.

## Structure

```
bing-ads/        # Microsoft Advertising (Bing Ads) API (npm: @channel47/bing-ads-mcp)
google-ads/      # Google Ads API via GAQL (npm: @channel47/google-ads-mcp)
linkedin-ads/    # LinkedIn Marketing API (npm: @channel47/linkedin-ads-mcp)
meta-ads/        # Meta Ads (Facebook/Instagram) API (npm: @channel47/meta-ads-mcp)
pinterest-ads/   # Pinterest Ads API v5 (npm: @channel47/pinterest-ads-mcp)
tiktok-ads/      # TikTok for Business API (npm: @channel47/tiktok-ads-mcp)
```

## Commands

```bash
npm install          # from repo root
npm run build        # build all JS/TS servers
npm run test         # test all JS/TS servers
```

## Conventions

- Brand name is lowercase `channel47` everywhere (not `Channel 47` or `Channel47`).
- Each server can also run tests independently: `cd <server> && npm test`.

## Gotchas

- **npm workspaces** — run `npm install` from root, not from individual server dirs.
