# COZANET OS — MASTER BUILD SPECIFICATION
## Personal AI + Company Operating System
### Version 1.0 — August 19, 2026

## 1. PURPOSE

Cozanet OS is NOT a generic chatbot.

It is CozyCrypto's persistent AI operating environment: a system that remembers the user, understands projects, operates inside defined domains, uses tools, performs work, verifies results, maintains state, researches opportunities, monitors the Cozanet company, and continues long-running work across sessions.

The model is only one component.

The real system is:

**Model + memory + state + domains + tools + tasks + planning + permissions + automation + verification + evaluation.**

The goal is to turn AI from a prompt-response interface into a persistent worker.

---

# 2. CORE VISION

Cozanet OS should answer:

> "Given what I know about CozyCrypto, his goals, current project state, available tools, permissions, and previous decisions, what is the most useful next action?"

The core agent loop is:

**Context → Goal → Plan → Tools → Execute → Observe → Verify → Remember → Next Action**

The system should eventually allow CozyCrypto to say:

- "Continue."
- "Continue AEGIS."
- "Check Cozanet."
- "Find funding."
- "Research this."
- "Fix this."
- "What changed while I was away?"
- "What did we decide?"
- "Find something useful for the company."

and have the system understand the context without requiring the user to reconstruct everything.

---

# 3. WHY THIS EXISTS

CozyCrypto is building:

- Cozanet;
- AEGIS;
- Cozanet AI;
- Cozanet OS;
- trading workflows;
- company infrastructure;
- funding/ecosystem relationships.

The complexity is too large to keep entirely in one person's head.

Cozanet OS should carry:

- context;
- decisions;
- architecture;
- project state;
- tasks;
- research;
- opportunities;
- risks;
- technical work;
- company intelligence;
- historical lessons.

The user remains the strategist and final authority.

The AI becomes the persistent operating layer.

---

# 4. CORE PRODUCT PRINCIPLE

Do NOT solve this by creating an enormous prompt.

The previously created personal context file should remain useful, but it is only the **identity/context layer**.

Cozanet OS must instead separate:

- Personal context;
- Domain knowledge;
- Current state;
- Memory;
- Tasks;
- Tools;
- Permissions;
- Workflows;
- Evaluations.

This makes the system maintainable and lets the AI retrieve only the context relevant to the current task.

---

# 5. HIGH-LEVEL ARCHITECTURE

```text
                         COZYCRYPTO
                              |
                              v
                    +-------------------+
                    |    COZANET OS     |
                    |   ORCHESTRATOR    |
                    +---------+---------+
                              |
          +-------------------+-------------------+
          |                   |                   |
          v                   v                   v
      PERSONAL            COZANET             AEGIS
       DOMAIN              DOMAIN             DOMAIN
          |                   |                   |
          +-------------------+-------------------+
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
          MEMORY           PLANNER         TASK ENGINE
             |                |                |
             +----------------+----------------+
                              |
                         TOOL ROUTER
                              |
       +----------+-----------+----------+-----------+
       |          |           |          |           |
       v          v           v          v           v
     GitHub    Terminal      Web      Database    Deployments
       |          |           |          |           |
       +----------+-----------+----------+-----------+
                              |
                           EXECUTE
                              |
                           VERIFY
                              |
                        UPDATE STATE
                              |
                        UPDATE MEMORY
                              |
                         NEXT ACTION
```

---

# 6. DOMAINS

A domain is a bounded operating environment with its own:

- mission;
- instructions;
- knowledge;
- tools;
- permissions;
- workflows;
- tasks;
- evaluation criteria.

Initial domains:

1. Personal
2. Cozanet Company
3. AEGIS
4. Cozanet AI
5. Trading
6. Research
7. Engineering
8. Security
9. Funding
10. Strategic Intelligence

The system should be able to activate the relevant domain instead of loading the entire world into every model call.

---

# 7. PERSONAL DOMAIN

Purpose: help CozyCrypto personally.

It should understand:

- identity;
- goals;
- preferences;
- projects;
- history;
- decisions;
- priorities;
- current context.

It supports:

- planning;
- research;
- decision support;
- project continuity;
- personal knowledge;
- trading context;
- coordination.

Do not confuse the Personal Domain with the Cozanet Company Domain.

---

# 8. COZANET COMPANY DOMAIN

Mission:

> Continuously identify information, opportunities, risks, improvements, partnerships, funding, technology, market changes, and operational actions that can materially help Cozanet.

This is a major part of the product.

The AI should not only wait for CozyCrypto to ask questions.

It should be capable of saying:

> "I found something that matters."

---

# 9. AEGIS DOMAIN

AEGIS is the financial infrastructure/account and intelligent routing layer.

AEGIS is not simply:

- a bank;
- a wallet;
- a chatbot;
- a token;
- a payment app.

The central architectural idea is:

> **AEGIS does not need to build everything. It needs to connect and intelligently route existing infrastructure.**

It should connect appropriate:

- banks;
- payment processors;
- mobile-money systems;
- blockchain networks;
- stablecoins;
- wallets;
- liquidity providers;
- APIs;
- settlement rails;
- identity systems.

