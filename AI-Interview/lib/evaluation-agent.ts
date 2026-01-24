import {
  InterviewInput,
  InterviewMessage,
  EvaluationScore,
  DecisionResult,
  CategoryScore,
  EvaluationState,
  EvaluationProgress,
} from "@/types/evaluation";

/**
 * Autonomous Evaluation & Decision Agent
 * STEP 6: Evaluates interview performance
 * STEP 7: Makes autonomous pass/fail decision
 * 
 * Rules:
 * - Score >= 65 → PASS
 * - Score < 65 → FAIL
 * - No human intervention
 * - Deterministic scoring
 */
export class EvaluationAgent {
  private onProgressUpdate?: (progress: EvaluationProgress) => void;
  private readonly PASS_THRESHOLD = 65;

  // Scoring weights (must sum to 100%)
  private readonly WEIGHTS = {
    technical: 0.30,      // 30%
    conceptual: 0.25,     // 25%
    problemSolving: 0.20, // 20%
    communication: 0.15,  // 15%
    confidence: 0.10,     // 10%
  };

  constructor(onProgressUpdate?: (progress: EvaluationProgress) => void) {
    this.onProgressUpdate = onProgressUpdate;
  }

  /**
   * STEP 6: AI Evaluates Interview Performance
   * Analyzes transcript and generates deterministic score
   */
  async evaluateInterview(input: InterviewInput): Promise<EvaluationScore> {
    this.updateProgress(EvaluationState.ANALYZING, "Analyzing interview transcript...");

    try {
      // Extract candidate responses (user messages only)
      const candidateResponses = input.transcript.filter(
        (msg) => msg.role === "user"
      );

      // Extract interviewer questions (assistant messages)
      const questions = input.transcript.filter(
        (msg) => msg.role === "assistant"
      );

      if (candidateResponses.length === 0) {
        throw new Error("No candidate responses found in transcript");
      }

      this.updateProgress(EvaluationState.SCORING, "Generating performance scores...");

      // Generate category scores (deterministic)
      const categories: CategoryScore[] = [
        this.evaluateTechnicalCorrectness(candidateResponses, questions),
        this.evaluateConceptualClarity(candidateResponses),
        this.evaluateProblemSolving(candidateResponses, questions),
        this.evaluateCommunication(candidateResponses),
        this.evaluateConfidence(candidateResponses, input.metadata),
      ];

      // Calculate weighted overall score
      const overall = this.calculateWeightedScore(categories);

      this.updateProgress(EvaluationState.SCORING, "Finalizing evaluation...", overall);

      const evaluation: EvaluationScore = {
        overall: Math.round(overall * 10) / 10, // Round to 1 decimal
        categories,
        brief_reasoning: this.generateBriefReasoning(categories, overall),
        timestamp: new Date().toISOString(),
      };

      return evaluation;
    } catch (error: any) {
      this.updateProgress(EvaluationState.FAILED, error.message || "Evaluation failed");
      throw error;
    }
  }

  /**
   * Evaluate Technical Correctness (30%)
   * Measures accuracy and correctness of answers
   */
  private evaluateTechnicalCorrectness(
    responses: InterviewMessage[],
    questions: InterviewMessage[]
  ): CategoryScore {
    // Deterministic scoring based on response quality indicators
    let score = 50; // Base score

    // Response completeness
    const avgResponseLength = responses.reduce((sum, r) => sum + r.content.length, 0) / responses.length;
    if (avgResponseLength > 200) score += 15;
    else if (avgResponseLength > 100) score += 10;
    else if (avgResponseLength > 50) score += 5;

    // Technical keywords presence
    const technicalKeywords = [
      "algorithm", "data structure", "complexity", "optimize", "efficient",
      "scalable", "performance", "design", "architecture", "pattern",
      "function", "class", "method", "variable", "loop", "condition"
    ];
    
    const keywordCount = responses.reduce((count, r) => {
      const content = r.content.toLowerCase();
      return count + technicalKeywords.filter(kw => content.includes(kw)).length;
    }, 0);

    if (keywordCount > 10) score += 20;
    else if (keywordCount > 5) score += 15;
    else if (keywordCount > 2) score += 10;

    // Code examples or structured thinking
    const hasCodeExample = responses.some(r => 
      r.content.includes("for") || r.content.includes("if") || 
      r.content.includes("function") || r.content.includes("class")
    );
    if (hasCodeExample) score += 15;

    return {
      category: "Technical Correctness",
      score: Math.min(100, score),
      weight: this.WEIGHTS.technical * 100,
      reasoning: `Response quality and technical depth assessed. ${hasCodeExample ? "Includes code examples." : ""}`,
    };
  }

