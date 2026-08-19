// ── Cozanet Intelligence types ──────────────────────────────────────

export type RadarType =
  | 'funding'
  | 'competitor'
  | 'technology'
  | 'regulatory'
  | 'security'
  | 'ecosystem'
  | 'product';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type RegulatoryLevel = 'green' | 'yellow' | 'red';

export interface RadarFinding {
  id: string;
  radar: RadarType;
  title: string;
  description: string;
  url?: string;
  source?: string;
  severity: Severity;
  timestamp: number;
  tags: string[];
  metadata?: Record<string, any>;
}

export interface FundingOpportunity {
  id: string;
  name: string;
  provider: string;
  type: 'grant' | 'hackathon' | 'accelerator' | 'incubator' | 'investor' | 'ecosystem_fund' | 'program';
  amount?: string;
  currency?: string;
  deadline?: string;
  eligibility: string[];
  url?: string;
  relevance: 'high' | 'medium' | 'low';
  notes?: string;
  discoveredAt: number;
}

export interface CompetitorInfo {
  id: string;
  name: string;
  url?: string;
  description: string;
  category: string;
  fundingStage?: string;
  totalRaised?: string;
  keyProducts: string[];
  strengths: string[];
  weaknesses: string[];
  recentNews?: string[];
  lastUpdated: number;
}

export interface TechnologyEntry {
  id: string;
  name: string;
  category: 'AI' | 'payment' | 'blockchain' | 'identity' | 'database' | 'security' | 'deployment' | 'opensource';
  description: string;
  url?: string;
  costImpact?: 'cheaper' | 'faster' | 'safer' | 'more_capable' | 'neutral';
  relevance: 'high' | 'medium' | 'low';
  notes?: string;
  discoveredAt: number;
}

export interface RegulatoryUpdate {
  id: string;
  title: string;
  jurisdiction: string;
  category: 'crypto' | 'payment' | 'banking' | 'cross_border' | 'data_protection' | 'ai';
  description: string;
  impactLevel: RegulatoryLevel;
  affectedProducts: string[];
  url?: string;
  source?: string;
  publishedAt?: string;
  discoveredAt: number;
  notes?: string;
}

export interface SecurityAdvisory {
  id: string;
  title: string;
  severity: Severity;
  type: 'CVE' | 'dependency' | 'secret_exposure' | 'provider_advisory' | 'config_issue' | 'architecture_concern';
  affectedPackage?: string;
  affectedVersion?: string;
  cveId?: string;
  description: string;
  remediation: string;
  url?: string;
  discoveredAt: number;
}

export interface EcosystemUpdate {
  id: string;
  ecosystem: 'BNB Chain' | 'Stellar' | 'Soroban' | 'Ethereum' | 'Base' | 'Polygon' | 'other';
  title: string;
  type: 'builder_program' | 'partnership' | 'grant' | 'upgrade' | 'incident' | 'opportunity';
  description: string;
  url?: string;
  relevance: 'high' | 'medium' | 'low';
  discoveredAt: number;
}

export interface DailyBrief {
  date: string;
  criticalAlerts: RadarFinding[];
  fundingOpportunities: FundingOpportunity[];
  competitiveChanges: RadarFinding[];
  technologyChanges: RadarFinding[];
  regulatoryChanges: RegulatoryUpdate[];
  ecosystemUpdates: EcosystemUpdate[];
  productOpportunities: RadarFinding[];
  recommendedActions: string[];
  approvalItems: string[];
  generatedAt: number;
}

export interface RadarConfig {
  enabledRadars: RadarType[];
  scanInterval: number; // milliseconds
  autoAlertThreshold: Severity;
}
