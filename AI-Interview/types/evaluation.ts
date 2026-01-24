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
  name: string;
  score: number; // 0-100
  comment: string;
}

export interface EvaluationScore {
  totalScore: number; // 0-100
  categoryScores: CategoryScore[];
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  timestamp: string;
}

export interface DecisionResult {
  status: "pass" | "fail";
  finalScore: number;
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