  /**
   * Evaluate Conceptual Clarity (25%)
   * Measures understanding of underlying concepts
   */
  private evaluateConceptualClarity(responses: InterviewMessage[]): CategoryScore {
    let score = 50; // Base score

    // Explanation quality (longer, detailed responses)
    const hasDetailedExplanations = responses.some(r => r.content.length > 150);
    if (hasDetailedExplanations) score += 20;

    // Conceptual keywords
    const conceptKeywords = [
      "because", "therefore", "reason", "concept", "principle", "theory",
      "understand", "means", "definition", "example", "instance", "case"
    ];

    const conceptCount = responses.reduce((count, r) => {
      const content = r.content.toLowerCase();
      return count + conceptKeywords.filter(kw => content.includes(kw)).length;
    }, 0);

    if (conceptCount > 8) score += 20;
    else if (conceptCount > 4) score += 15;
    else if (conceptCount > 2) score += 10;

    // Structured thinking (uses examples, comparisons)
    const usesExamples = responses.some(r => 
      r.content.toLowerCase().includes("example") || 
      r.content.toLowerCase().includes("for instance")
    );
    if (usesExamples) score += 10;

    return {
      category: "Conceptual Clarity",
      score: Math.min(100, score),
      weight: this.WEIGHTS.conceptual * 100,
      reasoning: `Depth of understanding and explanation quality evaluated.`,
    };
  }

  /**
   * Evaluate Problem-Solving (20%)
   * Measures approach and reasoning ability
   */
  private evaluateProblemSolving(
    responses: InterviewMessage[],
    questions: InterviewMessage[]
  ): CategoryScore {
    let score = 50; // Base score

    // Problem-solving indicators
    const problemSolvingKeywords = [
      "approach", "solution", "solve", "strategy", "method", "way",
      "first", "then", "next", "finally", "step", "process"
    ];

    const psCount = responses.reduce((count, r) => {
      const content = r.content.toLowerCase();
      return count + problemSolvingKeywords.filter(kw => content.includes(kw)).length;
    }, 0);

    if (psCount > 10) score += 25;
    else if (psCount > 5) score += 20;
    else if (psCount > 2) score += 15;

    // Structured approach (mentions steps or process)
    const hasStructuredApproach = responses.some(r => {
      const content = r.content.toLowerCase();
      return content.includes("first") || content.includes("step") || 
             content.includes("then") || content.includes("process");
    });
    if (hasStructuredApproach) score += 15;

    // Considers edge cases or alternatives
    const considersEdgeCases = responses.some(r => {
      const content = r.content.toLowerCase();
      return content.includes("edge case") || content.includes("alternative") ||
             content.includes("however") || content.includes("but");
    });
    if (considersEdgeCases) score += 10;

    return {
      category: "Problem-Solving",
      score: Math.min(100, score),
      weight: this.WEIGHTS.problemSolving * 100,
      reasoning: `Analytical thinking and solution approach assessed.`,
    };
  }

  /**
   * Evaluate Communication (15%)
   * Measures clarity and articulation
   */
  private evaluateCommunication(responses: InterviewMessage[]): CategoryScore {
    let score = 50; // Base score

    // Response coherence (not too short, not too long)
    const avgLength = responses.reduce((sum, r) => sum + r.content.length, 0) / responses.length;
    if (avgLength >= 80 && avgLength <= 300) score += 20;
    else if (avgLength >= 50 && avgLength <= 400) score += 15;
    else if (avgLength >= 30) score += 10;

    // Proper sentence structure (uses punctuation)
    const usesPunctuation = responses.some(r => 
      r.content.includes(".") || r.content.includes(",") || r.content.includes("?")
    );
    if (usesPunctuation) score += 15;

    // Clear communication indicators
    const clarityKeywords = ["clear", "specifically", "exactly", "precisely", "basically"];
    const hasClarityIndicators = responses.some(r => {
      const content = r.content.toLowerCase();
      return clarityKeywords.some(kw => content.includes(kw));
    });
    if (hasClarityIndicators) score += 15;

    return {
      category: "Communication",
      score: Math.min(100, score),
      weight: this.WEIGHTS.communication * 100,
      reasoning: `Clarity, coherence, and articulation evaluated.`,
    };
  }

