# Substack MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for scraping and analyzing Substack newsletters. Fetch posts, search content, and pull newsletter metadata from any public publication.

Part of [Channel 47](https://channel47.dev), the open-source ecosystem of profession plugins for Claude Code. [Get the newsletter](https://channel47.dev/subscribe) for weekly skill breakdowns from production use.

## What It Does

- **Get posts** — fetch recent or top posts from any Substack
- **Get post content** — retrieve full text of individual posts (free posts only)
- **Search posts** — search within a newsletter
- **Batch fetch** — scrape multiple newsletters at once
- **Newsletter info** — author and recommendation data

## Installation

```bash
pip install mcp substack-api pydantic httpx
```

Or:

```bash
pip install -r requirements.txt
```

## Configuration

No API keys required. Works with any public Substack publication.

### MCP Client Configuration

```json
{
  "mcpServers": {
    "substack": {
      "command": "python",
      "args": ["/path/to/server.py"]
    }
  }
}
```

## Tools

### substack_get_posts

Fetch posts from a newsletter.

```json
{
  "publication_url": "lenny",
  "limit": 20,
  "sorting": "top",
  "response_format": "markdown"
}
```

### substack_get_post_content

Get full content of a specific post (free posts only).

```json
{
  "post_url": "https://example.substack.com/p/post-slug",
  "response_format": "markdown"
}
```

### substack_search_posts

Search posts within a newsletter.

```json
{
  "publication_url": "stratechery",
  "query": "AI",
  "limit": 10
}
```

### substack_batch_get_posts

Fetch from multiple newsletters at once.

```json
{
  "publication_urls": ["lenny", "stratechery", "platformer"],
  "posts_per_publication": 5,
  "sorting": "top"
}
```

### substack_get_newsletter_info

Get newsletter metadata and recommendations.

```json
{
  "publication_url": "lenny"
}
```

## Limitations

- **Paywalled content** — cannot access subscriber-only posts without authentication
- **Rate limiting** — Substack may rate-limit requests; includes 0.5s delays for batch operations
- **Unofficial API** — uses reverse-engineered API that may change

## Development

```bash
git clone https://github.com/channel47/mcps.git
cd mcps/substack
pip install -r requirements.txt
python server.py
```

## Links

- [Channel 47](https://channel47.dev) — open-source profession plugins for Claude Code
- [Build Notes](https://channel47.dev/subscribe) — weekly skill breakdowns from production use
- [X](https://x.com/ctrlswing) / [LinkedIn](https://www.linkedin.com/in/jackson-d-9979a7a0/) / [GitHub](https://github.com/channel47)

## Credits

Built on [substack-api](https://github.com/NHagar/substack_api).

## License

MIT
