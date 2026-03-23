#!/usr/bin/env python3
"""
PreToolUse hook: Flag live mutations before execution.

Handles two execution paths:
1. MCP tool calls (mcp__google-ads__mutate) — checks dry_run parameter.
2. Bash tool calls — detects mutation script functions called with dry_run=False.

Queries and dry-run mutations pass through silently.
"""
import json
import re
import sys

# Mutation functions from scripts/google/mutate.py
_MUTATION_FUNCTIONS = re.compile(
    r"(execute_mutation|add_negative_keywords|pause_entities"
    r"|create_campaign|create_rsa|update_bids)"
)
_LIVE_FLAG = re.compile(r"dry_run\s*=\s*False")


def main():
    input_data = json.load(sys.stdin)
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Path 1: MCP mutation tools
    if "mutate" in tool_name.lower():
        if not tool_input.get("dry_run", True):
            print(json.dumps({
                "decision": "allow",
                "message": "LIVE MUTATION: dry_run=false. Changes will be permanent."
            }))
            return
        print(json.dumps({"decision": "allow"}))
        return

    # Path 2: Bash calls executing mutation scripts with dry_run=False
    if tool_name == "Bash":
        command = tool_input.get("command", "")
        if _MUTATION_FUNCTIONS.search(command) and _LIVE_FLAG.search(command):
            print(json.dumps({
                "decision": "allow",
                "message": "LIVE MUTATION via script: dry_run=False detected. Changes will be permanent."
            }))
            return

    # Everything else passes through
    print(json.dumps({"decision": "allow"}))


if __name__ == "__main__":
    main()
