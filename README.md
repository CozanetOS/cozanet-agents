# cozanet-agents

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)]()
[![Agents](https://img.shields.io/badge/agents-23-green.svg)]()
[![License](https://img.shields.io/badge/License-Apache%202.0-orange.svg)]()

`cozanet-agents` is the multi-agent framework powering **CozanetOS** — an AI-native operating system. It provides **23 specialized agents** that collaborate asynchronously under the CEO Orchestrator to handle everything from code generation and security auditing to email triage, scheduled automation, and backend integration.

This is not a chatbot library. Each agent is a **worker** — it registers capabilities, handles typed tasks, emits events, tracks health, and integrates with CozanetOS backend engines.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Core Infrastructure](#core-infrastructure)
- [Agent Registry (23 Agents)](#agent-registry-23-agents)
  - [Core Agents](#core-agents)
  - [Cognitive Agents](#cognitive-agents)
  - [Development Agents](#development-agents)
  - [Interface Agents](#interface-agents)
  - [Infrastructure Agents](#infrastructure-agents)
  - [Communication Agents](#communication-agents)
  - [Automation & Worker System](#automation--worker-system)
- [Integration Points](#integration-points)
- [Type System](#type-system)

---

## Quick Start

```typescript
import { AgentOrchestrator } from '@cozanet/agents';

// 1. Initialize — boots all 23 agents
const orchestrator = new AgentOrchestrator();
await orchestrator.initialize();

// 2. Submit a task to any agent
const result = await orchestrator.submitTask({
  id: 'task-1',
  agentId: 'agent:coding',
  type: 'generate',
  input: { language: 'typescript', prompt: 'Create a debounce utility function' },
  status: 'pending',
  priority: 'normal',
  createdAt: Date.now(),
  retries: 0,
  maxRetries: 3,
});

console.log(result);
// { taskId: 'task-1', agentId: 'agent:coding', status: 'done', output: {...}, durationMs: 1200 }

// 3. Delegate between agents
const researchResult = await orchestrator.delegate({
  id: 'task-2',
  agentId: 'agent:research',
  type: 'search',
  input: { query: 'latest TypeScript 5.4 decorators' },
  status: 'pending',
  priority: 'high',
  createdAt: Date.now(),
  retries: 0,
  maxRetries: 3,
});

// 4. Check system health
const health = orchestrator.getHealthReport();
// [{ id: 'agent:ceo', status: 'healthy', uptime: 45000, tasksCompleted: 12, ... }, ...]

// 5. Shutdown
await orchestrator.shutdown();
```

---

## Architecture

```
                           ┌─────────────────────────┐
                           │    AgentOrchestrator     │
                           │  (task queue, retry,     │
                           │   parallel execution)   │
                           └───────────┬─────────────┘
                                       │
                           ┌───────────▼─────────────┐
                           │      AgentRegistry       │
                           │  (23 agents, health,     │
                           │   capability lookup)     │
                           └───────────┬─────────────┘
                                       │
          ┌──────────────┬─────────────┼─────────────┬──────────────┐
          ▼              ▼             ▼             ▼              ▼
   ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌───────────┐ ┌────────────┐
   │    CEO      │ │  Research  │ │  Coding   │ │  Memory   │ │ Automation │
   │ (orchestr.) │ │ (web/ facts)│ │ (gen/ref) │ │ (storage) │ │  (worker)  │
   └────────────┘ └────────────┘ └───────────┘ └───────────┘ └────────────┘
          │              │             │             │              │
          └──────────────┴─────────────┴─────────────┴──────────────┘
                                       │
                           ┌───────────▼─────────────┐
                           │    cozanet-* engines     │
                           │  (automation, monitoring,│
                           │  communication, database) │
                           └─────────────────────────┘
```

Every agent extends `BaseAgent`, which provides:
- **Lifecycle hooks**: `onStart`, `onStop`, `onPause`, `onResume`, `onError`
- **Capability declarations**: each agent publishes what it can do
- **Event emission**: agents broadcast lifecycle and task events
- **Health tracking**: heartbeat, uptime, task success/failure counts
- **Message routing**: `sendMessage` with reply support
- **Retry-aware execution**: `executeTask` with configurable retries and timeout

---

## Core Infrastructure

### AgentOrchestrator

Central coordinator. Manages task submission, delegation, parallel execution, and system-wide health.

| Method | Description |
|---|---|
| `initialize()` | Boots all 23 agents, wires event forwarding |
| `submitTask(task)` | Submit a task — resolves with `TaskResult` |
| `enqueueTask(task)` | Add to priority queue (sorted by `critical > high > normal > low`) |
| `processQueue(maxConcurrent)` | Drain the queue with up to N parallel tasks |
| `delegate(task)` | Direct delegation to a specific agent (bypasses queue) |
| `getAgentStatus(id)` | Get a single agent's status and stats |
| `getAllAgentStatuses()` | Get all 23 agents' statuses |
| `getHealthReport()` | Health snapshot of every agent |
| `onEvent(handler)` | Subscribe to all agent events |
| `shutdown()` | Stop all agents, clear timers |

### AgentRegistry

Singleton registry. Agents register themselves; the orchestrator and other agents look them up by ID or capability.

| Method | Description |
|---|---|
| `register(agent)` | Add an agent to the registry |
| `unregister(id)` | Remove an agent |
| `get(id)` | Fetch agent by ID |
| `getByCapability(name)` | Find agents that declare a specific capability |
| `list()` | All registered agents |
| `getHealth(id)` | Health snapshot for one agent |
| `getHealthAll()` | Health snapshot for all agents |

### BaseAgent

All 23 agents extend this. Provides the lifecycle, event, health, and task execution framework.

| Method | Description |
|---|---|
| `start()` / `stop()` / `pause()` / `resume()` | Lifecycle transitions |
| `executeTask(task)` | Run a task with retry + timeout support |
| `handle(task)` | Agent-specific task handler (overridden by each agent) |
| `registerCapability(cap)` | Declare what this agent can do |
| `getCapabilities()` | List declared capabilities |
| `on(handler)` / `emit(event)` | Event subscribe/publish |
| `sendMessage(to, message)` | Route a message to another agent |
| `getStats()` | Uptime, tasks completed/failed, last active |
| `getStatus()` | Current lifecycle state |

---

## Agent Registry (23 Agents)

All agents accept an `AgentTask` with `{ type, input }` and return typed results.

---

### Core Agents

#### 1. CEO Agent (`agent:ceo`)
The supreme orchestrator. Receives high-level goals, creates plans, delegates to specialist agents, and aggregates results.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `plan` | `{ goal: string }` | `{ plan: PlannedTask[] }` | Parse a high-level goal into a structured execution plan |
| `delegate` | `{ plan: PlannedTask[] }` | `{ results: TaskResult[] }` | Execute the plan by delegating each step to the right agent |
| `status` | — | `{ activeTasks, completedTasks, failedTasks }` | Report current operational status |
| `report` | `{ period: { start, end } }` | `{ summary, metrics, recommendations }` | Generate an operational report for a time period |

#### 2. Research Agent (`agent:research`)
Gathers external data from the web, validates sources, and produces structured reference indices.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `search` | `{ query: string, maxResults?: number }` | `{ results: SearchResult[] }` | Web search with ranked sources |
| `deep_search` | `{ query: string, depth?: number }` | `{ results: SearchResult[] }` | Multi-query deep research with cross-referencing |
| `fact_check` | `{ claim: string }` | `{ verdict: string, sources: Source[] }` | Verify a claim against multiple sources |
| `summarize` | `{ topic: string }` | `{ summary: string, keyPoints: string[] }` | Distill a topic into a concise summary |

#### 3. Coding Agent (`agent:coding`)
Generates, refactors, and debugs code across many languages. Produces multi-file output with metrics.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `generate` | `{ language, prompt, context? }` | `{ files: CodeFile[], metrics: CodeMetrics }` | Generate code from a prompt |
| `refactor` | `{ code, language, goals? }` | `{ files: CodeFile[], changes: string[] }` | Refactor existing code |
| `debug` | `{ code, error, language? }` | `{ fix: string, explanation: string }` | Diagnose and fix a code error |
| `test` | `{ code, language, framework? }` | `{ tests: string, coverage: string }` | Generate test suites for existing code |

#### 4. Memory Agent (`agent:memory`)
Multi-tier memory management with hot/warm/cold storage, semantic search, and forgetting policies.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `store` | `{ content, tier?, tags?, metadata? }` | `{ id: string, stored: boolean }` | Store a memory (defaults to hot tier) |
| `retrieve` | `{ id }` | `{ memory: MemoryEntry }` | Retrieve a specific memory by ID |
| `search` | `{ query, tags?, tier?, limit? }` | `{ results: MemoryEntry[] }` | Semantic search across memory tiers |
| `consolidate` | `{ source: "warm" \| "hot" }` | `{ consolidated: number }` | Move aged memories to colder tier |
| `forget` | `{ id, reason? }` | `{ forgotten: boolean }` | Delete a memory with reason tracking |

#### 5. Planner Agent (`agent:planner`)
Decomposes high-level objectives into dependency-tracked, prioritized execution plans.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `decompose` | `{ objective: string }` | `{ steps: PlanStep[] }` | Break an objective into ordered steps with dependencies |
| `prioritize` | `{ steps: PlanStep[] }` | `{ steps: PlanStep[] }` | Assign priorities based on urgency, impact, dependencies |
| `schedule` | `{ steps: PlanStep[] }` | `{ schedule: ScheduledStep[] }` | Create a time-ordered schedule with estimated durations |
| `assess` | `{ plan: PlanStep[] }` | `{ risks: Risk[], estimatedTime: number }` | Risk assessment and time estimation for a plan |

---

### Cognitive Agents

#### 6. Learning Agent (`agent:learning`)
Observes execution history and user interactions to build preference profiles and habits.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `record_preference` | `{ key, value, confidence? }` | `{ recorded: boolean }` | Store a user preference observation |
| `track_habit` | `{ action, timestamp? }` | `{ habitId: string }` | Track a recurring user action |
| `adapt` | `{ context }` | `{ adaptations: string[] }` | Suggest behavior changes based on learned patterns |
| `learn_from` | `{ event, outcome }` | `{ learned: boolean, insight: string }` | Learn from a completed event/outcome pair |
| `profile` | — | `{ preferences, habits, patterns }` | Get the current user profile |

#### 7. Knowledge Agent (`agent:knowledge`)
Indexes and queries structured knowledge with semantic search and knowledge graph links.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `add` | `{ content, source, tags? }` | `{ id: string, indexed: boolean }` | Add knowledge to the KB |
| `query` | `{ question }` | `{ answer: string, sources: string[] }` | Ask a question against the knowledge base |
| `search` | `{ query, tags?, limit? }` | `{ results: KnowledgeEntry[] }` | Semantic search across knowledge entries |
| `link` | `{ fromId, toId, relation }` | `{ linked: boolean }` | Create a knowledge graph relationship |
| `get` | `{ id }` | `{ entry: KnowledgeEntry }` | Fetch a specific knowledge entry |

---

### Development Agents

#### 8. Browser Agent (`agent:browser`)
Headless browser automation — navigation, interaction, data extraction, and screenshots.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `navigate` | `{ url, waitUntil? }` | `{ title, url, status: number }` | Navigate to a URL |
| `click` | `{ selector }` | `{ clicked: boolean }` | Click an element by CSS selector |
| `type` | `{ selector, text }` | `{ typed: boolean }` | Type text into an input field |
| `extract` | `{ selectors: Record<string, string> }` | `{ data: Record<string, any> }` | Extract data from multiple selectors |
| `screenshot` | `{ fullPage? }` | `{ path: string }` | Capture a page screenshot |

#### 9. Review Agent (`agent:review`)
Code, architecture, and design review with quality metrics and issue severity classification.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `code_review` | `{ code, language }` | `{ issues: Issue[], score: number }` | Static code analysis |
| `architecture_review` | `{ structure, dependencies }` | `{ issues: Issue[], recommendations: string[] }` | Architecture-level review |
| `design_review` | `{ design }` | `{ feedback: string[], score: number }` | Design pattern review |
| `quality_report` | `{ code, language }` | `{ metrics: QualityMetrics, grade: string }` | Comprehensive quality scoring |

#### 10. Testing Agent (`agent:testing`)
Test execution, coverage analysis, and benchmarking.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `run_tests` | `{ path, framework? }` | `{ passed, failed, skipped, duration }` | Execute a test suite |
| `generate_tests` | `{ code, language, framework? }` | `{ tests: string }` | Auto-generate tests for code |
| `coverage` | `{ path }` | `{ percentage, uncovered: string[] }` | Analyze test coverage |
| `benchmark` | `{ code, iterations? }` | `{ avgMs, minMs, maxMs, opsPerSec }` | Performance benchmark |

#### 11. Security Agent (`agent:security`)
Vulnerability scanning, encryption, access control, and key rotation.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `scan` | `{ target, type? }` | `{ vulnerabilities: Vulnerability[], risk: string }` | Scan for vulnerabilities |
| `encrypt` | `{ data, algorithm? }` | `{ ciphertext: string, keyId: string }` | Encrypt data |
| `decrypt` | `{ ciphertext, keyId }` | `{ data: string }` | Decrypt data |
| `check_access` | `{ resource, userId }` | `{ allowed: boolean, reason: string }` | Check access permissions |
| `rotate_keys` | `{ keyId }` | `{ rotated: boolean, newKeyId: string }` | Rotate encryption keys |

---

### Interface Agents

#### 12. Vision Agent (`agent:vision`)
Image and video analysis — object detection, OCR, scene description, and comparison.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `analyze` | `{ imagePath }` | `{ description, tags: string[] }` | Full image analysis |
| `ocr` | `{ imagePath }` | `{ text: string, confidence: number }` | Optical character recognition |
| `detect` | `{ imagePath, target? }` | `{ objects: DetectedObject[] }` | Object detection |
| `compare` | `{ image1, image2 }` | `{ similarity: number, differences: string[] }` | Compare two images |
| `describe` | `{ imagePath }` | `{ description: string }` | Generate a scene description |

#### 13. CX7 Agent (`agent:cx7`)
Dynamic infinite programmable layout management for CozanetOS interfaces.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `create_layout` | `{ name, type, config }` | `{ layoutId: string }` | Create a new dynamic layout |
| `render` | `{ layoutId, data }` | `{ html: string }` | Render a layout with data |
| `update` | `{ layoutId, changes }` | `{ updated: boolean }` | Update layout configuration |
| `list_layouts` | — | `{ layouts: Layout[] }` | List all layouts |
| `get_layout` | `{ layoutId }` | `{ layout: Layout }` | Fetch a specific layout |

#### 14. Device Agent (`agent:device`)
Local hardware interaction — device registration, sync, discovery, and health monitoring.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `register` | `{ name, type, capabilities }` | `{ deviceId: string }` | Register a new device |
| `sync` | `{ deviceId }` | `{ synced: boolean, itemsSynced: number }` | Sync a device |
| `discover` | `{ type? }` | `{ devices: Device[] }` | Discover available devices |
| `command` | `{ deviceId, command, params? }` | `{ result: any }` | Send a command to a device |
| `health` | `{ deviceId }` | `{ status, battery?, temperature? }` | Get device health |

---

### Infrastructure Agents

#### 15. API Agent (`agent:api`)
LLM provider registry, credential vault, cost tracking, and intelligent routing.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `call` | `{ provider, model, prompt, options? }` | `{ response, tokensUsed, cost, latencyMs }` | Call an LLM provider |
| `register_provider` | `{ ProviderInfo }` | `{ registered: boolean, name }` | Register a new provider |
| `list_providers` | — | `ProviderInfo[]` | List all available providers |
| `estimate_cost` | `{ provider, model, tokens }` | `{ estimatedCost }` | Estimate the cost of a call |
| `route` | `{ prompt, requirements? }` | `{ provider, model, reason }` | Auto-route to the optimal provider |

#### 16. Workflow Agent (`agent:workflow`)
Multi-step workflow creation and execution with pause/resume support.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `create` | `{ name, steps: WorkflowStep[] }` | `WorkflowDef` | Create a new workflow |
| `execute` | `{ workflowId }` | `WorkflowRunResult` | Execute a workflow end-to-end |
| `pause` | `{ workflowId }` | `{ paused: boolean }` | Pause a running workflow |
| `resume` | `{ workflowId }` | `{ resumed: boolean }` | Resume a paused workflow |
| `list_workflows` | — | `WorkflowDef[]` | List all workflows |
| `get_workflow` | `{ workflowId }` | `WorkflowDef \| null` | Fetch a specific workflow |

#### 17. Scheduler Agent (`agent:scheduler`)
Cron-based scheduling and one-time future tasks.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `schedule` | `{ name, cron, agentId, taskType, input }` | `ScheduledJob` | Schedule a recurring job |
| `schedule_once` | `{ name, executeAt, agentId, taskType, input }` | `ScheduledJob` | Schedule a one-time future task |
| `cancel` | `{ jobId }` | `{ cancelled: boolean }` | Cancel a scheduled job |
| `list_jobs` | — | `ScheduledJob[]` | List all jobs |
| `get_job` | `{ jobId }` | `ScheduledJob \| null` | Fetch a specific job |
| `reschedule` | `{ jobId, cron }` | `{ rescheduled: boolean }` | Update a job's cron schedule |

#### 18. Database Agent (`agent:database`)
Unified database interface — CRUD, transactions, schema management, and migrations.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `query` | `{ table, filter, options? }` | `{ rows, count, durationMs }` | Query records with filter |
| `insert` | `{ table, record }` | `{ id, inserted: boolean }` | Insert a record |
| `update` | `{ table, filter, updates }` | `{ updated: number }` | Update matching records |
| `delete` | `{ table, filter }` | `{ deleted: number }` | Delete matching records |
| `transaction` | `{ operations: DBOp[] }` | `{ committed, results }` | Run a transaction |
| `schema` | `{ table? }` | `SchemaInfo` | Get table schema(s) |
| `migrate` | `{ from, to }` | `{ migrated, recordsMigrated }` | Migrate data between sources |

#### 19. Analytics Agent (`agent:analytics`)
Metrics collection, trend analysis, insights, and export.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `track` | `{ metric, value, tags? }` | `{ tracked: boolean }` | Track a metric data point |
| `report` | `{ period, metrics? }` | `AnalyticsReport` | Generate a metrics report |
| `trend` | `{ metric, period }` | `{ direction, values }` | Trend analysis for a metric |
| `insights` | `{ data }` | `{ insights: string[] }` | Generate insights from data |
| `aggregate` | `{ metric, operation, period? }` | `{ result }` | Aggregate (sum/avg/min/max/count) |
| `export` | `{ format, period }` | `{ path }` | Export as JSON/CSV/PDF |

---

### Communication Agents

#### 20. Email Agent (`agent:email`)
Email composition, sending, receiving, search, and triage.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `send` | `{ to, subject, body, html?, attachments? }` | `{ sent, messageId }` | Send an email |
| `receive` | `{ folder?, limit? }` | `{ messages, total, folder }` | Fetch emails from a folder |
| `search` | `{ query, folder? }` | `{ messages, total }` | Search emails |
| `draft` | `{ to, subject, body }` | `EmailMessage` | Create a draft |
| `reply` | `{ messageId, body }` | `{ replied, messageId }` | Reply to a message |
| `forward` | `{ messageId, to }` | `{ forwarded, messageId }` | Forward a message |
| `triage` | `{ messages: EmailMessage[] }` | `{ categories, priorities }` | Auto-categorize and prioritize |

#### 21. Documents Agent (`agent:documents`)
Document creation, format conversion, search, templates, and summarization.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `create` | `{ name, type, content }` | `DocumentInfo` | Create a document |
| `convert` | `{ documentId, toFormat }` | `{ convertedTo, success }` | Convert format (PDF, DOCX, etc.) |
| `search` | `{ query, limit? }` | `{ results }` | Search documents |
| `summarize` | `{ documentId }` | `{ summary }` | Summarize a document |
| `template` | `{ templateId, variables }` | `{ rendered }` | Apply a template with variables |
| `list_documents` | — | `DocumentInfo[]` | List all documents |

#### 22. Voice Agent (`agent:voice`)
Speech-to-text, text-to-speech, voice commands, and language detection.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `stt` | `{ audioPath, language? }` | `{ text, confidence, language, duration }` | Speech-to-text transcription |
| `tts` | `{ text, voice?, options? }` | `{ audioPath, format, duration, voice }` | Text-to-speech synthesis |
| `command` | `{ audioPath }` | `{ command, intent, confidence, params }` | Parse a voice command |
| `detect_language` | `{ audioPath }` | `{ language, confidence }` | Detect spoken language |
| `list_voices` | — | `{ voices: Voice[] }` | List available TTS voices |

#### 23. Integration Agent (`agent:integration`)
Third-party service connections — OAuth, API keys, webhooks, and sync.

| Task Type | Input | Output | Description |
|---|---|---|---|
| `connect` | `{ name, type, authMethod, credentials? }` | `IntegrationConfig` | Connect to an external service |
| `disconnect` | `{ integrationId }` | `{ disconnected: boolean }` | Disconnect a service |
| `call` | `{ integrationId, endpoint, method, body? }` | `IntegrationCallResult` | Call an external API endpoint |
| `list_integrations` | — | `IntegrationConfig[]` | List all integrations |
| `webhook_register` | `{ integrationId, url, events }` | `{ webhookId, registered }` | Register a webhook |
| `sync` | `{ integrationId }` | `{ synced, itemsSynced }` | Sync data from a service |

---

### Automation & Worker System

#### 24. Automation Agent (`agent:automation`)

> **This is the difference between a chatbot and a staff member.**

The AutomationAgent is the worker that never sleeps. It schedules recurring jobs, monitors targets on intervals, triggers actions when conditions are met, chains multi-step workflows, calls backend APIs, and sends notifications — all automatically.

**Integration points**: `cozanet-automation`, `cozanet-monitoring`, `cozanet-scheduler`

| Task Type | Input | Output | Description |
|---|---|---|---|
| `create_rule` | `{ name, description, trigger, action, maxFires? }` | `AutomationRule` | Create an automation rule with a trigger and action |
| `pause_rule` | `{ ruleId }` | `{ paused: boolean }` | Pause a rule (stops firing, keeps definition) |
| `resume_rule` | `{ ruleId }` | `{ resumed: boolean }` | Resume a paused rule |
| `delete_rule` | `{ ruleId }` | `{ deleted: boolean }` | Permanently delete a rule |
| `list_rules` | — | `AutomationRule[]` | List all automation rules |
| `monitor` | `{ target, condition, intervalMs }` | `{ monitorId, active }` | Start monitoring a target on an interval |
| `run_now` | `{ ruleId }` | `{ fired, result }` | Manually fire a rule immediately |
| `get_status` | `{ ruleId }` | `AutomationRule \| null` | Get a rule's status and stats |

**Triggers** (the `trigger` field on `create_rule`):

| Trigger Kind | Fields | Example |
|---|---|---|
| `schedule` | `cron: string` | `{ kind: 'schedule', cron: '0 9 * * 1' }` — every Monday at 9am |
| `interval` | `ms: number` | `{ kind: 'interval', ms: 3600000 }` — every hour |
| `once` | `executeAt: number` | `{ kind: 'once', executeAt: Date.now() + 86400000 }` — tomorrow |
| `event` | `eventType, filter?` | `{ kind: 'event', eventType: 'entity.created', filter: { type: 'Order' } }` |
| `monitor` | `target, condition, checkIntervalMs` | `{ kind: 'monitor', target: 'api-server', condition: 'unhealthy', checkIntervalMs: 60000 }` |

**Actions** (the `action` field on `create_rule`):

| Action Kind | Fields | Fires |
|---|---|---|
| `agent_task` | `agentId, taskType, input` | Delegates a task to any of the 23 agents |
| `workflow` | `workflowId` | Executes a multi-step WorkflowAgent workflow |
| `notify` | `message, channel?` | Sends a notification (email, push, Slack — via cozanet-communication) |
| `api_call` | `integrationId, endpoint, method, body?` | Calls an external API via the IntegrationAgent |

**Example — "Come back every Monday and check the club's calendar":**

```typescript
import { AgentOrchestrator } from '@cozanet/agents';

const orchestrator = new AgentOrchestrator();
await orchestrator.initialize();

// Create the automation rule
const rule = await orchestrator.delegate({
  id: 'auto-1',
  agentId: 'agent:automation',
  type: 'create_rule',
  input: {
    name: 'Weekly Club Calendar Check',
    description: 'Every Monday at 9am, review upcoming events and send a summary',
    trigger: { kind: 'schedule', cron: '0 9 * * 1' },
    action: {
      kind: 'agent_task',
      agentId: 'agent:email',
      taskType: 'send',
      input: {
        to: 'david@cozanet.os',
        subject: 'Weekly Club Events Summary',
        body: 'Auto-generated summary of this week\'s club events.',
      },
    },
  },
  status: 'pending',
  priority: 'normal',
  createdAt: Date.now(),
  retries: 0,
  maxRetries: 3,
});

// It will now fire every Monday at 9am automatically.
// No further intervention needed.

// Monitor a service and alert if it goes down:
const monitorRule = await orchestrator.delegate({
  id: 'auto-2',
  agentId: 'agent:automation',
  type: 'create_rule',
  input: {
    name: 'API Health Monitor',
    description: 'Check API health every 60s, alert if unhealthy',
    trigger: {
      kind: 'monitor',
      target: 'club-api',
      condition: 'unhealthy',
      checkIntervalMs: 60000,
    },
    action: {
      kind: 'notify',
      message: '⚠️ Club API is down!',
      channel: 'slack',
    },
  },
  status: 'pending',
  priority: 'high',
  createdAt: Date.now(),
  retries: 0,
  maxRetries: 3,
});
```

---

## Integration Points

Each agent declares integration points with CozanetOS backend engines:

| Engine | Used By | Purpose |
|---|---|---|
| `cozanet-automation` | Automation, Scheduler, Workflow | Cron parsing, job execution, workflow engine |
| `cozanet-monitoring` | Automation, Analytics, Device | Health checks, telemetry, metrics collection |
| `cozanet-communication` | Email, Integration, Automation | SMTP/Gmail/Outlook, webhooks, notifications |
| `cozanet-database` | Database, Memory, Knowledge | Persistent storage, transactions, vector search |
| `cozanet-identity` | Integration, Security | OAuth flows, API key management, access control |
| `cozanet-filesystem` | Documents, Knowledge | File I/O, document parsing, format conversion |
| `cozanet-multimodal` | Voice, Vision | STT/TTS engines, image/video analysis |
| `cozanet-browser` | Browser | Headless browser driver (Puppeteer/Playwright) |

---

## Type System

All agents use the shared types defined in `types.ts`:

```typescript
// Task submitted to any agent
interface AgentTask {
  id: string;
  agentId: string;
  type: string;
  input: any;
  status: 'pending' | 'in_progress' | 'done' | 'failed' | 'timeout' | 'cancelled';
  priority: 'critical' | 'high' | 'normal' | 'low';
  createdAt: number;
  retries: number;
  maxRetries: number;
  timeoutMs?: number;
  result?: any;
  error?: string;
}

// Result returned after execution
interface TaskResult {
  taskId: string;
  agentId: string;
  status: 'done' | 'failed';
  output?: any;
  error?: string;
  durationMs: number;
}

// Agent capability declaration
interface AgentCapability {
  name: string;
  description: string;
  taskTypes: string[];
}

// Agent health snapshot
interface AgentHealth {
  id: string;
  status: AgentStatus;
  uptime: number;
  lastHeartbeat: number;
  tasksCompleted: number;
  tasksFailed: number;
  memoryUsage?: number;
}

// Event emitted by agents
interface AgentEvent {
  type: string;
  agentId: string;
  timestamp: number;
  data?: any;
}
```

---

## License

Apache 2.0 — © CozanetOS
