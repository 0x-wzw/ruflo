# ruflo × 0x-wzw Adapter Integration Architecture

## Objective
Integrate the 7 core agentic frameworks (NecroSwarm, NeuroSwarm, Obliviarch, VoidTether, OpenClaw, Memory Evolution, Deterministic Retrieval) into ruflo's plugin architecture as a unified `ruflo-0x-wzw` plugin ecosystem.

## Integration Strategy

### Phase 1: Plugin Scaffold (Immediate)
Create 7 ruflo plugins that expose your frameworks through ruflo's plugin API:

| Your Framework | ruflo Plugin | Role |
|----------------|--------------|------|
| NecroSwarm | `ruflo-necroswarm` | Workforce coordination / swarm management |
| NeuroSwarm | `ruflo-neuroswarm` | Brain + swarm dual-phase orchestration |
| Obliviarch | `ruflo-obliviarch` | Memory compression (500x) |
| VoidTether | `ruflo-voidtether` | Cross-machine interoperability mesh |
| OpenClaw | `ruflo-openclaw` | Workflow orchestration / namespace management |
| Memory Evolution | `ruflo-memevolve` | Self-improving memory systems |
| Deterministic Retrieval | `ruflo-detret` | Exact retrieval with guaranteed precision |

### Phase 2: Adapter Layer (Week 1)
Port existing Python adapters to TypeScript/ruflo plugin format:
- `SwarmWeaver` → `ruflo-necroswarm/src/adapter.ts`
- `NeuroWeaver` → `ruflo-neuroswarm/src/adapter.ts`
- `ObliviarchAdapter` → `ruflo-obliviarch/src/adapter.ts`

### Phase 3: Memory Integration (Week 2)
Integrate Obliviarch compression into ruflo's memory pipeline:
- Pre-store: Compress with Obliviarch (500x reduction)
- Retrieval: Use Deterministic Retrieval for exact match queries
- Evolution: Apply Memory Evolution for self-improving storage

### Phase 4: Federation Bridge (Week 3)
Connect VoidTether to ruflo-federation:
- VoidTether mesh ↔ ruflo federation protocol
- Secure cross-machine agent collaboration
- OpenClaw namespace bridge for workflow distribution

## Plugin Directory Structure

```
plugins/
├── ruflo-0x-wzw-core/          # Meta-plugin, loads all 7
│   ├── package.json
│   ├── src/
│   │   └── index.ts            # Plugin registration
│   └── README.md
├── ruflo-necroswarm/           # Workforce coordination
│   ├── src/
│   │   ├── adapter.ts          # SwarmWeaver port
│   │   ├── swarm-manager.ts    # Agent pool management
│   │   └── commands/
│   │       ├── swarm-init.ts
│   │       ├── swarm-deploy.ts
│   │       └── swarm-status.ts
│   └── tests/
├── ruflo-neuroswarm/           # Brain + swarm dual-phase
│   ├── src/
│   │   ├── adapter.ts          # NeuroWeaver port
│   │   ├── brain.ts             # Planning/strategy phase
│   │   ├── swarm.ts             # Execution phase
│   │   └── commands/
│   │       ├── brain-activate.ts
│   │       └── dual-phase.ts
│   └── tests/
├── ruflo-obliviarch/           # 500x memory compression
│   ├── src/
│   │   ├── adapter.ts          # ObliviarchAdapter port
│   │   ├── compressor.ts        # Compression engine
│   │   ├── decompressor.ts      # Retrieval engine
│   │   └── commands/
│   │       ├── compress.ts
│   │       └── decompress.ts
│   └── tests/
├── ruflo-voidtether/           # Interoperability mesh
│   ├── src/
│   │   ├── adapter.ts
│   │   ├── mesh.ts              # P2P connection management
│   │   ├── bridge.ts            # Protocol translation
│   │   └── commands/
│   │       ├── mesh-init.ts
│   │       └── bridge-connect.ts
│   └── tests/
├── ruflo-openclaw/             # Workflow orchestration
│   ├── src/
│   │   ├── adapter.ts
│   │   ├── namespace.ts         # Workflow namespace management
│   │   ├── hooks.ts             # OpenClaw hook integration
│   │   └── commands/
│   │       ├── workflow-start.ts
│   │       └── namespace-list.ts
│   └── tests/
├── ruflo-memevolve/            # Self-improving memory
│   ├── src/
│   │   ├── adapter.ts
│   │   ├── evolution.ts         # Memory self-optimization
│   │   ├── feedback-loop.ts     # Learning from usage
│   │   └── commands/
│   │       ├── evolve.ts
│   │       └── optimize.ts
│   └── tests/
└── ruflo-detret/               # Deterministic retrieval
    ├── src/
    │   ├── adapter.ts
    │   ├── exact-match.ts       # Hash-based retrieval
    │   ├── provenance.ts        # Chain of custody
    │   └── commands/
    │       ├── retrieve-exact.ts
    │       └── verify.ts
    └── tests/
```