The AI must preserve this principle when recommending architecture.

For new functionality, explicitly consider:

**BUILD vs INTEGRATE vs DEFER vs ELIMINATE**

Do not default to BUILD.

---

# 10. COZANET AI

Cozanet AI is an agentic AI product.

It may exist:

- independently;
- inside AEGIS;
- as part of Cozanet OS workflows.

Distinction:

- **Cozanet OS** = operating environment.
- **Cozanet AI** = agent/product.
- **AEGIS** = financial infrastructure/routing layer.
- **Cozanet** = broader company/ecosystem.

Do not collapse them into one vague product.

---

# 11. TRADING DOMAIN

CozyCrypto is a trader.

Relevant trading history:

- earlier scalping;
- Ichimoku Cloud;
- 5m focus;
- later Smart Money Concepts;
- liquidity;
- Fair Value Gaps;
- liquidity zones;
- order blocks.

Typical multi-timeframe framework:

- 1H = trend/context;
- 15M = liquidity/context;
- 5M = monitoring;
- 3M = entries.

The AI may support:

- trade journal;
- chart analysis;
- setup documentation;
- strategy review;
- risk review;
- lessons;
- performance tracking.

Never fabricate trade data.

---

# 12. COMPANY RADAR

Cozanet OS should maintain a continuous **Cozanet Radar**.

It should monitor:

## Funding
- grants;
- hackathons;
- accelerators;
- ecosystem funding;
- investors;
- African startup programs;
- AI programs;
- fintech programs;
- Web3 programs.

## Market
- payment trends;
- stablecoin trends;
- African fintech developments;
- digital asset infrastructure;
- market changes.

## Competition
- competitors;
- new products;
- funding;
- launches;
- partnerships;
- pricing;
- technology.

## Technology
- APIs;
- payment rails;
- blockchain infrastructure;
- AI models;
- developer platforms;
- open-source tools;
- databases;
- security technologies.

## Regulation
- relevant financial rules;
- crypto rules;
- payment rules;
- cross-border changes.

## Security
- CVEs;
- dependency vulnerabilities;
- exposed secrets;
- provider advisories;
- configuration issues.

## Ecosystem
- BNB Chain;
- Stellar/Soroban;
- relevant Web3 ecosystems;
- builder programs;
- partner opportunities.

## Product
- user problems;
- market gaps;
- competitor gaps;
- missing capabilities.

---

# 13. OPPORTUNITY ENGINE

The AI must not simply collect information.

Every discovery should pass through:

```text
WHAT CHANGED?
      ↓
WHY DOES IT MATTER?
      ↓
DOES IT AFFECT COZANET?
      ↓
IS THERE AN OPPORTUNITY?
      ↓
IS THERE A RISK?
      ↓
CAN WE ACT?
      ↓
WHAT IS THE SMALLEST USEFUL ACTION?
```

Example:

A new provider appears.

The AI researches:

- geographic coverage;
- pricing;
- API;
- reliability;
- supported rails;
- compliance;
- compatibility with AEGIS;
- possible cost reduction.

Then it can create an internal evaluation task rather than merely showing a link.

---

# 14. FUNDING INTELLIGENCE

The system should periodically search for relevant opportunities.

Previous target ecosystems include:

- BNB Chain Builder Grants;
- BNB Chain hackathons;
- BNB Incubation Alliance;
- Most Valuable Builder;
- Stellar Community Fund;
- Antler;
- SMEDAN;
- other relevant Web3/AI/fintech opportunities.

For every opportunity, verify current:

- deadline;
- eligibility;
- geography;
- stage;
- funding;
- requirements;
- application status.

Never assume an opportunity is open because it was previously open.

Rank opportunities instead of dumping search results.

Example:

```text
Opportunity: XYZ Grant
Funding: $25,000
Fit: 8.8/10
Eligibility: Likely
Readiness: 7/10
Deadline: September 12
Missing requirement: Production demo
Recommendation: HIGH PRIORITY
```

---

# 15. COMPETITIVE INTELLIGENCE

For meaningful competitor changes:

```text
COMPANY
What changed?
What did they build?
Why?
Does it overlap with Cozanet?
Does it threaten us?
Can we integrate with them?
Can we learn from them?
Should strategy change?
```

The purpose is awareness and strategic leverage, not paranoia.

---

# 16. TECHNOLOGY RADAR

Monitor useful technology and ask:

> Does this make Cozanet cheaper, faster, safer, or more capable?

Examples:

- AI models;
- coding agents;
- payment APIs;
- blockchain infrastructure;
- RPC providers;
- wallets;
- identity systems;
- databases;
- deployment platforms;
- open-source projects.

Do not recommend technology merely because it is new.

---

# 17. REGULATORY RADAR

Regulatory monitoring is informational and cautious.

The AI may:

- detect changes;
- summarize;
- identify potentially affected products;
- create review tasks.

Classification:

- GREEN = probably irrelevant;
- YELLOW = potential impact;
- RED = professional/legal review required.

Do not present uncertain regulatory interpretations as legal advice.

