# Design: Tool-Deferral Coverage

> Issue: #614
> Status: Draft
> Created: 2026-07-12

## Problem

Every AI coding agent (Claude Code, Copilot, Cursor, etc.) loads tool definitions into the system prompt at session start. These definitions consume context window tokens — tokens that could otherwise be used for actual work.

CodeBurn's `context-budget.ts` already quantifies this overhead:
- **MCP tools**: ~400 tokens per tool × 5 tools/server = ~2000 tokens/server
- **Skills**: ~80 tokens per skill frontmatter
- **Commands**: ~60 tokens per command definition
- **Memory files**: CLAUDE.md, .claude/CLAUDE.md, etc.

A user with 10 MCP servers, 5 skills, and 3 memory files easily burns **20,000+ tokens** before writing a single prompt.

## Current State

### What CodeBurn does today
1. `context-budget.ts` — estimates context overhead per project
2. `optimize.ts` — detects MCP servers that are loaded but never invoked
3. `optimize.ts` — flags skills/commands that are defined but never used

### What CodeBurn does NOT do
1. **Defer tool loading** — tools are loaded eagerly at session start
2. **Measure actual impact** — no before/after token comparison
3. **Auto-apply fixes** — findings are advisory only

## Design Space

### Option A: Native deferral (agent-side)

The agent itself decides when to load tools based on the user's request.

**Pros:**
- No infrastructure changes
- Works with any MCP server
- Immediate token savings

**Cons:**
- Requires agent cooperation (Claude Code, Copilot each implement differently)
- May increase latency for tool calls (cold load)
- Risk of loading wrong tools (misclassified intent)

### Option B: Proxy-side deferral (proxy intercepts)

A proxy sits between agent and MCP server, only forwarding tool defs when relevant.

**Pros:**
- Agent-agnostic
- Can measure exact token savings
- No agent changes needed

**Cons:**
- Requires running a proxy (operational overhead)
- Breaks MCP protocol semantics (tools list must be static)
- Latency on first tool call

### Option C: CodeBurn-guided deferral (advisory + automation)

CodeBurn analyzes usage patterns and generates configuration that limits tool loading.

**Pros:**
- Works today (config generation)
- Measurable impact
- No protocol changes

**Cons:**
- Limited to agents that support config-based tool filtering
- Not all MCP servers support selective tool exposure

## Recommendation: Option C (CodeBurn-guided)

### Implementation Phases

#### Phase 1: Configuration generation (advisory)
```
codeburn optimize --apply-mcp-scoping
```
- Reads `~/.claude/settings.json` MCP server config
- Cross-references with CodeBurn usage data
- Generates `.mcp.json` per-project with only the tools used in that project
- Preserves global config for hot-path servers

#### Phase 2: Impact measurement
```
codeburn context-budget --compare
```
- Before/after comparison of context usage
- Per-project breakdown of token savings
- Integration with `codeburn optimize` health score

#### Phase 3: Session guard (issue #602)
```
codeburn optimize --session-guard
```
- Monitors context usage in real-time
- Warns when context exceeds 70% of model limit
- Suggests which tools/skills to unload

### Configuration Format

```json
// .mcp.json (project-scoped)
{
  "mcpServers": {
    "github": {
      "includeTools": ["create_issue", "list_issues"],
      "excludeTools": ["delete_repository", "create_repository"]
    }
  }
}
```

### Risks

1. **Agent compatibility** — not all agents support tool filtering
2. **Cold start latency** — deferred tools load slower on first use
3. **Intent misclassification** — wrong tools loaded for complex requests

### Open Questions

1. Which agents support selective tool exposure?
2. What's the latency impact of deferred loading?
3. How to measure "tool usefulness" — invocations vs completions?

## Next Steps

1. Survey agent capabilities (Claude Code, Copilot, Cursor, OpenCode)
2. Build Phase 1 config generator as `optimize` detector
3. Measure impact on real user sessions
4. Document findings for Phase 2/3 scoping
