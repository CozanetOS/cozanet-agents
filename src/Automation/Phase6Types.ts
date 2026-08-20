// ── Phase 6 — Automation types ─────────────────────────────────────

import { RadarFinding, FundingOpportunity } from '../Intelligence/types';

export type OpportunityStatus =
  | 'DISCOVERED'
  | 'REVIEWING'
  | 'RECOMMENDED'
  | 'IGNORED'
  | 'APPLYING'
  | 'SUBMITTED'
  | 'WON'
  | 'LOST'
  | 'EXPIRED';

export type OpportunityCategory =
  | 'funding'
  | 'partnership'
  | 'technology'
  | 'regulatory'
  | 'security'
  | 'market'
  | 'product';

export interface Opportunity {
  id: string;
  title: string;
  source: string;
  category: OpportunityCategory;
  description: string;
  funding?: string;
  deadline?: string;
  eligibility?: string[];
  fitScore: number;          // 0-100 — how well it fits Cozanet/AEGIS
  urgency: 'low' | 'medium' | 'high' | 'critical';
  effort: 'low' | 'medium' | 'high';
  confidence: number;         // 0-100 — confidence in the assessment
  recommendation: string;
  status: OpportunityStatus;
  evidence: string[];
  discoveredAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

export interface OpportunityTask {
  id: string;
  opportunityId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  assignee?: string;
  createdAt: number;
  metadata?: Record<string, any>;
}

export type ScheduleId =
  | 'daily_brief'
  | 'daily_funding_scan'
  | 'daily_security_scan'
  | 'daily_regulatory_scan'
  | 'daily_ecosystem_scan'
  | 'weekly_competitor_report'
  | 'weekly_technology_report'
  | 'monthly_progress_review';

export interface AutomationSchedule {
  id: ScheduleId;
  name: string;
  description: string;
  cron: string;
  agentId: string;
  taskType: string;
  input: Record<string, any>;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

export type AlertChannel = 'console' | 'email' | 'whatsapp' | 'telegram' | 'dashboard';

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  channels: AlertChannel[];
  createdAt: number;
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

export interface BackgroundResearchJob {
  id: string;
  query: string;
  category: OpportunityCategory;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results?: RadarFinding[];
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
}