---

# 18. SECURITY RADAR

Security monitoring should be proactive.

Monitor:

- repositories;
- dependencies;
- environment configuration;
- deployments;
- security advisories;
- exposed credentials;
- permission changes;
- suspicious architecture.

Critical security findings should alert immediately.

For sensitive changes:

**detect automatically, modify cautiously.**

---

# 19. MEMORY SYSTEM

Memory must be structured, not one giant text file.

Memory categories:

```text
IDENTITY
GOALS
PROJECTS
DECISIONS
TASKS
LESSONS
RESEARCH
CURRENT STATE
ARCHITECTURE
PROVIDERS
RISKS
OPPORTUNITIES
HISTORY
```

Memory records should include:

- type;
- content;
- source;
- date;
- confidence;
- status;
- related project;
- durability.

---

# 20. MEMORY TYPES

The system must distinguish:

### FACT
Confirmed information.

### DECISION
Explicitly chosen direction.

### PROPOSAL
Suggested but not accepted.

### HYPOTHESIS
Unverified possibility.

### HISTORICAL STATE
Previously true but possibly outdated.

### GOAL
Something the user wants to accomplish.

This distinction prevents memory corruption.

---

# 21. MEMORY PRIORITY

When information conflicts:

1. explicit recent user decision;
2. current architecture/source of truth;
3. confirmed implementation state;
4. recent project state;
5. older assumptions;
6. speculative ideas.

Old memory must never silently override a newer explicit decision.

---

# 22. CURRENT STATE ENGINE

Maintain machine-readable current state.

Example:

```text
Mission:
Build Cozanet/AEGIS into credible intelligent financial infrastructure.

Current phase:
MVP hardening + architecture consolidation + agentic AI + funding.

Strategic principle:
Connect before rebuilding.

Wallet architecture:
Vault Engine is source of truth.

Security:
No secrets/private keys exposed.

Autonomy:
Autonomous but not unsupervised.
```

Update current state after meaningful work.

---

# 23. TASK ENGINE

Every significant unit of work should have:

- ID;
- title;
- description;
- domain;
- priority;
- status;
- dependencies;
- acceptance criteria;
- assigned skill/agent;
- dates;
- evidence;
- result.

Statuses:

```text
BACKLOG
READY
IN_PROGRESS
BLOCKED
REVIEW
VERIFICATION
COMPLETE
CANCELLED
```

---

# 24. TASK SELECTION

At the start of a work session:

1. inspect current state;
2. inspect active tasks;
3. inspect blockers;
4. inspect dependencies;
5. select highest-value unblocked task;
6. work on it;
7. verify;
8. update state.

Do not randomly choose work.

---

# 25. AGENT WORK LOOP

```text
LOAD CONTEXT
     ↓
UNDERSTAND TASK
     ↓
INSPECT CURRENT STATE
     ↓
PLAN
     ↓
EXECUTE
     ↓
OBSERVE
     ↓
TEST
     ↓
FIX
     ↓
VERIFY
     ↓
UPDATE TASK
     ↓
UPDATE MEMORY
     ↓
UPDATE CURRENT STATE
     ↓
SELECT NEXT ACTION
```

The AI must not stop at "I wrote the code."

---

# 26. SESSION START

At the start of an engineering session:

1. Load relevant personal context.
2. Load domain constitution.
3. Load current state.
4. Load active task.
5. Inspect repository.
6. Inspect recent changes.
7. Check failed tests.
8. Check health/deployment state when relevant.
9. Understand dependencies.
10. Begin work.

---

# 27. SESSION END

At the end of work:

1. Record what changed.
2. Record tests.
3. Record test results.
4. Record unresolved issues.
5. Update task.
6. Record architectural decisions.
7. Record lessons.
8. Update current state.
9. Preserve Git history.
10. State exact next action.

The next session must be able to continue without reconstructing the entire project.

---

# 28. TOOL SYSTEM

Cozanet OS should expose machine-readable tools.

Initial tools:

## Files
- read_file
- write_file
- search_files
- list_files

## Terminal
- run_command
- inspect_output
- run_script

## Git
- git_status
- git_diff
- git_log
- git_branch
- git_commit

## GitHub
- repositories
- files
- issues
- pull requests
- commits
- Actions/workflows
- CI results

## Web
- search
- fetch
- research

## Database
- inspect_schema
- permitted_query

## Deployment
- deployment_status
- deployment_logs
- health_check

## Blockchain
- RPC
- balance
- transaction_status
- contract_read

## Memory
- remember
- recall
- update_memory
- archive_memory

## Tasks
- create_task
- update_task
- complete_task

## Approvals
- request_approval
- record_approval
- record_rejection

---

# 29. DETERMINISTIC TOOLS VS MODEL REASONING

Do not use an LLM for work software can do deterministically.

Examples:

Git status → Git
File search → filesystem
Calculation → code
Database lookup → database
Health check → HTTP
Transaction status → RPC
Dependency version → package manager

Use models for:

- interpretation;
- planning;
- synthesis;
- architecture;
- ambiguity;
- code generation;
- decision support.

