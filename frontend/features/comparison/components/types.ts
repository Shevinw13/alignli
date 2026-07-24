export interface CriterionScore {
  criterionId: string;
  category: string;
  label: string;
  rawScore: number;
  maxScore: number;
  reasoning: string;
}

export type DimensionKey =
  | "experience"
  | "technical_skills"
  | "leadership"
  | "education"
  | "projects"
  | "career_growth"
  | "job_stability"
  | "industry_knowledge"
  | "communication";

export interface ComparisonDimension {
  key: DimensionKey;
  label: string;
  value: string | null; // null means "no data"
}

export interface ComparisonCandidate {
  id: string;
  fullName: string;
  currentCompany: string | null;
  location: string | null;
  matchScore: number;
  confidenceLevel: "High" | "Medium" | "Low";
  criterionScores: CriterionScore[];
  dimensions: ComparisonDimension[];
}

export interface ComparisonSummaryData {
  summary: string;
  generatedAt: string;
}

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  experience: "Experience",
  technical_skills: "Technical Skills",
  leadership: "Leadership",
  education: "Education",
  projects: "Projects",
  career_growth: "Career Growth",
  job_stability: "Job Stability",
  industry_knowledge: "Industry Knowledge",
  communication: "Communication",
};

export const ALL_DIMENSION_KEYS: DimensionKey[] = [
  "experience",
  "technical_skills",
  "leadership",
  "education",
  "projects",
  "career_growth",
  "job_stability",
  "industry_knowledge",
  "communication",
];
