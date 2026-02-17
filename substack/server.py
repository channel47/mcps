#!/usr/bin/env python3
"""
Substack MCP Server

A Model Context Protocol server for scraping and analyzing Substack newsletters.
Enables LLMs to fetch posts from any Substack publication for content analysis,
pattern extraction, and research.

Uses the substack_api library for data collection.
Requires: pip install mcp substack-api pydantic httpx
"""

from typing import Optional, List, Dict, Any
from enum import Enum
import json
import re
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict
from mcp.server.fastmcp import FastMCP

# Initialize the MCP server
mcp = FastMCP("substack_mcp")


# ============================================================================
# Enums
# ============================================================================

class ResponseFormat(str, Enum):
    """Output format for tool responses."""
    MARKDOWN = "markdown"
    JSON = "json"


class PostSorting(str, Enum):
    """Sorting options for posts."""
    NEW = "new"
    TOP = "top"


# ============================================================================
# Pydantic Models for Input Validation
# ============================================================================

class GetPostsInput(BaseModel):
    """Input model for fetching posts from a Substack newsletter."""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra='forbid'
    )

    publication_subdomain: str = Field(
        ...,
        description="The Substack subdomain (e.g., 'lenny' for lenny.substack.com, or 'stratechery')",
        min_length=1,
        max_length=100
    )
    limit: int = Field(
        default=10,
        description="Number of posts to retrieve (max 100)",
        ge=1,
        le=100
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="Output format: 'markdown' for readable or 'json' for structured data"
    )

    @field_validator('publication_subdomain')
    @classmethod
    def normalize_subdomain(cls, v: str) -> str:
        """Normalize the subdomain - extract just the name."""
        v = v.strip().lower()
        # Remove https:// and http://
        v = re.sub(r'^https?://', '', v)
        # Remove .substack.com suffix
        v = re.sub(r'\.substack\.com.*$', '', v)
        # Remove www.
        v = re.sub(r'^www\.', '', v)
        return v


class GetPostContentInput(BaseModel):
    """Input model for fetching full content of a specific post."""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra='forbid'
    )

    publication_subdomain: str = Field(
        ...,
        description="The Substack subdomain (e.g., 'lenny')"
    )
    post_slug: str = Field(
        ...,
        description="The post slug (from the URL, e.g., 'how-to-get-lucky')",
        min_length=1,
        max_length=500
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="Output format: 'markdown' for readable or 'json' for structured data"
    )

    @field_validator('publication_subdomain')
    @classmethod
    def normalize_subdomain(cls, v: str) -> str:
        v = v.strip().lower()
        v = re.sub(r'^https?://', '', v)
        v = re.sub(r'\.substack\.com.*$', '', v)
        v = re.sub(r'^www\.', '', v)
        return v


class BatchGetPostsInput(BaseModel):
    """Input model for fetching posts from multiple newsletters."""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra='forbid'
    )

    publication_subdomains: List[str] = Field(
        ...,
        description="List of Substack subdomains to fetch from (e.g., ['lenny', 'stratechery'])",
        min_length=1,
        max_length=10
    )
    posts_per_publication: int = Field(
        default=10,
        description="Number of posts to fetch per publication",
        ge=1,
        le=50
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="Output format"
    )


class GetRecommendationsInput(BaseModel):
    """Input model for getting newsletter recommendations."""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra='forbid'
    )

    publication_subdomain: str = Field(
        ...,
        description="The Substack subdomain to get recommendations for"
    )

    @field_validator('publication_subdomain')
    @classmethod
    def normalize_subdomain(cls, v: str) -> str:
        v = v.strip().lower()
        v = re.sub(r'^https?://', '', v)
        v = re.sub(r'\.substack\.com.*$', '', v)
        v = re.sub(r'^www\.', '', v)
        return v


# ============================================================================
# Utility Functions
# ============================================================================

def _format_date(date_str: str) -> str:
    """Format a date string to human-readable format."""
    if not date_str:
        return "Unknown date"
    try:
        # Handle ISO format
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return dt.strftime('%B %d, %Y')
    except:
        try:
            # Try other common formats
            dt = datetime.strptime(date_str[:10], '%Y-%m-%d')
            return dt.strftime('%B %d, %Y')
        except:
            return date_str