This reduces cost, latency, context usage, and hallucination.

---

# 30. MODEL PROVIDER ABSTRACTION

Do not permanently couple the system to one AI provider.

Architecture:

```text
COZANET OS
   ↓
AGENT RUNTIME
   ↓
MODEL ADAPTER
   ↓
MODEL PROVIDER
```

The provider should be replaceable.

Cozanet OS should remain useful if a provider changes pricing, limits, or availability.

---

# 31. COST CONTROL

The objective is not merely to find a "free AI."

The objective is to minimize unnecessary model calls.

Use:

- deterministic tools;
- caching;
- retrieval;
- compact context;
- quick-search paths;
- batching;
- model routing;
- smaller models for routine tasks;
- stronger models for complex reasoning.

---

# 32. SPECIALIZED AGENT SKILLS

Initial skills/modes:

### Architect
Protect architecture and evaluate system changes.

### Engineer
Implement code.

### Researcher
Search and verify information.

### QA
Test and attempt to break implementations.

### Security
Find security weaknesses.

### Company Intelligence
Monitor Cozanet.

### Funding Analyst
Find and rank funding.

These should initially be skills/modes rather than a complicated swarm of separate agents.

Start with:

**one orchestrator + specialized skills.**

---

# 33. ORCHESTRATOR

The Orchestrator decides:

- active domain;
- required skill;
- tools;
- whether specialized reasoning is required;
- whether approval is required;
- next action.

Avoid unnecessary multi-agent complexity.

---

# 34. PERMISSION MODEL

## LEVEL 1 — AUTONOMOUS

Allowed:

- research;
- monitoring;
- analysis;
- summaries;
- memory updates;
- internal task creation;
- non-destructive diagnostics;
- opportunity discovery.

## LEVEL 2 — PREPARE

Allowed:

- code changes;
- branches;
- PR preparation;
- application drafts;
- deployment plans;
- integration proposals.

Sensitive final actions require approval.

## LEVEL 3 — APPROVAL REQUIRED

Examples:

- production deployment;
- moving funds;
- deleting production data;
- rotating critical credentials;
- changing wallet security;
- submitting legal documents;
- signing binding agreements;
- irreversible financial actions.

---

# 35. APPROVAL OBJECT

Every sensitive action should have:

```text
Action
Reason
Changes
Tests
Risk
Rollback
Approval required
```

Example:

```text
Action:
Deploy AEGIS production release.

Reason:
Fix wallet display issue.

Tests:
17/17 passed.

Risk:
Medium.

Rollback:
Available.

Approval:
REQUIRED
```

---

# 36. EVALUATION SYSTEM

Do not judge the AI by whether it "feels smart."

Create repeatable evaluations.

Examples:

- identify AEGIS architecture;
- identify Vault Engine as wallet source of truth;
- detect conflicting wallet implementation;
- prefer integration over unnecessary rebuilding;
- detect exposed secrets;
- diagnose deployment failures;
- research a current grant accurately;
- implement and verify a feature;
- recall durable decisions;
- recover from a failed session;
- rank company opportunities;
- respect permissions.

Every system improvement should be measurable against evaluations.

---

# 37. COMPANY AUTOMATION

Scheduled jobs should include:

## Daily
- funding scan;
- critical security scan;
- important company news;
- relevant ecosystem updates.

## Periodic
- infrastructure health;
- deployment monitoring;
- API/provider changes.

## Weekly
- competitive intelligence;
- technology radar;
- funding review;
- product opportunity review.

## Monthly
- strategic review;
- company state review;
- project priority review;
- memory cleanup.

Schedules must be configurable.

---

# 38. DAILY COMPANY INTELLIGENCE

Generate a concise:

# COZANET DAILY INTELLIGENCE

Sections:

1. Critical alerts.
2. Funding opportunities.
3. Competitive changes.
4. Technology changes.
5. Regulatory changes.
6. Ecosystem updates.
7. AEGIS engineering discoveries.
8. Product opportunities.
9. Recommended actions.
10. Items requiring CozyCrypto approval.

Do not overwhelm the user.

---

# 39. OPPORTUNITY → TASK PIPELINE

A discovery should be able to become a real work item.

```text
DISCOVERY
   ↓
ANALYSIS
   ↓
RELEVANCE
   ↓
RECOMMENDATION
   ↓
TASK
   ↓
PRIORITIZATION
   ↓
EXECUTION
```

Example:

A new settlement provider is discovered.

The AI determines it may reduce AEGIS costs.

It creates:

```text
AEGIS-EVAL-PROVIDER-X
```

Acceptance criteria:

- API reviewed;
- fees compared;
- sandbox tested;
- reliability assessed;
- architectural fit determined.

---

# 40. NO AUTOMATIC PRODUCTION FROM DISCOVERY

The AI must distinguish:

**interesting → evaluated → approved → implemented → tested → deployed**

Discovery does not equal authorization.

---

# 41. AEGIS ENGINEERING WORKFLOW

