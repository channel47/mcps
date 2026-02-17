# Substack MCP Server

A Model Context Protocol (MCP) server for scraping and analyzing Substack newsletters. Enables LLMs to fetch posts from any public Substack publication.

Part of [Channel 47](https://channel47.dev), the open-source ecosystem of profession plugins for Claude Code.

## Features

- **Get Posts**: Fetch recent or top posts from any Substack
- **Get Post Content**: Retrieve full text of individual posts
- **Search Posts**: Search within a newsletter
- **Batch Fetch**: Scrape multiple newsletters at once
- **Newsletter Info**: Get author and recommendation data

## Installation

```bash
pip install -r requirements.txt
```

Or manually:
```bash
pip install mcp substack-api pydantic httpx
```

## Usage

### Running the Server

```bash
python server.py
```

### MCP Client Configuration

For Claude Desktop or similar MCP clients, add to your config:

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

```python
{
  "publication_url": "lenny",  # or "https://lenny.substack.com"
  "limit": 20,
  "sorting": "top",  # or "new"
  "response_format": "markdown"  # or "json"
}
```

### substack_get_post_content
Get full content of a specific post (free posts only).

```python
{
  "post_url": "https://example.substack.com/p/post-slug",
  "response_format": "markdown"
}
```

### substack_search_posts
Search posts within a newsletter.

```python
{
  "publication_url": "stratechery",
  "query": "AI",
  "limit": 10
}
```

### substack_batch_get_posts
Fetch from multiple newsletters at once.

```python
{
  "publication_urls": ["lenny", "stratechery", "platformer"],
  "posts_per_publication": 5,
  "sorting": "top"
}
```

### substack_get_newsletter_info
Get newsletter metadata and recommendations.

```python
{
  "publication_url": "lenny"
}
```

## Limitations

- **Paywalled content**: Cannot access subscriber-only posts without authentication
- **Rate limiting**: Substack may rate-limit requests; includes 0.5s delays for batch operations
- **Unofficial API**: Uses reverse-engineered API that may change
- **Network restrictions**: Some environments (corporate proxies, certain cloud platforms) may block Substack API requests

## Links

- [Channel 47](https://channel47.dev) — open-source profession plugins for Claude Code
- [Build Notes Newsletter](https://channel47.dev/subscribe) — weekly skill breakdowns from production use

## Credits

Built on [substack-api](https://github.com/NHagar/substack_api) Python library.
