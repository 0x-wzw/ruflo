# OpenClaw ↔ RuFlo Bridge

Bidirectional integration between OpenClaw agent runtime and ruflo orchestration.

## Overview

This plugin maps OpenClaw operations to ruflo commands:

| OpenClaw | RuFlo | Bridge Action |
|----------|-------|---------------|
| `sessions_spawn` | `ruflo agent spawn` | Spawn agent in swarm |
| `sessions_list` | `ruflo agent list` | List active agents |
| `sessions_send` | `ruflo agent message` | Send message to agent |
| `sessions_yield` | `ruflo agent await` | Wait for completion |
| `subagents list` | `ruflo swarm status` | List swarm members |
| `subagents kill` | `ruflo agent kill` | Terminate agent |
| MEMORY.md | `ruflo-obliviarch` | Compress session memory |

## Installation

```bash
# Install in ruflo workspace
cd /path/to/ruflo
npx ruflo plugin install ruflo-openclaw-bridge

# Or manually
git clone https://github.com/0x-wzw/ruflo.git
cd ruflo/plugins/ruflo-openclaw-bridge
npm install
npm run build
```

## Configuration

Set environment variables:

```bash
export OPENCLAW_WS_URL="ws://your-openclaw-gateway:8080"
export OPENCLAW_HTTP_URL="http://your-openclaw-gateway:8080"
export OPENCLAW_TOKEN="your-auth-token"
export RUFLO_DEFAULT_SWARM="default"
export RUFLO_MAX_AGENTS="10"
export OPENCLAW_SYNC_MEMORY="true"
```

Or create `.env` in the plugin directory.

## Commands

### Spawn Agent
```bash
ruflo openclaw-spawn "task description" "agent-label"
```
Maps to OpenClaw `sessions_spawn` with ruflo swarm registration.

### List Agents
```bash
ruflo openclaw-list
```
Shows all OpenClaw sessions mapped to ruflo agents.

### Send Message
```bash
ruflo openclaw-send <sessionKey> "Your message here"
```
Maps to OpenClaw `sessions_send`.

### Kill Agent
```bash
ruflo openclaw-kill <sessionKey>
```
Maps to OpenClaw session termination.

## Architecture

```
OpenClaw Gateway          Bridge Plugin           RuFlo Core
     │                         │                      │
     │ WebSocket               │                      │
     │◄───────────────────────►│                      │
     │  sessions.spawned       │                      │
     │  session.completed      │                      │
     │  heartbeat              │                      │
     │                         │  agent.registered      │
     │                         │─────────────────────►│
     │                         │  memory.compress      │
     │                         │─────────────────────►│
     │                         │                      │
     │ HTTP API                │  Plugin API          │
     │◄───────────────────────►│◄────────────────────►│
     │  POST /sessions/spawn   │  spawnAgent()        │
     │  GET  /sessions         │  listAgents()        │
     │  POST /sessions/send    │  sendMessage()       │
     │  DELETE /sessions/id    │  killAgent()         │
```

## Features

### 1. Session Auto-Discovery
Bridge automatically discovers OpenClaw sessions and maps them to ruflo agents.

### 2. Memory Compression
When sessions complete, transcripts are compressed via `ruflo-obliviarch` (500x reduction).

### 3. Swarm Coordination
OpenClaw subagents become ruflo swarm members with full lifecycle management.

### 4. Heartbeat Sync
Periodic sync (30s default) keeps session status consistent between systems.

## Integration with Other Plugins

- **ruflo-obliviarch**: Session memory compression
- **ruflo-necroswarm**: Worker pool for spawned agents
- **ruflo-voidtether**: Cross-machine session federation

## Development

```bash
cd plugins/ruflo-openclaw-bridge
npm install
npm run build
npm test
```

## References

- OpenClaw: https://github.com/openclaw/openclaw
- RuFlo: https://github.com/0x-wzw/ruflo
- Branch: z/adapter-integration