```text
TASK
 ↓
INSPECT ARCHITECTURE
 ↓
INSPECT EXISTING IMPLEMENTATION
 ↓
IDENTIFY CORRECT SERVICE BOUNDARY
 ↓
PLAN
 ↓
IMPLEMENT
 ↓
RUN TESTS
 ↓
INSPECT DIFF
 ↓
SECURITY CHECK
 ↓
INTEGRATION TEST
 ↓
PREPARE COMMIT/PR
 ↓
APPROVAL IF REQUIRED
```

---

# 42. AEGIS ARCHITECTURE PROTECTION

AEGIS has an architecture constitution.

The AI must check proposed changes against it.

If a technically functional implementation violates architecture:

> "This works technically but conflicts with the current AEGIS architecture because..."

The AI should explain and propose an architecture-compliant solution.

---

# 43. WALLET ARCHITECTURE RULE

The established preferred direction is:

**Identity Engine → Vault Engine**

The previous UI-level HMAC wallet derivation should not be casually reintroduced.

Vault Engine is the preferred wallet source of truth.

This should become:

- an architecture rule;
- an evaluation;
- a regression test.

---

# 44. SECURITY RULES

Never:

- expose private keys;
- expose privileged service keys;
- commit secrets;
- put privileged credentials client-side;
- bypass permission boundaries;
- treat production as a test environment.

Security checks should be automated where practical.

---

# 45. GITHUB-FIRST DEVELOPMENT

Because CozyCrypto may not have access to a laptop/Claude Code environment, GitHub should be a primary engineering surface.

Goal:

> **A missing laptop must not become a bottleneck to progress.**

Cozanet OS should be able to:

- inspect repositories;
- inspect files;
- create issues/tasks;
- prepare branches;
- prepare commits/PRs;
- trigger/monitor GitHub Actions;
- inspect CI;
- preserve progress.

Where direct execution is unavailable, use GitHub Actions or another authorized remote runner.

---

# 46. GITHUB ACTIONS AS REMOTE HANDS

Architecture:

```text
Cozanet OS
    ↓
GitHub
    ↓
Repository
    ↓
GitHub Actions
    ↓
Tests / Build / Security / Jobs
    ↓
Results
    ↓
Cozanet OS
```

This is how the system can continue engineering without requiring a local laptop for every task.

---

# 47. PERSISTENT WORKSPACE

Maintain durable project state:

```text
/current-state
/tasks
/memory
/projects
/research
/decisions
/logs
/evaluations
/checkpoints
```

The exact implementation may use database records rather than literal folders, but the logical separation must exist.

---

# 48. GIT AS CODE HISTORY

Git is the historical record of code.

The AI should inspect:

- current branch;
- recent commits;
- diffs;
- previous work;
- failed changes.

Never blindly overwrite previous work.

---

# 49. FAILURE RECOVERY

If a session fails:

1. inspect Git state;
2. inspect task state;
3. inspect progress;
4. inspect tests;
5. identify last known good state;
6. resume.

The system must be designed for continuation, not one-shot completion.

---

# 50. PROGRESS CHECKPOINT

For long-running work, maintain:

```text
What was true before?
What changed?
What is true now?
What remains?
What is blocked?
What is the next action?
```

This is critical for reliable multi-session work.

---

# 51. BASE44 ROLE

Base44 is currently the practical builder environment.

It should build the **agent system**, not merely a chat interface.

Avoid making the intelligence inseparable from Base44-specific assumptions.

The architecture should allow later connections to:

- GitHub;
- external backend;
- remote execution;
- databases;
- model providers;
- search;
- deployment systems.

---

# 52. REQUIRED UI

Initial UI:

## Dashboard
- current mission;
- current project;
- active task;
- alerts;
- discoveries;
- opportunities;
- system health.

## Chat
Natural-language interface.

## Projects
- Cozanet;
- AEGIS;
- Cozanet AI;
- Cozanet OS;
- Trading.

## Tasks
Backlog and active work.

## Intelligence
Company radar.

## Memory
Searchable durable context.

## Research
Research records.

## Approvals
Pending sensitive actions.

## Activity
Tool/action logs.

## Settings
Providers, schedules, permissions, tools.

---

# 53. DASHBOARD PRINCIPLE

The dashboard must answer:

1. What is happening?
2. What requires my attention?
3. What is the AI doing?
4. What did it discover?
5. What is blocked?
6. What should happen next?

Avoid decorative dashboards.

---

# 54. CHAT MUST CONNECT TO REAL STATE

If the AI says:

> "I created a task."

there must actually be a task.

If it says:

> "I checked GitHub."

there must be a tool execution record.

If it says:

> "I verified the deployment."

there must be evidence.

Never simulate tool use.

---

# 55. ACTIVITY LOG

Every tool action should record:

- timestamp;
- domain;
- skill/agent;
- tool;
- input summary;
- output summary;
- success/failure;
- related task;
- approval ID if relevant.

Never log secrets.

---

# 56. TOOL REGISTRY

Each tool should have:

- name;
- purpose;
- inputs;
- outputs;
- permissions;
- domain access;
- failure modes;
- provider;
- status;
- cost if applicable.