def _clean_html(html: str) -> str:
    """Basic HTML to text conversion."""
    if not html:
        return ""
    # Remove script and style tags
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Convert common tags
    html = re.sub(r'<br\s*/?\s*>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<p[^>]*>', '\n\n', html, flags=re.IGNORECASE)
    html = re.sub(r'</p>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<h[1-6][^>]*>', '\n\n## ', html, flags=re.IGNORECASE)
    html = re.sub(r'</h[1-6]>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<li[^>]*>', '\n- ', html, flags=re.IGNORECASE)
    html = re.sub(r'<blockquote[^>]*>', '\n> ', html, flags=re.IGNORECASE)
    # Remove all remaining tags
    html = re.sub(r'<[^>]+>', '', html)
    # Decode HTML entities
    html = html.replace('&amp;', '&')
    html = html.replace('&lt;', '<')
    html = html.replace('&gt;', '>')
    html = html.replace('&quot;', '"')
    html = html.replace('&#39;', "'")
    html = html.replace('&nbsp;', ' ')
    # Clean up whitespace
    html = re.sub(r'\n\s*\n\s*\n', '\n\n', html)
    html = html.strip()
    return html


def _format_post_markdown(post: Dict[str, Any], include_content: bool = False) -> str:
    """Format a post as markdown."""
    lines = []

    title = post.get('title', 'Untitled')
    subtitle = post.get('subtitle', '')
    date = _format_date(post.get('post_date', ''))
    slug = post.get('slug', '')
    reactions = post.get('reactions', {})
    likes = reactions.get('❤', 0) if isinstance(reactions, dict) else 0
    comments = post.get('comment_count', 0)

    # Check for paywall
    is_paywalled = post.get('audience', '') == 'only_paid'

    lines.append(f"### {title}")
    if subtitle:
        lines.append(f"*{subtitle}*")

    stats = [f"📅 {date}"]
    if likes:
        stats.append(f"❤️ {likes}")
    if comments:
        stats.append(f"💬 {comments}")
    if is_paywalled:
        stats.append("🔒 Paywalled")
    lines.append(" | ".join(stats))

    if slug:
        lines.append(f"📝 Slug: `{slug}`")

    if include_content:
        content = post.get('body_html', '')
        if content:
            cleaned = _clean_html(content)
            # Truncate very long content
            if len(cleaned) > 8000:
                cleaned = cleaned[:8000] + "\n\n[... content truncated ...]"
            lines.append("")
            lines.append("**Content:**")
            lines.append(cleaned)

    return '\n'.join(lines)


def _handle_error(e: Exception) -> str:
    """Format error messages consistently."""
    error_msg = str(e)
    if "404" in error_msg or "not found" in error_msg.lower():
        return "Error: Publication not found. Check the subdomain is correct."
    if "403" in error_msg or "forbidden" in error_msg.lower():
        return "Error: Access forbidden. This content may be paywalled."
    if "rate" in error_msg.lower() or "429" in error_msg:
        return "Error: Rate limited. Wait a moment before trying again."
    if "timeout" in error_msg.lower():
        return "Error: Request timed out. Try again."
    return f"Error: {error_msg}"


# ============================================================================
# Tool Implementations
# ============================================================================

@mcp.tool(
    name="substack_get_posts",
    annotations={
        "title": "Get Substack Posts",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True
    }
)
async def substack_get_posts(params: GetPostsInput) -> str:
    """Fetch posts from a Substack newsletter.

    Retrieves post metadata (title, subtitle, date, engagement) from any public
    Substack publication. Returns most recent posts. Use substack_get_post_content
    to get the full text of specific posts.

    Args:
        params (GetPostsInput): Validated input parameters containing:
            - publication_subdomain (str): Subdomain like 'lenny' or 'stratechery'
            - limit (int): Number of posts to retrieve (1-100, default 10)
            - response_format (str): 'markdown' or 'json' (default 'markdown')

    Returns:
        str: Post listings with titles, dates, slugs, and engagement metrics

    Examples:
        - "Get top 20 posts from Lenny's Newsletter" -> publication_subdomain='lenny', limit=20
        - "Recent posts from Stratechery" -> publication_subdomain='stratechery', limit=10
    """
    try:
        from substack_api import Newsletter

        # Build full URL and create newsletter instance
        url = f"https://{params.publication_subdomain}.substack.com"
        newsletter = Newsletter(url)

        # Fetch posts - returns list of Post objects
        post_objects = newsletter.get_posts(limit=params.limit)

        if not post_objects:
            return f"No posts found for {params.publication_subdomain}"

        # Convert Post objects to dictionaries with metadata
        posts = []
        for post_obj in post_objects:
            try:
                meta = post_obj.get_metadata()
                meta['slug'] = post_obj.slug
                posts.append(meta)
            except Exception:
                # If metadata fetch fails, add minimal info
                posts.append({'slug': post_obj.slug, 'title': 'Unknown'})

        if params.response_format == ResponseFormat.MARKDOWN:
            lines = [
                f"# Posts from {params.publication_subdomain}.substack.com",
                f"Showing {len(posts)} posts (most recent first)",
                ""
            ]
            for post in posts:
                lines.append(_format_post_markdown(post))
                lines.append("")
            return '\n'.join(lines)
        else:
            result = {
                "publication": params.publication_subdomain,
                "url": f"https://{params.publication_subdomain}.substack.com",
                "count": len(posts),
                "posts": posts
            }
            return json.dumps(result, indent=2, default=str)

    except ImportError:
        return "Error: substack-api library not installed. Run: pip install substack-api"
    except Exception as e:
        return _handle_error(e)


