# MCP Server Integrations

vibecosystem extends its capabilities through MCP (Model Context Protocol) servers. These provide specialized tools that all 137 agents can leverage.

## Active MCP Servers

### 1. Notion MCP

**Purpose:** Project management, knowledge base, team collaboration
**Package:** `@notionhq/notion-mcp-server`

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\":\"Bearer <NOTION_API_KEY>\",\"Notion-Version\":\"2022-06-28\"}"
      }
    }
  }
}
```

### 2. browser-use

**Purpose:** AI browser automation - navigate, interact, extract, verify
**Package:** `browser-use` (Python/uvx)
**Used by:** browser-agent, e2e-runner, oracle, shipper, qa-engineer

```json
{
  "mcpServers": {
    "browser-use": {
      "command": "uvx",
      "args": ["browser-use", "--mcp"]
    }
  }
}
```

**Setup:**
```bash
# Requires Python 3.11+ and uv
pip install uv
# browser-use will be auto-installed on first run via uvx
```

**Tools provided:**
- `browser_navigate` - Go to URL
- `browser_click` - Click elements
- `browser_type` - Fill inputs
- `browser_screenshot` - Capture pages
- `browser_extract` - Extract content
- `browser_wait` - Wait for conditions
- `browser_evaluate` - Run JavaScript
- `browser_scroll` - Scroll pages

### 3. codebase-memory-mcp

**Purpose:** Persistent code knowledge graph - 64 language support, sub-millisecond queries, 120x token savings
**Binary:** Go binary (platform-specific)
**Used by:** ALL agents (automatic via MCP)

```json
{
  "mcpServers": {
    "codebase-memory": {
      "command": "/usr/local/bin/codebase-memory-mcp",
      "args": ["--project-dir", "."]
    }
  }
}
```

**Setup:**
```bash
# macOS (Apple Silicon)
curl -L -o /usr/local/bin/codebase-memory-mcp \
  https://github.com/DeusData/codebase-memory-mcp/releases/latest/download/codebase-memory-mcp-darwin-arm64
chmod +x /usr/local/bin/codebase-memory-mcp

# macOS (Intel)
curl -L -o /usr/local/bin/codebase-memory-mcp \
  https://github.com/DeusData/codebase-memory-mcp/releases/latest/download/codebase-memory-mcp-darwin-amd64
chmod +x /usr/local/bin/codebase-memory-mcp

# First run indexes the codebase (stored in SQLite, persistent)
```

**Tools provided (14):**
- `search_graph` - Semantic code search across entire codebase
- `query_graph` - Query relationships between code entities
- `trace_call_path` - Trace function call chains
- `detect_changes` - Detect code changes since last index
- `get_architecture` - Get high-level architecture overview
- `manage_adr` - Architecture Decision Records management
- `get_code_snippet` - Get code with context
- `find_references` - Find all references to a symbol
- `get_dependencies` - Get dependency graph for a file/function
- `get_metrics` - Code complexity and quality metrics
- `search_by_pattern` - Pattern-based code search
- `get_file_summary` - Summarize a file's purpose and contents
- `get_project_overview` - Full project structure overview
- `reindex` - Re-index after code changes

**Comparison with tldr CLI:**

| Feature | tldr | codebase-memory-mcp |
|---------|------|-------------------|
| Languages | 4 (Python, TS, Go, Rust) | 64 |
| Persistence | None (re-analyzes each time) | SQLite (sub-ms queries) |
| Scope | Flow analysis, AST | Knowledge graph, relationships |
| Best for | Control/data flow | Structural queries, search |

Both tools complement each other - use together for maximum coverage.

## Docker-Based Services

### crawl4ai

**Purpose:** Deep web crawling and structured extraction
**Used by:** harvest agent, oracle, architect, migrator, sleuth

```bash
cd vibecosystem/docker/crawl4ai
docker compose up -d
# Available at http://localhost:11235
```

**API:**
```bash
# Health check
curl http://localhost:11235/health

# Crawl a page
curl -s http://localhost:11235/crawl \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com"], "word_count_threshold": 50}'
```

## Adding to Your Project

Add the desired MCP servers to `~/.mcp.json` (global) or `.mcp.json` (project-level):

```json
{
  "mcpServers": {
    "browser-use": {
      "command": "uvx",
      "args": ["browser-use", "--mcp"]
    },
    "codebase-memory": {
      "command": "/usr/local/bin/codebase-memory-mcp",
      "args": ["--project-dir", "."]
    }
  }
}
```

Restart Claude Code after modifying MCP config.
