// Evaluation Input Types
export interface InterviewMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export interface InterviewMetadata {
  duration?: number; // in seconds
  role?: string; // e.g., "Software Engineer", "Data Scientist"
  domain?: string; // e.g., "Backend", "Frontend", "ML"
  emotionData?: {
    dominant?: string;
    confidence?: number;
  }[];
  voiceConfidence?: number[];
}

export interface InterviewInput {
  transcript: InterviewMessage[];
  metadata?: InterviewMetadata;
  userId: string;
  interviewId: string;
}

// Evaluation Output Types
export interface CategoryScore {
  category: string;
  score: number; // 0-100
  weight: number; // percentage
  reasoning: string;
}

export interface EvaluationScore {
  overall: number; // 0-100 (weighted average)
  categories: CategoryScore[];
  brief_reasoning: string;
  timestamp: string;
}

export interface DecisionResult {
  status: "pass" | "fail";
  final_score: number;
  decision_timestamp: string;
  evaluation: EvaluationScore;
}

// Evaluation State
export enum EvaluationState {
  IDLE = "IDLE",
  ANALYZING = "ANALYZING",
  SCORING = "SCORING",
  DECIDING = "DECIDING",
  COMPLETE = "COMPLETE",
  FAILED = "FAILED",
}

export interface EvaluationProgress {
  state: EvaluationState;
  message: string;
  currentScore?: number;
}
