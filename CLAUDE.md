# Channel 47 MCP Servers

Standalone MCP servers published independently. npm workspaces monorepo.

## Structure

```
bing-ads/        # Microsoft Advertising (Bing Ads) API (npm: @channel47/bing-ads-mcp)
dataforseo/      # DataForSEO keyword research API (npm: dataforseo-mcp-server)
google-ads/      # Google Ads API via GAQL (npm: @channel47/google-ads-mcp)
meta-ads/        # Meta Ads (Facebook/Instagram) API (npm: @channel47/meta-ads-mcp)
nano-banana/     # AI image generation via Gemini (PyPI: gemini-image-mcp)
substack/        # Substack newsletter scraping (local only)
```

## Commands

```bash
npm install          # from repo root
npm run build        # build all JS/TS servers
npm run test         # test all JS/TS servers
```

## Gotchas

- **npm workspaces** — run `npm install` from root, not from individual server dirs.
- **nano-banana is Python** — uses pyproject.toml, not package.json. Install with `pip install -e ".[dev]"`.
- **substack is Python** — standalone script, not packaged. Run with `python server.py`.
