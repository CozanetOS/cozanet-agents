// ============================================================================
// CozanetOS Agent Framework — v0.2.0
// @cozanet/agents
// ============================================================================

// Core types & infrastructure
export * from './types';
export * from './base/BaseAgent';
export * from './AgentRegistry';
export * from './AgentOrchestrator';

// TaskRunner — visible command windows + background execution (v0.2.0 — new)
export * from './Runner/types';
export * from './Runner/TaskRunner';
export * from './Runner/AutonomousRunner';

// API Key Vault — secure credential management (v0.2.0 — new)
export * from './Vault/APIKeyVault';

// Core agents (v0.1.0 — upgraded)
export * from './CEO/CEOAgent';
export * from './Research/ResearchAgent';
export * from './Coding/CodingAgent';
export * from './Memory/MemoryAgent';
export * from './Planner/PlannerAgent';

// Extended agents (v0.2.0 — new)
export * from './Learning/LearningAgent';
export * from './Knowledge/KnowledgeAgent';
export * from './Browser/BrowserAgent';
export * from './Review/ReviewAgent';
export * from './Testing/TestingAgent';
export * from './Security/SecurityAgent';
export * from './Vision/VisionAgent';
export * from './CX7/CX7Agent';
export * from './Device/DeviceAgent';
export * from './API/APIAgent';
export * from './Workflow/WorkflowAgent';
export * from './Scheduler/SchedulerAgent';
export * from './Email/EmailAgent';
export * from './Documents/DocumentsAgent';
export * from './Voice/VoiceAgent';
export * from './Analytics/AnalyticsAgent';
export * from './Database/DatabaseAgent';
export * from './Integration/IntegrationAgent';

// Automation & worker system (v0.2.0 — new)
export * from './Automation/AutomationAgent';

// Master Context — user's durable operating context (v0.2.0 — new)
export * from './context/MasterContextLoader';
export * from './context/ContextManager';
export * from './context/ContextAwareAgent';

// Phase 2 — Agent Runtime components (v0.2.1 — new)
export * from './models/ModelAdapter';
export * from './models/types';
export * from './tools/ToolRegistry';
export * from './tools/types';
export * from './approvals/ApprovalManager';
export * from './approvals/types';
export * from './skills/SkillRegistry';
export * from './skills/types';

// Phase 3 — GitHub Engine (v0.2.2 — new)
export * from './GitHub/GitHubAgent';
export * from './GitHub/GitHubClient';
export * from './GitHub/types';

// Phase 4 — AEGIS Domain (v0.2.3 — new)
export * from './AEGIS/AegisConstitution';
export * from './AEGIS/AegisEngineer';
export * from './AEGIS/SecurityChecker';
export * from './AEGIS/types';

// Phase 5 — Cozanet Intelligence (v0.2.4 — new)
export * from './Intelligence/CozanetRadar';
export * from './Intelligence/DailyBriefGenerator';
export * from './Intelligence/types';

// Phase 6 — Automation (v0.2.5 — new)
export * from './Automation/OpportunityPipeline';
export * from './Automation/AutomationSchedules';
export * from './Automation/AlertService';
export * from './Automation/Phase6Types';
