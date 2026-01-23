"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import EmotionMonitor from "@/components/EmotionMonitor"; // Import the new component

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
// import { interviewer } from "@/constants"; // Unused import removed
import { createFeedback } from "@/lib/actions/general.action";
import Video from "./Video";

import { getContract } from "@/lib/web3"; // This is your staking contract helper
import { saveUserWallet } from "@/lib/actions/user.action";
import { ethers } from "ethers";

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
                const { success, feedbackId: id } = await createFeedback({
                    interviewId,
                    userId: userId!,
                    transcript: messages,
                    feedbackId,
                });

                if (success && id) {
                    {
                        router.push(`/interview/${interviewId}/feedback`);
//                         const PASS_SCORE = 65;

// if (result.overall >= PASS_SCORE) {
//   await rewardUser(user.wallet);
// }

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
            await navigator.mediaDevices.getUserMedia({ audio: true });

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const wallet = await signer.getAddress();

            await saveUserWallet(userId!, wallet);

             // 1️⃣ Get the contract instance
            const contract = await getContract();

            // 2️⃣ Stake tokens (or whatever your contract logic is)
            const tx = await contract?.stake();
            await tx.wait(); // wait for transaction to be mined

            console.log("Staking successful, starting AI interview...");

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
        } catch (error) {
            console.error("Error starting call:", error);
            setCallStatus(CallStatus.INACTIVE);
        }
    };

    const handleDisconnect = () => {
        // Just stop Vapi. The event listener 'call-end' will handle state update.
        vapi.stop();
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
        </>
    );
};

export default Agent;
