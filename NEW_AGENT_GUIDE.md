# How to add a new agent to cozanet-agents

One pattern, every agent, no exceptions. If any AI (Grok, Claude, whoever) builds a new agent for this repo, it must follow this checklist exactly — paste this file into the prompt if needed.

## The pattern in one sentence

Every agent is a class that extends `BaseAgent`, declares what task types it handles in its constructor, and implements a single `handle(task)` method that switches on `task.type`. Nothing else is required.

## Checklist

### 1. Create the file

`src/<Domain>/<Name>Agent.ts` — e.g. `src/Billing/BillingAgent.ts`.

Copy `src/_template/TemplateAgent.ts` as your starting point.

### 2. Extend BaseAgent, set identity

```ts
export class BillingAgent extends BaseAgent {
  constructor() {
    super('agent:billing', 'Billing Agent', 'Invoicing, payments, subscription state');

    this.registerCapability({
      name: 'billing',
      description: 'Create invoices, process payments, manage subscriptions',
      taskTypes: ['create_invoice', 'process_payment', 'get_subscription'],
    });
  }
}
```

- `id` — unique, always `agent:<lowercase-name>`.
- `taskTypes` — the complete list of task types this agent will accept. This is how `AgentRegistry.findByTaskType()` and `AgentRegistry.findByCapability()` discover it — an undeclared type means other agents/the orchestrator can't route to it.

### 3. Implement handle()

One `case` per declared task type, each calling a small private method. Unknown task types throw — never fail silently or return `undefined`.

```ts
public async handle(task: AgentTask): Promise<any> {
  switch (task.type) {
    case 'create_invoice': return this.createInvoice(task.input);
    case 'process_payment': return this.processPayment(task.input);
    case 'get_subscription': return this.getSubscription(task.input);
    default: throw new Error(`Unsupported task type: ${task.type}`);
  }
}
```

### 4. Register in AgentOrchestrator.ts

Two edits, both in `src/AgentOrchestrator.ts`:

```ts
// a) import, grouped with its phase/category
import { BillingAgent } from './Billing/BillingAgent';

// b) add an instance inside initialize()'s allAgents array
new BillingAgent(),
```

`AgentOrchestrator.initialize()` calls `registry.register(agent)` and `agent.start()` for everything in that array — miss this step and the agent exists but is never reachable.

### 5. Export from index.ts

```ts
export * from './Billing/BillingAgent';
```

This is what makes it importable from `@cozanet/agents` elsewhere in the org (cozanet-chat, cozanet-api, etc.).

### 6. Build before calling it done

`npm run build` must pass with zero errors. Per the org Constitution, nothing is "finished" until it builds — a task that only produces code in the chat window, without a clean build, is not done.

## What NOT to do

- Don't invent a different base class or a parallel "lite" agent pattern.
- Don't skip `registerCapability` — an agent with no declared task types is invisible to routing even if `handle()` works.
- Don't swallow errors in `handle()` — throw with a clear message; the BaseAgent/orchestrator layer already handles retries, timeouts, and error events for you.
- Don't forget step 4 or 5 — a correctly written agent that isn't registered or exported is the single most common "it says it's done but nothing happens" failure in this codebase.

## Reference implementations already in the repo

- `src/API/APIAgent.ts` — good example of a multi-capability agent with a real private-method-per-case structure.
- `src/base/BaseAgent.ts` — the contract every agent is built on; read this once, you won't need to touch it again.
- `src/_template/TemplateAgent.ts` — copy-paste starting point matching this exact contract.