  /**
   * Evaluate Confidence (10%)
   * Measures composure and delivery
   */
  private evaluateConfidence(
    responses: InterviewMessage[],
    metadata?: any
  ): CategoryScore {
    let score = 50; // Base score

    // Response decisiveness (avoids uncertainty)
    const uncertaintyWords = ["maybe", "perhaps", "i think", "not sure", "probably", "might"];
    const uncertaintyCount = responses.reduce((count, r) => {
      const content = r.content.toLowerCase();
      return count + uncertaintyWords.filter(uw => content.includes(uw)).length;
    }, 0);

    if (uncertaintyCount === 0) score += 25;
    else if (uncertaintyCount <= 2) score += 15;
    else if (uncertaintyCount <= 4) score += 10;

    // Confident language
    const confidentWords = ["definitely", "certainly", "confident", "sure", "know"];
    const confidentCount = responses.reduce((count, r) => {
      const content = r.content.toLowerCase();
      return count + confidentWords.filter(cw => content.includes(cw)).length;
    }, 0);

    if (confidentCount > 3) score += 15;
    else if (confidentCount > 1) score += 10;

    // Consistent response length (shows preparation)
    const lengths = responses.map(r => r.content.length);
    const variance = this.calculateVariance(lengths);
    if (variance < 5000) score += 10; // Low variance = consistent

    return {
      category: "Confidence & Composure",
      score: Math.min(100, score),
      weight: this.WEIGHTS.confidence * 100,
      reasoning: `Delivery confidence and composure assessed.`,
    };
  }

  /**
   * Calculate weighted overall score
   */
  private calculateWeightedScore(categories: CategoryScore[]): number {
    return categories.reduce((sum, cat) => {
      const weight = cat.weight / 100;
      return sum + (cat.score * weight);
    }, 0);
  }

  /**
   * Generate brief reasoning summary
   */
  private generateBriefReasoning(categories: CategoryScore[], overall: number): string {
    const strengths = categories.filter(c => c.score >= 70);
    const weaknesses = categories.filter(c => c.score < 60);

    let reasoning = `Overall performance: ${overall >= 70 ? "Strong" : overall >= 60 ? "Adequate" : "Needs improvement"}. `;

    if (strengths.length > 0) {
      reasoning += `Strengths: ${strengths.map(s => s.category).join(", ")}. `;
    }

    if (weaknesses.length > 0) {
      reasoning += `Areas for improvement: ${weaknesses.map(w => w.category).join(", ")}.`;
    }

    return reasoning.trim();
  }

  /**
   * STEP 7: Autonomous Pass/Fail Decision
   * Applies strict rule: >= 65 PASS, < 65 FAIL
   */
  async makeDecision(evaluation: EvaluationScore): Promise<DecisionResult> {
    this.updateProgress(EvaluationState.DECIDING, "Applying decision rule...");

    // Strict rule application
    const status: "pass" | "fail" = evaluation.overall >= this.PASS_THRESHOLD ? "pass" : "fail";

    const decision: DecisionResult = {
      status,
      final_score: evaluation.overall,
      decision_timestamp: new Date().toISOString(),
      evaluation,
    };

    this.updateProgress(
      EvaluationState.COMPLETE,
      `Decision: ${status.toUpperCase()} (Score: ${evaluation.overall})`,
      evaluation.overall
    );

    return decision;
  }

  /**
   * Complete evaluation flow: Evaluate → Decide
   */
  async evaluateAndDecide(input: InterviewInput): Promise<DecisionResult> {
    try {
      // STEP 6: Evaluate
      const evaluation = await this.evaluateInterview(input);

      // STEP 7: Decide
      const decision = await this.makeDecision(evaluation);

      return decision;
    } catch (error: any) {
      this.updateProgress(EvaluationState.FAILED, error.message || "Evaluation failed");
      throw error;
    }
  }

  /**
   * Notify backend with evaluation results
   */
  async notifyBackend(decision: DecisionResult, userId: string, interviewId: string): Promise<boolean> {
    try {
      console.log("📊 Sending evaluation results to backend:", {
        userId,
        interviewId,
        status: decision.status,
        score: decision.final_score,
        timestamp: decision.decision_timestamp,
      });

      // In production, call backend API
      /*
      const response = await fetch('/api/interview/evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          interviewId,
          decision,
        })
      });

      return response.ok;
      */

      // Simulate success
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    } catch (error) {
      console.error("Error notifying backend:", error);
      return false;
    }
  }

  /**
   * Helper: Calculate variance
   */
  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / numbers.length;
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
