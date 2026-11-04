# Optional MCP and external tools

Core installation does not enable MCP servers, provision accounts or start external services. The catalog contains instructions that can use tools supplied by a host or separately configured server. A skill mentioning a tool does not mean that tool is connected or available.

Use the upstream documentation for the version you install:

| Integration | Purpose | Authoritative setup |
| --- | --- | --- |
| Notion MCP | Access to selected Notion content | [Official Notion MCP server](https://github.com/makenotion/notion-mcp-server) |
| Browser Use | Browser automation through its supported integrations | [Browser Use documentation](https://docs.browser-use.com/) |
| codebase-memory-mcp | Persistent code graph and code intelligence | [Upstream setup and tool reference](https://github.com/DeusData/codebase-memory-mcp) |
| Crawl4AI | Crawling and structured extraction | [Official documentation](https://docs.crawl4ai.com/) |

These projects change independently. This repository does not freeze their tool names, command-line options, supported language counts or performance. Discover the tools exposed by your actual connected server and use its input schema. Do not invent an API from an old skill example.

## Before connecting

Choose the smallest capability needed for the task. Review the server's code, installation method, credentials, filesystem access and data destinations. Use the host's supported server configuration and account setup; a global path that works in one coding host can be wrong in another.

Pin a reviewed package or binary version where possible. Do not write tokens into committed configuration, copy an unchecked downloaded executable into a shared binary directory, or open local services to the network as an incidental setup step.

After connection, inspect the actual tool list and perform a minimal read-only check against synthetic or intentionally selected content. A registered server is not proof that authentication, indexing or access permissions work.

## Relationship to the context profile

The `context` profile includes hooks that reference a compatible TLDR daemon. MCP code-graph tools are a separate integration; installing them does not automatically satisfy the TLDR protocol. Either tool may be useful for a specific task, but this project does not claim a fixed speed or token-saving multiplier from using both.

## Crawl4AI Docker example

The repository retains `docker/crawl4ai/docker-compose.yml` as an optional service example. Inspect its image, ports, volumes and credentials before using it. Follow the upstream documentation for the selected image's API and authentication. The core installer does not start this service.

## Data

Connected services can receive source code, page content, queries, prompts or credentials according to their configuration. Review the selected integration's data policy and your host's tool permissions. See [SECURITY.md](../SECURITY.md) and the [runtime architecture](../ARCHITECTURE.md).
