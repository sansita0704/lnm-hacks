"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { feedbackSchema } from "@/constants";
import { InterviewInput, EvaluationScore } from "@/types/evaluation";

/**
 * Server action to evaluate interview using Gemini-2.5-flash
 * Ensures consistency with the platform's feedback page
 */
export async function evaluateInterviewAction(input: InterviewInput): Promise<EvaluationScore> {
    const { transcript } = input;

    if (!transcript || transcript.length < 5) {
        throw new Error("Transcript is too short for evaluation");
    }

    try {
        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            console.error("❌ GOOGLE_GENERATIVE_AI_API_KEY is missing in environment");
            throw new Error("API Key configuration error");
        }

        const formattedTranscript = transcript
            .map(
                (sentence) =>
                    `- ${sentence.role}: ${sentence.content}\n`,
            )
            .join("");

        const { object } = await generateObject({
            model: google("gemini-2.5-flash"),
            schema: feedbackSchema,
            prompt: `
            Analyze the interview transcript below.
            
            Return:
            - All scores as numbers between 0 and 100
            - Each comment as a paragraph
            - strengths as a list of strings (3-5 bullet points)
            - areasForImprovement as a list of strings
            - finalAssessment as a paragraph
            
            Transcript:
            ${formattedTranscript}
            `,
            system: "You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories.",
        });

        // Map feedbackSchema result to EvaluationScore format
        return {
            totalScore: object.totalScore,
            categoryScores: [
                {
                    name: "Communication Skills",
                    score: object.communicationSkillsScore,
                    comment: object.communicationSkillsComment,
                },
                {
                    name: "Technical Knowledge",
                    score: object.technicalKnowledgeScore,
                    comment: object.technicalKnowledgeComment,
                },
                {
                    name: "Problem Solving",
                    score: object.problemSolvingScore,
                    comment: object.problemSolvingComment,
                },
                {
                    name: "Cultural Fit",
                    score: object.culturalFitScore,
                    comment: object.culturalFitComment,
                },
                {
                    name: "Confidence and Clarity",
                    score: object.confidenceAndClarityScore,
                    comment: object.confidenceAndClarityComment,
                },
            ],
            strengths: object.strengths,
            areasForImprovement: object.areasForImprovement,
            finalAssessment: object.finalAssessment,
            timestamp: new Date().toISOString(),
        };
    } catch (error: any) {
        const errorDetails = {
            message: error.message,
            name: error.name,
            statusCode: error.statusCode,
            data: error.data
        };
        console.error("❌ AI Evaluation Details Error:", errorDetails);
        throw new Error(`AI Evaluation failed: ${error.message || "Unknown error"}. Status: ${error.statusCode || "N/A"}`);
    }
}