@mcp.tool(
    name="substack_get_post_content",
    annotations={
        "title": "Get Full Post Content",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True
    }
)
async def substack_get_post_content(params: GetPostContentInput) -> str:
    """Fetch the full content of a specific Substack post.

    Retrieves the complete text content of a post by its slug. Use after
    substack_get_posts to identify interesting posts and get their slugs.

    Args:
        params (GetPostContentInput): Validated input containing:
            - publication_subdomain (str): Subdomain like 'lenny'
            - post_slug (str): The post slug from the URL
            - response_format (str): 'markdown' or 'json'

    Returns:
        str: Full post content with metadata

    Note: Paywalled content may return limited text without authentication.
    """
    try:
        from substack_api.post import Post

        # Build post URL and create Post instance
        url = f"https://{params.publication_subdomain}.substack.com/p/{params.post_slug}"
        post_obj = Post(url)

        # Get metadata and content
        post = post_obj.get_metadata()
        if not post:
            post = {}

        post['slug'] = params.post_slug

        # Get the full content
        try:
            content_html = post_obj.get_content()
            post['body_html'] = content_html
        except Exception:
            post['body_html'] = ''

        if params.response_format == ResponseFormat.MARKDOWN:
            lines = [
                f"# {post.get('title', 'Untitled')}",
            ]
            if post.get('subtitle'):
                lines.append(f"*{post.get('subtitle')}*")

            date = _format_date(post.get('post_date', ''))
            lines.append(f"📅 {date}")

            author = post.get('publishedBylines', [{}])
            if author and len(author) > 0:
                author_name = author[0].get('name', 'Unknown')
                lines.append(f"✍️ By {author_name}")

            if post.get('audience') == 'only_paid':
                lines.append("🔒 This is a paywalled post")

            lines.append("")

            content = post.get('body_html', '')
            if content:
                cleaned = _clean_html(content)
                lines.append(cleaned)
            else:
                lines.append("*No content available (may be paywalled)*")

            return '\n'.join(lines)
        else:
            # For JSON, include the cleaned content alongside raw
            post['content_text'] = _clean_html(post.get('body_html', ''))
            return json.dumps(post, indent=2, default=str)

    except ImportError:
        return "Error: substack-api library not installed. Run: pip install substack-api"
    except Exception as e:
        return _handle_error(e)