## Key Design Decisions

### 1. Adapter Pattern Preservation
Your existing adapter interfaces (`IAgentService`, `IMemoryService`, `IWorkflowService`) map cleanly to ruflo's plugin API:
- `IAgentService` → ruflo agent spawn/management commands
- `IMemoryService` → ruflo memory_store MCP tools
- `IWorkflowService` → ruflo workflow plugin templates

### 2. Compression Pipeline
Integrate Obliviarch into ruflo's memory flow:
```
Agent Output → Obliviarch Compress (500x) → ruflo AgentDB Store
                                              ↓
User Query → Deterministic Retrieval ←→ ruflo RAG Memory
                (exact match)              (semantic search)
```

### 3. Swarm Coordination
NecroSwarm's workforce coordination enhances ruflo's swarm with:
- Worker pool management (auto-scale based on load)
- Task decomposition and assignment
- Cross-worker state sharing via VoidTether mesh

### 4. Dual-Phase Execution
NeuroSwarm's brain+swarm pattern adds to ruflo:
- **Brain phase**: Strategic planning, goal decomposition
- **Swarm phase**: Parallel execution with ruflo's router

## Implementation Roadmap

### Week 1: Core Plugins
- [ ] Scaffold all 7 plugin directories
- [ ] Port SwarmWeaver adapter to TypeScript
- [ ] Port NeuroWeaver adapter to TypeScript
- [ ] Port ObliviarchAdapter to TypeScript
- [ ] Create ruflo-0x-wzw-core meta-plugin

### Week 2: Memory & Workflow
- [ ] Integrate Obliviarch compression with ruflo AgentDB
- [ ] Wire Deterministic Retrieval as primary exact-match backend
- [ ] Connect Memory Evolution to ruflo's learning loop
- [ ] Port OpenClaw namespace management to ruflo workflow system

### Week 3: Federation & Polish
- [ ] Bridge VoidTether mesh to ruflo federation protocol
- [ ] Add cross-machine agent spawning
- [ ] Create unified CLI (`ruflo 0x-wzw init`)
- [ ] Documentation and examples

### Week 4: Validation
- [ ] Run ruflo test suite against adapted plugins
- [ ] Benchmark memory compression ratios
- [ ] Validate cross-machine federation
- [ ] Performance testing at scale

## Differentiation from Base ruflo

Your fork adds these unique capabilities:

1. **500x Memory Compression**: Obliviarch reduces storage costs dramatically
2. **Deterministic Retrieval**: Guaranteed exact-match vs probabilistic semantic search
3. **Self-Improving Memory**: Memory Evolution adapts storage based on access patterns
4. **Dual-Phase Swarms**: Brain plans, swarm executes — separation of concerns
5. **Interoperability Mesh**: VoidTether connects heterogeneous agent systems
6. **Adapter Abstraction**: Not locked to one framework — plug in any system

## Next Immediate Action

Create the first plugin scaffold (`ruflo-necroswarm`) to validate the adapter pattern works within ruflo's plugin system.

---

**Branch**: `z/adapter-integration`  
**Fork**: `https://github.com/0x-wzw/ruflo`  
**Status**: Planning complete, ready for implementation
