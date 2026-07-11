# cozanet-agents

[![CozanetOS Agents](https://img.shields.io/badge/CozanetOS-Agents-blue.svg)]()
[![AI-Native OS](https://img.shields.io/badge/Architecture-AI--Native%20OS-brightgreen.svg)]()
[![License](https://img.shields.io/badge/License-Apache%202.0-orange.svg)]()

`cozanet-agents` provides the highly specialized, concurrent, and cooperative workforce of **CozanetOS**. It contains a comprehensive agent registry featuring **23+ domain-specific agents** that handle everything from code generation and runtime security auditing to web automation, memory synthesis, and real-world system integrations. Under the command of the CEO Orchestrator, these agents collaborate asynchronously, delegating sub-tasks and aggregating multi-source context to complete complex system goals.

---

## 🚀 Key Capabilities

*   **23+ Specialized Agent Registries:** A modular workforce where each agent is tailored, prompt-optimized, and tool-equipped for distinct tasks.
*   **Dynamic Agent Lifecycle:** Spawn, suspend, resume, query, and decommission agent instances programmatically or dynamically based on resource load.
*   **Inter-Agent Delegation:** Advanced multi-agent signaling mechanisms allowing agents to automatically split up work and assign specialized tasks to peers (e.g., Coding Agent delegating test coverage to Testing Agent).
*   **Result Aggregation:** Structured output collection, parsing, and fusion into unified result payloads.
*   **Context Sandbox Isolation:** Each active agent runs within secure sandboxed environments to prevent unverified tool actions from impacting system stability.

---

## 🤖 Detailed Agent Registry

CozanetOS includes the following specialized agents:

| Agent Name | Purpose & Primary Capabilities |
| :--- | :--- |
| **CEO Agent** | Supreme orchestrator; parses user prompt, validates policies, and assigns work to Planners. |
| **Planner Agent** | Decomposes high-level objectives into actionable execution DAGs. |
| **Research Agent** | Gathers external web, academic, and news data, generating structured reference indices. |
| **Memory Agent** | Manages vector embedding conversions, memory consolidation, and semantic pruning. |
| **Learning Agent** | Reviews execution histories to establish custom habits, operational shortcuts, and fine-tuning datasets. |
| **Knowledge Agent** | Indexes and queries internal document lakes, wiki sources, and structured files. |
| **Browser Agent** | Orchestrates browser automation (Puppeteer/Playwright-driven navigation, form submission, and extraction). |
| **Coding Agent** | Generates, refactors, and updates high-quality code across dozens of languages. |
| **Review Agent** | Performs syntax, logic, architectural design, and optimization audits on candidate code. |
| **Testing Agent** | Designs robust test suites and runs automated unit, integration, and performance tests. |
| **Security Agent** | Executes real-time dependency audits, static vulnerability analysis, and secret leakage detection. |
| **Vision Agent** | Extracts insights, descriptions, metadata, and visual features from images and video feeds. |
| **CX7 Agent** | Generates UI prototypes, wireframes, and dynamically designs visual intelligence interfaces. |
| **Device Agent** | Interacts with local hardware, USB devices, dynamic drivers, and Bluetooth interfaces. |
| **API Agent** | Automatically explores, authenticates, maps, and executes arbitrary third-party REST and gRPC endpoints. |
| **Workflow Agent** | Builds and executes persistent multi-stage DAG orchestrations and business flows. |
| **Scheduler Agent** | Manages time-based, cron, and event-triggered task executions across the system. |
| **Email Agent** | Connects to mail backends (Gmail, Outlook) to read, draft, filter, and dispatch communications safely. |
| **Documents Agent** | Conducts complex OCR, tables reconstruction, and semantically parses PDFs, DOCXs, and slides. |
| **Voice Agent** | Handles high-fidelity, expressive TTS (Text-to-Speech) and low-latency, multi-lingual STT (Speech-to-Text). |
| **Analytics Agent** | Processes data frames, plots statistical charts, and runs automated telemetry diagnostics. |
| **Database Agent** | Generates SQL/NoSQL queries, designs schemas, executes migrations, and manages query performance. |
| **Integration Agent**| Interacts with generic third-party SaaS services (Slack, Salesforce, Jira, GitHub, Discord, etc.). |

---

## 🏛️ Architecture & Component Breakdown

```
                             +-------------------------+
                             |     cozanet-core        |
                             |   (CEO Orchestrator)    |
                             +------------+------------+
                                          |
                                          v
                             +------------+------------+
                             |    Agent Lifecycle      |
                             |       Controller        |
                             +------------+------------+
                                          |
               +--------------------------+--------------------------+
               |                          |                          |
               v                          v                          v
     +-------------------+      +-------------------+      +-------------------+
     |    Coding Agent   |      |   Security Agent  |      |   Testing Agent   |
     |  (Code, Refactor) |      | (Audit, Secrets)  |      |  (Unit, Mocking)  |
     +---------+---------+      +---------+---------+      +---------+---------+
               |                          |                          |
               +--------------------------+--------------------------+
                                          |
                                          v
                             +------------+------------+
                             |     Aggregations and    |
                             |     Consolidated Output |
                             +-------------------------+
```

Each agent in `cozanet-agents` extends the base `CozanetAgent` class, which implements:
1.  **Tool Belt System:** Provides dynamic discovery and binding of local or remote tools.
2.  **State Machine:** Tracks agent statuses (`IDLE`, `PLANNING`, `EXECUTING`, `WAITING`, `COMPLETED`, `FAILED`).
3.  **Communication Interface:** Hooks into the Cozanet OS Communication Bus to listen and broadcast asynchronously.

---

## 🔌 API & Interface Overview

### Spawning and Querying an Agent Programmatically

```python
from cozanet_agents import AgentRegistry, AgentConfig

# 1. Initialize Registry and fetch preferred agent configuration
registry = AgentRegistry.load()
security_config = AgentConfig(
    agent_id="security-ops-1",
    parameters={"strict_mode": True, "scan_depth": "deep"}
)

# 2. Spawn and configure the agent
security_agent = registry.spawn_agent("SecurityAgent", config=security_config)

# 3. Dispatched execution over a code directory
response = security_agent.execute({
    "action": "scan_repository",
    "target_directory": "/app/src/payment_gateway"
})

print(f"Agent state: {security_agent.state}")
print(f"Vulnerabilities Found: {response['vulnerabilities_count']}")
```

---

## 🔗 Integration with Other CozanetOS Modules

*   **`cozanet-core`:** Receives operational guidelines, task lists, and runtime state commands.
*   **`cozanet-communication`:** Consumes system event notifications and exchanges inter-agent routing envelopes.
*   **`cozanet-memory`:** Saves conversational context and retrieves specialized skills, agent guidelines, and long-term habits.

---

## ⚡ Quick-Start Notes

### Installation
```bash
pip install -e ./cozanet-agents
```

### Run Multi-Agent Interactive Diagnostic
```bash
# Starts a collaborative test execution between Coding, Testing, and Review Agents
cozanet-agents test-collaboration --prompt "Write a fast Fibonacci function in Rust, create tests, and audit safety."
```
