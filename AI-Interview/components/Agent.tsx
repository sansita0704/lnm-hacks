"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import EmotionMonitor from "@/components/EmotionMonitor";
import PaymentModal from "@/components/PaymentModal";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { createFeedback } from "@/lib/actions/general.action";
import Video from "./Video";

import { saveUserWallet } from "@/lib/actions/user.action";
import { ethers } from "ethers";
import { createPaymentAgent } from "@/lib/payment-agent";
import { PaymentState, PaymentProgress } from "@/types/payment";
import { createEvaluationAgent } from "@/lib/evaluation-agent";
import { EvaluationState, DecisionResult } from "@/types/evaluation";
import { createSettlementAgent } from "@/lib/settlement-agent";
import { SettlementState, SettlementProgress } from "@/types/settlement";

// --- Types (Add these if not imported) ---
interface AgentProps {
    userName: string;
    userId: string | undefined;
    interviewId: string;
    feedbackId?: string;
    type: "generate" | "interview";
    questions?: string[];
}

// Vapi Message Type Definition (Simplified)
interface VapiMessage {
    type: string;
    role: "user" | "system" | "assistant";
    transcriptType?: "final" | "partial";
    transcript: string;
    conversation?: { role: string; content: string }[];
}

enum CallStatus {
    INACTIVE = "INACTIVE",
    CONNECTING = "CONNECTING",
    ACTIVE = "ACTIVE",
    FINISHED = "FINISHED",
}

interface SavedMessage {
    role: "user" | "system" | "assistant";
    content: string;
}