@mcp.tool(
    name="substack_batch_get_posts",
    annotations={
        "title": "Batch Get Posts from Multiple Newsletters",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": True
    }
)
async def substack_batch_get_posts(params: BatchGetPostsInput) -> str:
    """Fetch posts from multiple Substack newsletters in one call.

    Useful for competitive analysis or content research across multiple
    publications. Fetches posts from each publication sequentially with
    delays to avoid rate limiting.

    Args:
        params (BatchGetPostsInput): Validated input containing:
            - publication_subdomains (List[str]): List of subdomains (max 10)
            - posts_per_publication (int): Posts per newsletter (1-50)
            - response_format (str): 'markdown' or 'json'

    Returns:
        str: Aggregated posts from all publications

    Note: Be mindful of rate limits when fetching from many newsletters.
    """
    try:
        from substack_api import Newsletter
        from time import sleep

        all_results = []
        errors = []

        for subdomain in params.publication_subdomains:
            # Normalize subdomain
            subdomain = subdomain.strip().lower()
            subdomain = re.sub(r'^https?://', '', subdomain)
            subdomain = re.sub(r'\.substack\.com.*$', '', subdomain)

            try:
                url = f"https://{subdomain}.substack.com"
                newsletter = Newsletter(url)
                post_objects = newsletter.get_posts(limit=params.posts_per_publication)

                # Convert Post objects to dictionaries
                posts = []
                for post_obj in post_objects:
                    try:
                        meta = post_obj.get_metadata()
                        meta['slug'] = post_obj.slug
                        posts.append(meta)
                    except Exception:
                        posts.append({'slug': post_obj.slug, 'title': 'Unknown'})

                all_results.append({
                    "publication": subdomain,
                    "url": f"https://{subdomain}.substack.com",
                    "posts": posts
                })

                # Delay to avoid rate limiting
                sleep(0.5)

            except Exception as e:
                errors.append(f"{subdomain}: {str(e)}")

        if params.response_format == ResponseFormat.MARKDOWN:
            lines = [
                f"# Batch Results: {len(all_results)} Publications",
                f"Fetched up to {params.posts_per_publication} posts each",
                ""
            ]

            for result in all_results:
                lines.append(f"## {result['publication']}.substack.com")
                lines.append(f"Found {len(result['posts'])} posts")
                lines.append("")
                for post in result['posts']:
                    lines.append(_format_post_markdown(post))
                    lines.append("")
                lines.append("---")
                lines.append("")

            if errors:
                lines.append("### Errors")
                for error in errors:
                    lines.append(f"- {error}")

            return '\n'.join(lines)
        else:
            return json.dumps({
                "publications": all_results,
                "total_publications": len(all_results),
                "posts_per_publication": params.posts_per_publication,
                "errors": errors if errors else None
            }, indent=2, default=str)

    except ImportError:
        return "Error: substack-api library not installed. Run: pip install substack-api"
    except Exception as e:
        return _handle_error(e)


@mcp.tool(
    name="substack_get_recommendations",
    annotations={
        "title": "Get Newsletter Recommendations",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True
    }
)
async def substack_get_recommendations(params: GetRecommendationsInput) -> str:
    """Get recommended newsletters from a Substack publication.

    Retrieves the list of newsletters that a publication recommends.
    Useful for discovering related newsletters in a niche.

    Args:
        params (GetRecommendationsInput): Validated input containing:
            - publication_subdomain (str): Subdomain to get recommendations for

    Returns:
        str: List of recommended newsletters with titles and URLs
    """
    try:
        from substack_api import Newsletter

        url = f"https://{params.publication_subdomain}.substack.com"
        newsletter = Newsletter(url)
        recommendations = newsletter.get_recommendations()

        if not recommendations:
            return f"No recommendations found for {params.publication_subdomain}"

        lines = [
            f"# Recommended by {params.publication_subdomain}.substack.com",
            f"Found {len(recommendations)} recommendations",
            ""
        ]

        for rec in recommendations:
            # rec is a Newsletter object
            rec_url = rec.url if hasattr(rec, 'url') else ''
            # Extract name from URL
            title = rec_url.replace('https://', '').replace('.substack.com', '') if rec_url else 'Unknown'
            lines.append(f"- **{title}**")
            if rec_url:
                lines.append(f"  {rec_url}")

        return '\n'.join(lines)

    except ImportError:
        return "Error: substack-api library not installed. Run: pip install substack-api"
    except Exception as e:
        return _handle_error(e)


@mcp.tool(
    name="substack_list_categories",
    annotations={
        "title": "List Substack Categories",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False
    }
)
async def substack_list_categories() -> str:
    """List all available Substack newsletter categories.

    Returns the list of categories that Substack uses to organize newsletters.
    Useful for discovering newsletters in specific topic areas.

    Returns:
        str: List of categories with their IDs
    """
    try:
        from substack_api import list_all_categories

        categories = list_all_categories()

        if not categories:
            return "No categories found"

        lines = [
            "# Substack Categories",
            f"Found {len(categories)} categories",
            ""
        ]

        for name, cat_id in categories:
            lines.append(f"- **{name}** (ID: {cat_id})")

        return '\n'.join(lines)

    except ImportError:
        return "Error: substack-api library not installed. Run: pip install substack-api"
    except Exception as e:
        return _handle_error(e)


if __name__ == "__main__":
    mcp.run()