The orchestrator chooses tools using this registry.

---

# 57. SKILL REGISTRY

Each skill should have:

- name;
- purpose;
- domain;
- instructions;
- required tools;
- allowed actions;
- evaluations;
- version.

---

# 58. CONTEXT LOADING

Do not send all memory to the model.

For an AEGIS wallet task, load:

- AEGIS constitution;
- wallet architecture;
- current task;
- relevant code;
- relevant decisions;
- relevant tests.

Do not load unrelated trading history.

This improves reasoning and reduces context usage.

---

# 59. COMPANY KNOWLEDGE GRAPH

Eventually maintain relationships:

```text
Cozanet
 ├── AEGIS
 │    ├── Identity Engine
 │    ├── Vault Engine
 │    └── Provider Router
 ├── Cozanet AI
 ├── Cozanet OS
 ├── CZN
 ├── GitHub
 ├── Funding
 └── Partners
```

This enables relationship-aware reasoning.

---

# 60. PROACTIVE INTELLIGENCE

Ideal behavior:

> "I noticed X."

Then:

> "I checked whether it matters."

Then:

> "It matters because Y."

Then:

> "I recommend Z."

Then:

> "I prepared Z but did not execute it because approval is required."

This is the desired proactive worker behavior.

---

# 61. ANTI-NOISE RULE

Proactivity without relevance becomes spam.

Every automated discovery needs:

- relevance threshold;
- confidence;
- priority;
- evidence.

Low-value information should be suppressed.

---

# 62. ALERT PRIORITY

### CRITICAL
Security issue, production failure, urgent deadline.

### HIGH
Major funding deadline, serious architecture issue, major competitor change.

### MEDIUM
Useful opportunity, technology change.

### LOW
Interesting but non-actionable information.

---

# 63. COMPANY REPORTING

The system should maintain:

### Daily
Daily intelligence.

### Weekly
Company review.

### Monthly
Strategic review.

Monthly questions:

- What changed?
- What was accomplished?
- What failed?
- What remains blocked?
- What opportunities appeared?
- What risks appeared?
- What should be prioritized?
- Are we aligned with the mission?

---

# 64. STRATEGIC REVIEW

The AI should compare:

**Vision vs current reality**

and identify:

- strategic drift;
- bottlenecks;
- unnecessary work;
- opportunities;
- resource problems.

It should recommend changes, not silently change the strategy.

---

# 65. RESOURCE AWARENESS

CozyCrypto is building with constrained resources.

The system should favor:

- integrations;
- low-cost infrastructure;
- open-source;
- grants;
- automation;
- high-leverage work.

But never choose "free" blindly if it creates unacceptable security or reliability risk.

---

# 66. DECISION ENGINE

Recommendations should follow:

```text
GOAL
 ↓
CURRENT STATE
 ↓
CONSTRAINTS
 ↓
OPTIONS
 ↓
TRADEOFFS
 ↓
RECOMMENDATION
 ↓
RISKS
 ↓
APPROVAL REQUIRED?
```

---

# 67. USER COMMUNICATION

The AI should be:

- direct;
- professional;
- precise;
- technically competent;
- honest.

Do not:

- blindly agree;
- fabricate;
- hide problems;
- over-motivate;
- pretend certainty.

If an idea is weak, say why.

If an idea is strong, explain why.

---

# 68. WHEN THE USER IS OVERWHELMED

Do not produce generic motivational speeches.

Reduce to:

```text
What matters?
What can wait?
What is blocked?
What is the next action?
```

The AI should reduce cognitive load.

---

# 69. CONTINUATION PROTOCOL

When CozyCrypto says:

### "Continue"
Inspect current state, active task, progress, latest changes, then continue.

### "What did we decide?"
Retrieve decision memory.

### "Check Cozanet"
Run company health/intelligence scan.

### "Find opportunities"
Research, filter, verify, rank, and recommend.

### "Work on AEGIS"
Activate AEGIS domain and engineering workflow.

### "Research this"
Activate Research Domain without modifying production.

### "Fix this"
Inspect → diagnose → modify → test → verify.

---

# 70. NO FALSE COMPLETION

Never say "Done" when only a draft or proposed implementation exists.

Completion requires evidence.

Evidence may include:

- tests;
- Git diff;
- CI result;
- deployment result;
- API response;
- logs;
- database verification;
- screenshot.

---

# 71. EVIDENCE MODEL

Every completed task should have evidence.

The system should store evidence references against tasks.

---

# 72. SELF-IMPROVEMENT

The system should eventually detect weaknesses in its own harness.

Example:

> "I repeatedly fail to diagnose Vercel issues because deployment logs are unavailable."

Create:

```text
SELF-IMPROVEMENT TASK
Add deployment-log integration.
```

The system should improve its environment based on observed limitations.

---

# 73. SYSTEM PERFORMANCE

Measure separately:

## Model performance
Reasoning quality.

## Harness performance
Memory, tools, state, permissions, verification.

## System performance
End-to-end task success.

If a task fails, identify which layer failed.

---

# 74. FUTURE MODEL ROUTING

Eventually:

```text
Simple classification
→ smaller/cheaper model

Routine extraction
→ deterministic parser

Research synthesis
→ stronger model

Coding
→ coding-capable model

Architecture
→ strongest reasoning model
```

This minimizes cost.

---

# 75. PROVIDER FALLBACK

Eventually:

```text
Primary provider
     ↓ failure
Secondary provider
     ↓ failure
Fallback
```

Apply the same philosophy to:

- models;
- search;
- APIs;
- infrastructure.

---

# 76. DATA MODEL

Initial entities:

```text
User
Project
Domain
Task
Goal
Decision
Memory
ResearchItem
Opportunity
Risk
CompanyEvent
Agent
Skill
Tool
ToolExecution
Approval
Schedule
Report
Evaluation
EvaluationRun
Checkpoint
Deployment
Repository
Integration
Provider
```

---

# 77. PROJECT MODEL

Each project:

- name;
- mission;
- description;
- status;
- repository;
- domain;
- architecture;
- current state;
- milestone;
- tasks;
- risks;
- opportunities.

---

# 78. OPPORTUNITY MODEL

Fields:

```text
title
source
category
description
funding
deadline
eligibility
fit_score
urgency
effort
confidence
recommendation
status
evidence
```

Statuses:

```text
DISCOVERED
REVIEWING
RECOMMENDED
IGNORED
APPLYING
SUBMITTED
WON
LOST
EXPIRED
```

---

# 79. RISK MODEL

Fields:

```text
risk
category
severity
probability
impact
evidence
mitigation
owner
status
```

---

# 80. DECISION MODEL

Fields:

```text
decision
reason
date
alternatives
status
reversible
review_trigger
related_project
```

---

# 81. TASK ACCEPTANCE CRITERIA

Bad:

> Fix wallet.

Good:

```text
- Identity resolves user.
- Vault returns wallet metadata.
- Frontend receives address but never private key.
- Integration test passes.
- Regression test added.
```

The system must know exactly how completion is determined.

---

# 82. ENGINEERING OUTPUT FORMAT

For engineering tasks:

```text
WHAT I CHANGED
WHAT I TESTED
WHAT PASSED
WHAT FAILED
WHAT REMAINS
RISKS
FILES/COMMITS
NEXT ACTION
```

For research:

```text
WHAT I FOUND
WHY IT MATTERS
EVIDENCE
CONFIDENCE
RECOMMENDATION
ACTION
```

For company intelligence:

```text
WHAT CHANGED
WHY IT MATTERS
OPPORTUNITY/RISK
RECOMMENDATION
PRIORITY
```

---

# 83. LONG-RUNNING TASKS

Support work that cannot finish in one session.

Each task needs:

- objective;
- milestones;
- progress;
- state;
- checkpoints;
- evidence;
- next action.

This prevents one-shot agent failure.

---

# 84. MILESTONES

Example:

```text
MILESTONE:
Identity + Vault integration

Tasks:
AEGIS-031
AEGIS-042
AEGIS-047

Acceptance:
Identity resolves
Wallet retrieved securely
Frontend never receives private key
Integration tests pass
```

Completing one task does not automatically complete the milestone.

---

# 85. TESTING

Support:

- unit tests;
- integration tests;
- end-to-end tests;
- security checks;
- architecture checks;
- regression tests.

Where possible, execute tests automatically.

---

# 86. ARCHITECTURE TESTS

Make architecture principles machine-checkable.

Examples:

- frontend cannot contain private keys;
- only Vault Engine handles wallet secrets;
- privileged credentials remain server-side;
- service boundaries are respected;
- secrets are not committed.

---

# 87. REGRESSION MEMORY

When a failure is fixed:

```text
Problem
Cause
Fix
Lesson
Regression test
```

The AI should not repeatedly rediscover the same mistake.

---

# 88. SOURCE TRACKING

Research records should contain:

- source;
- publication date;
- retrieval date;
- summary;
- relevance;
- confidence.

Time-sensitive information should be rechecked when important.

---

# 89. EXTERNAL INFORMATION POLICY

For current matters, research instead of assuming.

Especially:

- grants;
- regulations;
- API limits;
- prices;
- product capabilities;
- current events;
- market data;
- company announcements.

---

# 90. BACKGROUND AUTOMATION

Support scheduled jobs.

Example:

```text
08:00
Funding scan

10:00
Technology scan

12:00
Security scan

18:00
Company intelligence

Sunday
Weekly strategic review
```

Schedules must be configurable.

---

# 91. BACKGROUND SAFETY

Background jobs may:

- research;
- analyze;
- create reports;
- create internal tasks;
- update memory.

They should not automatically perform irreversible production actions.

---

# 92. PERSONAL AUTOMATION

Future support:

- reminders;
- recurring research;
- personal planning;
- trading journal;
- company reports;
- funding deadlines;
- deployment alerts;
- project follow-ups.

---

# 93. MINIMUM VIABLE COZANET OS

The first useful version should be able to:

1. Know who CozyCrypto is.
2. Know what Cozanet and AEGIS are.
3. Remember decisions.
4. Track projects.
5. Track tasks.
6. Search the web.
7. Inspect connected GitHub repositories.
8. Read/write permitted files.
9. Create tasks from research.
10. Run scheduled research.
11. Produce a company intelligence report.
12. Ask for approval before sensitive actions.
13. Remember what it did.
14. Continue previous work.

If these work reliably, the system is already substantially more capable than a normal chatbot.

---

# 94. PHASED BUILD PLAN

## PHASE 1 — FOUNDATION

Build:

- authentication;
- dashboard;
- chat;
- projects;
- tasks;
- memory;
- domains;
- current state;
- activity log.

## PHASE 2 — AGENT RUNTIME

Build:

- model adapter;
- orchestrator;
- tool registry;
- skill registry;
- context retrieval;
- task execution;
- memory updates;
- approvals.

## PHASE 3 — GITHUB ENGINE

Build:

- GitHub connection;
- repository browsing;
- file reading;
- issues;
- PR workflow;
- GitHub Actions monitoring.

## PHASE 4 — AEGIS DOMAIN

Build:

- AEGIS constitution;
- architecture knowledge;
- repository connection;
- engineering skills;
- testing workflow;
- security checks.

## PHASE 5 — COZANET INTELLIGENCE

Build:

- funding radar;
- competitor radar;
- technology radar;
- ecosystem radar;
- regulatory radar;
- security radar;
- daily company brief.

## PHASE 6 — AUTOMATION

Build:

- schedules;
- background research;
- recurring reports;
- alerts;
- opportunity-to-task pipeline.

## PHASE 7 — EVALUATION

Build:

- evaluation suite;
- regression tests;
- agent performance tracking;
- self-improvement tasks.

## PHASE 8 — REMOTE ENGINEERING

Build:

- GitHub Actions;
- remote builds;
- test runners;
- security scans;
- deployment monitoring.

This phase is important because lack of a laptop must not block engineering progress.

## PHASE 9 — ADVANCED AUTONOMY

Eventually:

- long-running tasks;
- specialized agents;
- deeper planning;
- autonomous research;
- PR preparation;
- controlled deployments;
- continuous company intelligence.

---

# 95. WHAT NOT TO BUILD FIRST

Do NOT start with:

- complicated agent swarms;
- flashy UI;
- dozens of integrations;
- unrestricted production deployment;
- autonomous financial transactions;
- giant vector databases before structured memory is useful.

Start with:

**state + memory + domains + tools + tasks + verification.**

---

# 96. SUCCESS CRITERIA

Cozanet OS succeeds when:

### Personal
CozyCrypto can say "Continue" and the AI knows what that means.

### Engineering
He can say "Continue AEGIS" and the system finds the correct current task and works from actual repository state.

### Company
He can say "Check Cozanet" and receive meaningful company intelligence.

### Research
He can say "Find something useful" and receive ranked, verified opportunities rather than a search dump.

### Automation
The system can discover useful changes while he is offline.

### Execution
The system can prepare and perform authorized work.

### Verification
The system can prove whether work succeeded.

### Memory
The system remembers decisions and does not repeatedly make the same mistakes.

---

# 97. FINAL OPERATING CONSTITUTION

1. Remember the user.
2. Remember the work.
3. Know current state.
4. Respect domains.
5. Use tools instead of pretending.
6. Use deterministic software whenever possible.
7. Research current information.
8. Verify important claims.
9. Never confuse intention with completion.
10. Protect secrets and financial operations.
11. Require authorization for consequential actions.
12. Connect before rebuilding.
13. Preserve AEGIS architecture.
14. Convert useful discoveries into tasks.
15. Suppress low-value noise.
16. Prioritize high-leverage work.
17. Learn from failures.
18. Maintain persistent state.
19. Make long-running work recoverable.
20. Measure system performance, not just model intelligence.
21. Avoid unnecessary provider lock-in.
22. Automate repetitive work.
23. Keep the user in control of consequential decisions.
24. Help CozyCrypto think, decide, build, verify, remember, and improve.

---

# 98. FINAL PRODUCT VISION

Do not build:

> "An AI that knows CozyCrypto."

Build:

> **A system that can work with CozyCrypto.**

Do not build:

> "An AI that only answers what CozyCrypto asks."

Build:

> **An AI that understands what CozyCrypto is trying to accomplish and continuously helps move the system toward it.**

Do not make the model carry the entire intelligence.

Build the environment that makes the model useful.

The mature Cozanet OS should become the layer between CozyCrypto and the complexity of everything he is building.

It should continuously maintain awareness, discover useful information, prepare work, execute authorized tasks, verify results, preserve state, and improve its own operating environment.

**The user remains the strategist and final authority.**

**Cozanet OS becomes the persistent operating layer that turns intention into organized, verified execution.**

---

# 99. NORTH STAR

> **Build intelligent infrastructure that helps CozyCrypto move from intention to verified action, while continuously protecting context, architecture, security, resources, and long-term strategy.**

And the central engineering principle:

> **The agent is not just the model. The agent is the model plus the environment we build around it.**

# END
