# channel47 MCP Servers

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Open-source MCP servers built from real paid media workflows.

Part of [channel47](https://channel47.dev), agentic marketing systems marketers can run. Pair these connectors with the standalone [`channel47/skills`](https://github.com/channel47/skills) repo for media buying and creative strategy workflows.

## Servers

| Server | Description | Language | Install |
|--------|-------------|----------|---------|
| [google-ads](./google-ads/) | Google Ads API via GAQL | Node.js | `npm i @channel47/google-ads-mcp` |
| [bing-ads](./bing-ads/) | Microsoft Advertising campaigns, reporting, and mutations | Node.js | `npm i -g @channel47/bing-ads-mcp` |
| [meta-ads](./meta-ads/) | Meta (Facebook/Instagram) Ads API | Node.js | `npm i @channel47/meta-ads-mcp` |

Each server has its own README with setup instructions and API details.

## Development

```bash
npm install
npm run build
npm test
```

## Links

- [channel47](https://channel47.dev) — agentic marketing systems marketers can run
- [Skills](https://github.com/channel47/skills) — standalone marketing skills
- [Build Notes](https://channel47.dev/subscribe) — weekly build breakdowns
- [X](https://x.com/ctrlswing) / [LinkedIn](https://www.linkedin.com/in/jackson-d-9979a7a0/) / [GitHub](https://github.com/channel47)

## License

MIT
