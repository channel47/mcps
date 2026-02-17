# Channel 47 MCP Servers

Open-source MCP servers by [Channel 47](https://channel47.dev). Built from real workflows — paid ads, SEO, image generation, and content.

## Servers

| Server | Description | Language | Install |
|--------|-------------|----------|---------|
| [google-ads](./google-ads/) | Google Ads API via GAQL | Node.js | `npm i @channel47/google-ads-mcp` |
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

## License

MIT
