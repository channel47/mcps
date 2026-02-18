# Channel 47 MCP Servers

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Open-source MCP servers built from real workflows — paid ads, SEO, image generation, and content.

Part of [Channel 47](https://channel47.dev), the open-source ecosystem of profession plugins for Claude Code. [Get the newsletter](https://channel47.dev/subscribe) for weekly skill breakdowns from production use.

## Servers

| Server | Description | Language | Install |
|--------|-------------|----------|---------|
| [google-ads](./google-ads/) | Google Ads API via GAQL | Node.js | `npm i @channel47/google-ads-mcp` |
| [bing-ads](./bing-ads/) | Microsoft Advertising campaigns, reporting, and mutations | Node.js | `npm i -g @channel47/bing-ads-mcp` |
| [dataforseo](./dataforseo/) | DataForSEO keyword research API | TypeScript | `npm i dataforseo-mcp-server` |
| [nano-banana](./nano-banana/) | AI image generation (Google Gemini) | Python | `pip install gemini-image-mcp` |
| [substack](./substack/) | Substack newsletter scraping | Python | Local only |

Each server has its own README with setup instructions and API details.

## Development

```bash
npm install
npm run build
npm test
```

## Links

- [Channel 47](https://channel47.dev) — open-source profession plugins for Claude Code
- [Build Notes](https://channel47.dev/subscribe) — weekly skill breakdowns from production use
- [X](https://x.com/ctrlswing) / [LinkedIn](https://www.linkedin.com/in/jackson-d-9979a7a0/) / [GitHub](https://github.com/channel47)

## License

MIT
