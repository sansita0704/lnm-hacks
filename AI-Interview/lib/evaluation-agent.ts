import {
  InterviewInput,
  EvaluationScore,
  DecisionResult,
  EvaluationState,
  EvaluationProgress,
} from "@/types/evaluation";
import { evaluateInterviewAction } from "./actions/evaluation.action";

/**
 * Autonomous Evaluation & Decision Agent
 * STEP 6: Evaluates interview performance via AI
 * STEP 7: Makes autonomous pass/fail decision
 * 
 * Rules:
 * - Score >= 65 → PASS
 * - Score < 65 → FAIL
 * - Matches platform scoring logic
 */
export class EvaluationAgent {
  private onProgressUpdate?: (progress: EvaluationProgress) => void;
  private readonly PASS_THRESHOLD = 65;

  constructor(onProgressUpdate?: (progress: EvaluationProgress) => void) {
    this.onProgressUpdate = onProgressUpdate;
  }

  /**
   * STEP 6: AI Evaluates Interview Performance
   * Calls server action for professional AI evaluation matching the platform
   */
  async evaluateInterview(input: InterviewInput): Promise<EvaluationScore> {
    this.updateProgress(EvaluationState.ANALYZING, "Analyzing interview with professional AI...");

    try {
      // Call server-side professional evaluation
      const evaluation = await evaluateInterviewAction(input);

      this.updateProgress(EvaluationState.SCORING, "Evaluation finalized", evaluation.totalScore);
      
      return evaluation;
    } catch (error: any) {
      console.error("EvaluationAgent error:", error);
      this.updateProgress(EvaluationState.FAILED, error.message || "Evaluation failed");
      throw error;
    }
  }

  /**
   * STEP 7: Autonomous Pass/Fail Decision
   * Applies strict rule: >= 65 PASS, < 65 FAIL
   */
  async makeDecision(evaluation: EvaluationScore): Promise<DecisionResult> {
    this.updateProgress(EvaluationState.DECIDING, "Applying autonomous decision rule...");

    // STRICT RULE: PASS if score >= threshold
    const status: "pass" | "fail" = evaluation.totalScore >= this.PASS_THRESHOLD ? "pass" : "fail";

    const decision: DecisionResult = {
      status,
      finalScore: evaluation.totalScore,
      decision_timestamp: new Date().toISOString(),
      evaluation,
    };

    this.updateProgress(
      EvaluationState.COMPLETE,
      `Verdict: ${status.toUpperCase()} (Score: ${evaluation.totalScore})`,
      evaluation.totalScore
    );

    return decision;
  }

  /**
   * Complete evaluation flow: AI Evaluate → Autonomous Decision
   */
  async evaluateAndDecide(input: InterviewInput): Promise<DecisionResult> {
    try {
      // Analyze and score
      const evaluation = await this.evaluateInterview(input);

      // Apply decision rule
      const decision = await this.makeDecision(evaluation);

      return decision;
    } catch (error: any) {
      this.updateProgress(EvaluationState.FAILED, error.message || "Evaluation flow failed");
      throw error;
    }
  }

  /**
   * Notify backend with evaluation results
   */
  async notifyBackend(decision: DecisionResult, userId: string, interviewId: string): Promise<boolean> {
    try {
      console.log("📊 Notifying backend of autonomous decision:", {
        userId,
        interviewId,
        status: decision.status,
        score: decision.finalScore,
      });

      // Simulation of secure reporting
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    } catch (error) {
      console.error("Reporting error:", error);
      return false;
    }
  }

  private updateProgress(state: EvaluationState, message: string, currentScore?: number) {
    if (this.onProgressUpdate) {
      this.onProgressUpdate({ state, message, currentScore });
    }
  }
}

/**
 * Helper function to create evaluation agent
 */
export function createEvaluationAgent(
  onProgressUpdate?: (progress: EvaluationProgress) => void
): EvaluationAgent {
  return new EvaluationAgent(onProgressUpdate);
}
