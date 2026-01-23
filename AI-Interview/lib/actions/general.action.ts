"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";
import { ethers } from "ethers";

import StakeContract from "../contracts/InterviewStake.json";

export async function rewardUser(wallet: string) {

  const provider = new ethers.JsonRpcProvider(
    process.env.MONAD_RPC
  );

  const walletSigner = new ethers.Wallet(
    process.env.ADMIN_KEY!,
    provider
  );

  const contract = new ethers.Contract(
    process.env.STAKE_ADDRESS!,
    StakeContract.abi,
    walletSigner
  );

  await contract.reward(wallet);
}


export async function createFeedback(params: CreateFeedbackParams) {
    const { interviewId, userId, transcript, feedbackId } = params;

    console.log("createFeedback called", {
        interviewId,
        userId,
        transcriptLength: transcript?.length,
    });

    if (!transcript || transcript.length < 5) {
        console.warn(
            "Transcript is empty or too short. Skipping AI generation.",
        );
        return { success: false, message: "No transcript available" };
    }

    try {
        const formattedTranscript = transcript
            .map(
                (sentence: { role: string; content: string }) =>
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
            - areasForImprovement as a single paragraph (no bullets)
            - finalAssessment as a paragraph

            Transcript:
            ${formattedTranscript}
            `,

            system: "You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories",
        });

        const feedback = {
            interviewId,
            userId,
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
            createdAt: new Date().toISOString(),
        };

        let feedbackRef;

        if (feedbackId) {
            feedbackRef = db.collection("feedback").doc(feedbackId);
        } else {
            feedbackRef = db.collection("feedback").doc();
        }

        await feedbackRef.set(feedback);

        // ---------------- REWARD LOGIC ----------------

        const PASS_SCORE = 65;
        const finalScore = object.totalScore;

        // Get user's wallet from DB
        const userDoc = await db.collection("users").doc(userId).get();

        const userData = userDoc.data();

        if (userData?.wallet && finalScore >= PASS_SCORE) {
            await rewardUser(userData.wallet);
        }

        // Ensure interview document exists so it can be queried on the home page
        const interviewRef = db.collection("interviews").doc(interviewId);
        const interviewDoc = await interviewRef.get();

        if (!interviewDoc.exists) {
            // Create interview document if it doesn't exist
            await interviewRef.set({
                userId: userId,
                role: "Mock Interview", // Default role, can be updated later
                type: "Practice",
                level: "General",
                techstack: [],
                questions: [],
                finalized: true,
                createdAt: new Date().toISOString(),
            });
        } else {
            // Update interview to ensure it's finalized and has userId
            const existingData = interviewDoc.data();
            await interviewRef.set(
                {
                    ...existingData,
                    userId: userId,
                    finalized: true,
                },
                { merge: true },
            );
        }

        return { success: true, feedbackId: feedbackRef.id };
    } catch (error) {
        console.error("Error saving feedback:", error);
        return { success: false };
    }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
    if (!id) return null;

    try {
        const docSnap = await db.collection("interviews").doc(id).get();

        if (!docSnap.exists) {
            return null;
        }

        const data = docSnap.data();
        if (!data) {
            return null;
        }

        return {
            id: docSnap.id,
            ...data,
        } as Interview;
    } catch (error) {
        console.error("Error fetching interview by ID:", error);
        return null;
    }
}

export async function getFeedbackByInterviewId(
    params: GetFeedbackByInterviewIdParams,
): Promise<Feedback | null> {
    const { interviewId, userId } = params;

    const querySnapshot = await db
        .collection("feedback")
        .where("interviewId", "==", interviewId)
        .where("userId", "==", userId)
        .limit(1)
        .get();

    if (querySnapshot.empty) return null;

    const feedbackDoc = querySnapshot.docs[0];
    return { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
}

export async function getLatestInterviews(
    params: GetLatestInterviewsParams,
): Promise<Interview[] | null> {
    const { userId, limit = 20 } = params;

    const interviews = await db
        .collection("interviews")
        .where("finalized", "==", true)
        .where("visibility", "==", "public")
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

    return interviews.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Interview[];
}

export async function getInterviewsByUserId(
    userId: string,
): Promise<Interview[] | null> {
    if (!userId) return null;

    try {
        const interviews = await db
            .collection("interviews")
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .get();

        if (interviews.empty) return [];

        return interviews.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Interview[];
    } catch (error) {
        console.error("Error fetching interviews by user ID:", error);
        return null;
    }
}
