# dataforseo-mcp-server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for the DataForSEO API. Keyword research, search volume, SERP data, backlink analysis, and more, accessible as Claude tools.

Part of [Channel 47](https://channel47.dev), the open-source ecosystem of profession plugins for Claude Code. [Get the newsletter](https://channel47.dev/subscribe) for weekly skill breakdowns from production use.

## What It Does

- **Keywords Data** — search volume, keyword suggestions for sites and seeds, Google Trends
- **SERP** — Google organic, maps, and other search engine results
- **Labs** — keyword ideas, related keywords, domain rank overview, competitor analysis
- **Backlinks** — profiles, referring domains, anchor text, historical data
- **OnPage** — website audit, content analysis, technical SEO checks
- **Content Analysis** — content quality evaluation and semantic analysis
- **AI Optimization** — LLM response data from ChatGPT, Claude, Gemini, Perplexity

## Installation

```bash
git clone https://github.com/channel47/mcps.git
cd mcps/dataforseo
npm install    # from mcps/ root (npm workspaces)
npm run build
```

## Configuration

| Variable | Required |
|----------|----------|
| `DATAFORSEO_LOGIN` | Yes |
| `DATAFORSEO_PASSWORD` | Yes |

Get credentials at [dataforseo.com](https://dataforseo.com).

## Tools

### Keywords Data

- `keywords_google_ads_search_volume` — search volume for keywords
- `keywords_google_ads_keywords_for_site` — keyword suggestions for a domain
- `keywords_google_ads_keywords_for_keyword` — keyword suggestions from seed keywords
- `keywords_google_trends_explore` — keyword trends over time

### SERP

- `serp_google_organic_live` — Google organic search results
- `serp_google_organic_task_post` — async Google organic search task
- `serp_google_maps_live` — Google Maps search results

### Labs

- `labs_google_keyword_ideas` — keyword ideas from seeds
- `labs_google_related_keywords` — related keywords
- `labs_google_domain_rank_overview` — domain ranking overview
- `labs_google_competitors_domain` — competitor domains

### Backlinks

- `backlinks_summary` — domain backlink profile summary
- `backlinks_backlinks` — backlinks list for a domain
- `backlinks_referring_domains` — referring domains
- `backlinks_history` — historical backlink data

### AI Optimization

- `ai_chatgpt_llm_responses_live` — ChatGPT responses
- `ai_claude_llm_responses_live` — Claude responses
- `ai_gemini_llm_responses_live` — Gemini responses
- `ai_keyword_data_search_volume_live` — AI keyword search volume

For the complete tool list, see the source in `src/api/`.

## Development

```bash
npm run build
npm run dev     # hot reloading
npm start
```

## Links

- [Channel 47](https://channel47.dev) — open-source profession plugins for Claude Code
- [Build Notes](https://channel47.dev/subscribe) — weekly skill breakdowns from production use
- [DataForSEO API Docs](https://docs.dataforseo.com)
- [X](https://x.com/ctrlswing) / [LinkedIn](https://www.linkedin.com/in/jackson-d-9979a7a0/) / [GitHub](https://github.com/channel47)

## Credits

Based on [Skobyn/dataforseo-mcp-server](https://github.com/Skobyn/dataforseo-mcp-server).

## License

MIT
