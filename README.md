# @cozanet/agents

CozanetOS Agent framework and core agent implementations.

## Installation

```bash
npm install @cozanet/agents
```

## Structure

- `src/types.ts`: Type definitions for agents, tasks, and messages.
- `src/base/BaseAgent.ts`: Abstract base class for all Cozanet agents.
- `src/CEO/CEOAgent.ts`: CEO Agent to orchestrate and delegate tasks.
- `src/Research/ResearchAgent.ts`: Research Agent interfacing with Groq.
- `src/Coding/CodingAgent.ts`: Coding Agent for generation and code review.
- `src/Memory/MemoryAgent.ts`: Memory Agent for interacting with Cozanet storage.
- `src/Planner/PlannerAgent.ts`: Planner Agent for breaking down goals.
- `src/AgentRegistry.ts`: Registry for active agents.
- `src/AgentOrchestrator.ts`: Lifecycle manager and orchestrator.