const Agent = ({
    userName,
    userId,
    interviewId,
    feedbackId,
    type,
    questions,
}: AgentProps) => {
    const router = useRouter();
    const [callStatus, setCallStatus] = useState<CallStatus>(
        CallStatus.INACTIVE,
    );
    const [messages, setMessages] = useState<SavedMessage[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [lastMessage, setLastMessage] = useState<string>("");

    const [currentTranscript, setCurrentTranscript] = useState<string>("");
    const [finalTranscriptReady, setFinalTranscriptReady] = useState(false);
    const [userWallet, setUserWallet] = useState<string | null>(null);

    // Payment Agent State
    const [paymentProgress, setPaymentProgress] = useState<PaymentProgress>({
        state: PaymentState.IDLE,
        message: "",
    });
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Evaluation State
    const [evaluationResult, setEvaluationResult] = useState<DecisionResult | null>(null);

    // Settlement State
    const [settlementProgress, setSettlementProgress] = useState<SettlementProgress>({
        state: SettlementState.IDLE,
        message: "",
    });

    // Ref to prevent duplicate submissions on effect re-runs
    const processingFeedback = useRef(false);

    // 1. Memoize event handlers to prevent stale closures if used inside Effect
    const onCallStart = useCallback(() => setCallStatus(CallStatus.ACTIVE), []);
    const onCallEnd = useCallback(() => setCallStatus(CallStatus.FINISHED), []);

    const onMessage = useCallback((message: VapiMessage) => {
        if (message.type === "conversation-update" && message.conversation) {
            setMessages((prev) => {
                const merged = [...prev];

                message.conversation?.forEach((msg) => {
                    const exists = merged.some(
                        (m) => m.role === msg.role && m.content === msg.content,
                    );
                    if (!exists) {
                        merged.push(msg as SavedMessage);
                    }
                });

                return merged;
            });
        }

        if (message.type === "transcript") {
            setCurrentTranscript(message.transcript);

            if (message.transcriptType === "final") {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: message.role,
                        content: message.transcript,
                    },
                ]);
            }
        }
    }, []);

    const onSpeechStart = useCallback(() => setIsSpeaking(true), []);
    const onSpeechEnd = useCallback(() => setIsSpeaking(false), []);

    const onError = useCallback((error: any) => {
        // specific Vapi error handling logic
        console.warn("VAPI Error:", error);
        setCallStatus(CallStatus.INACTIVE);
    }, []);

    // 2. Setup Vapi Listeners
    useEffect(() => {
        vapi.on("call-start", onCallStart);
        vapi.on("call-end", onCallEnd);
        vapi.on("message", onMessage);
        vapi.on("speech-start", onSpeechStart);
        vapi.on("speech-end", onSpeechEnd);
        vapi.on("error", onError);

        return () => {
            vapi.off("call-start", onCallStart);
            vapi.off("call-end", onCallEnd);
            vapi.off("message", onMessage);
            vapi.off("speech-start", onSpeechStart);
            vapi.off("speech-end", onSpeechEnd);
            vapi.off("error", onError);
        };
    }, [
        onCallStart,
        onCallEnd,
        onMessage,
        onSpeechStart,
        onSpeechEnd,
        onError,
    ]);

    // 3. Update last message safely
    useEffect(() => {
        if (messages.length > 0) {
            setLastMessage(messages[messages.length - 1].content);
        }
    }, [messages]);

    // 4. Handle End of Call Logic (Separated to avoid race conditions)
    useEffect(() => {
        if (callStatus !== CallStatus.FINISHED) return;
        if (processingFeedback.current) return;

        const timeout = setTimeout(async () => {
            processingFeedback.current = true;

            console.log("FINAL transcript length:", messages.length);

            if (messages.length < 5) {
                console.warn("Transcript still too short, retrying...");
                processingFeedback.current = false;
                return;
            }

            try {
                // STEP 6 & 7: Autonomous Evaluation and Decision
                console.log("🤖 Starting autonomous evaluation...");
                
                const evaluationAgent = createEvaluationAgent();
                
                const decision = await evaluationAgent.evaluateAndDecide({
                    transcript: messages,
                    userId: userId!,
                    interviewId,
                    metadata: {
                        duration: Math.floor((Date.now() - Date.now()) / 1000), // Placeholder
                    },
                });

                console.log("✅ Evaluation complete:", {
                    status: decision.status,
                    score: decision.finalScore,
                    categories: decision.evaluation.categoryScores.map(c => `${c.name}: ${c.score}`),
                });

                // Store evaluation result
                setEvaluationResult(decision);

                // Notify backend
                await evaluationAgent.notifyBackend(decision, userId!, interviewId);

                // Create feedback with evaluation
                const { success, feedbackId: id } = await createFeedback({
                    interviewId,
                    userId: userId!,
                    transcript: messages,
                    feedbackId,
                }, decision.evaluation);

                // STEP 8: Autonomous Settlement
                if (success && userWallet) {
                    console.log("💰 Starting autonomous settlement agent...");
                    const settlementAgent = createSettlementAgent((progress) => {
                        setSettlementProgress(progress);
                        console.log(`[Settlement] ${progress.state}: ${progress.message}`);
                    });

                    // Trigger settlement (refund or slash)
                    // This runs autonomously in the background
                    settlementAgent.settle({
                        walletAddress: userWallet,
                        finalScore: decision.finalScore,
                        status: decision.status,
                        escrowContractAddress: process.env.NEXT_PUBLIC_STAKE_ADDRESS!,
                        stakedAmount: "0.5",
                        adminWalletAddress: process.env.NEXT_PUBLIC_ADMIN_WALLET || "", // Fallback
                        interviewId: interviewId,
                        userId: userId!,
                    }).then((result) => {
                        console.log("✅ Settlement finalized:", result);
                    }).catch((error) => {
                        console.error("❌ Settlement agent failed:", error);
                    });
                }

                if (success && id) {
                    {
                        router.push(`/interview/${interviewId}/feedback`);
                    }
                } else {
                    router.push("/");
                }
            } catch (err) {
                console.error(err);
                router.push("/");
            }
        }, 2000); // ⬅️ wait 2 seconds for final transcripts

        return () => clearTimeout(timeout);
    }, [callStatus, messages]);

    const handleCall = async () => {
        setCallStatus(CallStatus.CONNECTING);

        try {
            // Request microphone access
            await navigator.mediaDevices.getUserMedia({ audio: true });

            // Get wallet and save it
            if (!window.ethereum) {
                throw new Error("MetaMask is required to continue.");
            }
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const wallet = await signer.getAddress();
            setUserWallet(wallet);
            await saveUserWallet(userId!, wallet);

            // Create payment agent with progress callback
            /* 
            const paymentAgent = createPaymentAgent((progress) => {
                setPaymentProgress(progress);
                
                // Show modal for payment states
                if (
                    progress.state === PaymentState.PAYMENT_REQUIRED ||
                    progress.state === PaymentState.APPROVING ||
                    progress.state === PaymentState.PROCESSING ||
                    progress.state === PaymentState.VERIFYING
                ) {
                    setShowPaymentModal(true);
                }
            });

            // Execute autonomous payment flow
            const paymentResult = await paymentAgent.handlePaymentFlow(userId!);

            // Handle payment result
            if (!paymentResult.success) {
                if (paymentResult.state === PaymentState.REJECTED) {
                    // User rejected payment
                    setCallStatus(CallStatus.INACTIVE);
                    setShowPaymentModal(true);
                    return;
                } else {
                    // Payment failed
                    throw new Error(paymentResult.error || "Payment failed");
                }
            }

            // Notify server of payment completion
            if (paymentResult.transactionHash) {
                await paymentAgent.notifyPaymentComplete(
                    paymentResult.transactionHash,
                    userId!
                );
            }
            */

            // BYPASS PAYMENT FOR TESTING
            console.log("Payment bypassed for testing...");
            const paymentResult = { success: true };

            // Payment successful - start interview
            console.log("Payment successful, starting AI interview...");

            const workflowId = process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID;

            if (type === "generate") {
                await vapi.start(workflowId, {
                    variableValues: {
                        username: userName,
                        userid: userId,
                    },
                });
            } else {
                let formattedQuestions = "";
                if (questions) {
                    formattedQuestions = questions
                        .map((question) => `- ${question}`)
                        .join("\n");
                }

                await vapi.start(workflowId, {
                    variableValues: {
                        questions: formattedQuestions,
                    },
                });
            }

            // Close payment modal after successful start
            setTimeout(() => {
                setShowPaymentModal(false);
            }, 2000);
        } catch (error: any) {
            console.error("Full Error Object:", error);
            setCallStatus(CallStatus.INACTIVE);
            
            // Update payment progress with error
            setPaymentProgress({
                state: PaymentState.FAILED,
                message: error.message || "An error occurred",
            });
            setShowPaymentModal(true);
        }
    };

    const handleDisconnect = () => {
        // Just stop Vapi. The event listener 'call-end' will handle state update.
        vapi.stop();
    };

    const handlePaymentModalClose = () => {
        setShowPaymentModal(false);
        
        // Reset to inactive if payment was rejected or failed
        if (
            paymentProgress.state === PaymentState.REJECTED ||
            paymentProgress.state === PaymentState.FAILED
        ) {
            setCallStatus(CallStatus.INACTIVE);
        }
    };

    return (
        <>
            <div className="call-view">
                {/* AI Interviewer Card */}
                <div className="card-interviewer">
                    <div className="avatar">
                        <Image
                            src="/ai-avatar.png"
                            alt="profile-image"
                            width={65}
                            height={54}
                            className="object-cover"
                        />
                        {isSpeaking && <span className="animate-speak" />}
                    </div>
                    <h3>AI Interviewer</h3>
                </div>

                {/* User Profile Card */}
                <div className="card-border overflow-hidden">
                    <EmotionMonitor />
                    <h3>{userName}</h3>
                </div>
            </div>

            {messages.length > 0 && (
                <div className="transcript-border">
                    <div className="transcript">
                        <p
                            // Using index or ID is better than content for key if content repeats
                            key={messages.length}
                            className={cn(
                                "transition-opacity duration-500 opacity-0",
                                "animate-fadeIn opacity-100",
                            )}
                        >
                            {lastMessage}
                        </p>
                    </div>
                </div>
            )}

            <div className="w-full flex justify-center">
                {callStatus !== CallStatus.ACTIVE ?
                    <button
                        className="relative btn-call"
                        // Disable button if we are finished to prevent double clicks while redirecting
                        disabled={callStatus === CallStatus.FINISHED}
                        onClick={() => handleCall()}
                    >
                        <span
                            className={cn(
                                "absolute animate-ping rounded-full opacity-75",
                                callStatus !== CallStatus.CONNECTING &&
                                    "hidden",
                            )}
                        />

                        <span className="relative">
                            {callStatus === CallStatus.INACTIVE ?
                                "Call"
                            : callStatus === CallStatus.FINISHED ?
                                "Processing..."
                            :   ". . ."}
                        </span>
                    </button>
                :   <button
                        className="btn-disconnect"
                        onClick={() => handleDisconnect()}
                    >
                        End
                    </button>
                }
            </div>

            {/* Payment Modal */}
            <PaymentModal
                isOpen={showPaymentModal}
                progress={paymentProgress}
                onClose={handlePaymentModalClose}
            />
        </>
    );
};

export default Agent;
