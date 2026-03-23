# Media Buyer — Claude Code Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Query and manage Google Ads, Bing Ads, and Meta Ads accounts with Claude as your media buying copilot.

Part of [Channel 47](https://channel47.dev), the open-source ecosystem of profession plugins for Claude Code.

---

## Install

```bash
/plugin marketplace add channel47/mcps
/plugin install media-buyer
```

---

## Configuration

Set these environment variables in `.claude/settings.local.json` (recommended) or your shell profile:

### Google Ads

| Variable | Required |
|----------|----------|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Yes |
| `GOOGLE_ADS_CLIENT_ID` | Yes |
| `GOOGLE_ADS_CLIENT_SECRET` | Yes |
| `GOOGLE_ADS_REFRESH_TOKEN` | Yes |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | For MCC accounts |

### Bing Ads

| Variable | Required |
|----------|----------|
| `BING_ADS_DEVELOPER_TOKEN` | Yes |
| `BING_ADS_CLIENT_ID` | Yes |
| `BING_ADS_REFRESH_TOKEN` | Yes |
| `BING_ADS_CUSTOMER_ID` | Yes |
| `BING_ADS_ACCOUNT_ID` | Yes |

### Meta Ads

| Variable | Required |
|----------|----------|
| `META_ADS_ACCESS_TOKEN` | Yes |

All three MCP servers install automatically via `npx`. Configure one, two, or all three — the plugin adapts to whatever's available.

---

## What It Does

Ask Claude anything about your ad accounts. The plugin gives Claude direct API access to all three platforms plus domain knowledge for media buying analysis.

**Examples:**

- "Give me a morning brief on all my accounts."
- "Find where I'm wasting budget."
- "Review search terms and draft negatives."
- "Decode what my PMax campaign is actually doing."
- "Which keywords should I pause?"
- "How's my budget pacing this month?"
- "Compare performance across Google, Bing, and Meta."

---

## Safety

Every write operation follows dry-run-first protocol:

1. Query and analyze.
2. Preview mutations with `dry_run: true`.
3. Get explicit user approval.
4. Execute only after approval.

The `hooks/validate-mutations.py` hook enforces this for all mutation calls.

---

## Structure

```
media-buyer/
├── .claude-plugin/plugin.json
├── .mcp.json
├── hooks/
│   ├── hooks.json
│   └── validate-mutations.py
├── skills/
│   └── media-buyer/
│       ├── SKILL.md
│       └── references/
├── README.md
└── LICENSE
```

---

## Links

- [Channel 47](https://channel47.dev)
- [Build Notes](https://channel47.dev/subscribe)
- [MCP Servers](https://github.com/channel47/mcps)
- [X](https://x.com/ctrlswing) / [LinkedIn](https://www.linkedin.com/in/jackson-d-9979a7a0/) / [GitHub](https://github.com/channel47)

## License

MIT
