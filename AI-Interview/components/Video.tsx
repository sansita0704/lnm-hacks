/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import "../emotion_detector/static/css/style.css";

// Constants
const API_URL =
    process.env.NEXT_PUBLIC_EMOTION_API_URL || "http://localhost:5000";
const DETECTION_INTERVAL = 1000;

// --- Type Definitions ---

interface FeedbackData {
    message: string;
    icon: string;
    tips: string[];
    interview_impact?: string;
}

interface InterviewMetrics {
    confidence: number;
    nervousness: number;
    engagement: number;
    positivity: number;
    focus: number;
    eye_contact: number;
    stability: number;
    distraction: number;
}

interface AnalyticsData {
    average_score: number;
    consistency_score: number;
    dominant_emotion: string;
    performance_trend: string;
    total_detections?: number;
    session_duration?: number;
}

interface CurrentMetrics {
    emotion: string;
    confidence: number;
    score: number;
    impact: string;
    feedback: FeedbackData;
}

interface ReportData {
    grade: string;
    summary: string;
    recommendations: string[];
    analytics: AnalyticsData & { total_detections: number };
}

interface MetricBarProps {
    label: string;
    value: number;
    inverse?: boolean;
}

// API Response Types
interface ApiDetectResponse {
    success: boolean;
    face_detected: boolean;
    smoothed_emotion: string;
    smoothed_confidence: number;
    interview_score: number;
    feedback: FeedbackData;
    interview_metrics: InterviewMetrics;
    analytics: AnalyticsData;
}

interface ApiReportResponse {
    success: boolean;
    report: ReportData;
}

// Mappings
const EMOTION_ICONS: Record<string, string> = {
    confident: "😊",
    composed: "😐",
    anxious: "😰",
    low_energy: "😔",
    tense: "😠",
    engaged: "😲",
};

const EMOTION_NAMES: Record<string, string> = {
    confident: "Confident & Engaging",
    composed: "Composed & Professional",
    anxious: "Anxious / Nervous",
    low_energy: "Low Energy / Disengaged",
    tense: "Tense / Stressed",
    engaged: "Engaged & Interested",
};

const TREND_ICONS: Record<string, string> = {
    improving: "📈 Improving",
    stable: "➡️ Stable",
    declining: "📉 Needs Focus",
    insufficient_data: "⏳ Collecting data...",
};

const Video: React.FC = () => {
    // --- State Management ---
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isDetecting, setIsDetecting] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [statusText, setStatusText] = useState<string>("Initializing...");
    const [detectionCount, setDetectionCount] = useState<number>(0);

    // Data States
    const [currentMetrics, setCurrentMetrics] = useState<CurrentMetrics>({
        emotion: "composed",
        confidence: 0,
        score: 0,
        impact: "",
        feedback: { message: "Start analysis...", icon: "👋", tips: [] },
    });

    const [interviewMetrics, setInterviewMetrics] = useState<InterviewMetrics>({
        confidence: 0,
        nervousness: 0,
        engagement: 0,
        positivity: 0,
        focus: 0,
        eye_contact: 0,
        stability: 0,
        distraction: 0,
    });

    const [analytics, setAnalytics] = useState<AnalyticsData>({
        average_score: 0,
        consistency_score: 0,
        dominant_emotion: "--",
        performance_trend: "insufficient_data",
    });

    const [history, setHistory] = useState<string[]>([]);
    const [showReport, setShowReport] = useState<boolean>(false);
    const [reportData, setReportData] = useState<ReportData | null>(null);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const requestInFlightRef = useRef(false);

    // --- Helper Functions ---
    const getScoreColor = (score: number): string => {
        if (score >= 85) return "#28a745";
        if (score >= 70) return "#17a2b8";
        if (score >= 55) return "#ffc107";
        return "#dc3545";
    };

    const getMetricColor = (
        value: number,
        inverse: boolean = false,
    ): string => {
        const actualValue = inverse ? 100 - value : value;
        if (actualValue >= 70) return "#10b981";
        if (actualValue >= 40) return "#f59e0b";
        return "#ef4444";
    };

    // --- Initialization ---
    useEffect(() => {
        const initCamera = async () => {
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: "user",
                    },
                });

                setStream(videoStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = videoStream;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current?.play();
                        setIsLoading(false);
                        setStatusText("Camera ready - Click Start Analysis");
                    };
                }
            } catch (err) {
                console.error("Camera error:", err);
                setError("Failed to access camera. Please grant permissions.");
                setIsLoading(false);
            }
        };

        initCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
            stopDetection();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Core Logic ---
    const detectEmotion = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        // Avoid overlapping requests if the API is slow
        if (requestInFlightRef.current) return;

        // Ensure video metadata is ready
        if (
            !videoRef.current.videoWidth ||
            !videoRef.current.videoHeight ||
            videoRef.current.readyState < 2
        ) {
            setStatusText("Waiting for camera...");
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        // Set canvas dimensions to match video
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL("image/jpeg", 0.95);

        try {
            requestInFlightRef.current = true;
            const response = await fetch(`${API_URL}/detect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: imageData }),
                mode: "cors",
                cache: "no-store",
            });

            if (!response.ok) {
                throw new Error(`API error ${response.status}`);
            }

            const result: ApiDetectResponse = await response.json();

            if (result.success) {
                setDetectionCount((prev) => prev + 1);

                setCurrentMetrics({
                    emotion: result.smoothed_emotion,
                    confidence: result.smoothed_confidence,
                    score: result.interview_score,
                    impact: result.feedback.interview_impact || "",
                    feedback: result.feedback,
                });

                setInterviewMetrics(result.interview_metrics);
                setAnalytics(result.analytics);

                setHistory((prev) => {
                    const newHistory = [result.smoothed_emotion, ...prev];
                    return newHistory.slice(0, 8); // Keep last 8
                });

                setStatusText(
                    `Current: ${EMOTION_NAMES[result.smoothed_emotion] || result.smoothed_emotion}`,
                );
            } else {
                if (!result.face_detected) {
                    setStatusText(
                        "⚠️ No face detected - please position yourself in frame",
                    );
                }
            }
        } catch (err) {
            console.error("Detection error:", err);
            setStatusText("❌ Connection error - retrying...");
        } finally {
            requestInFlightRef.current = false;
        }
    }, []);

    const fetchReport = async () => {
        try {
            const response = await fetch(`${API_URL}/report`);
            const result: ApiReportResponse = await response.json();
            if (result.success) {
                setReportData(result.report);
                setShowReport(true);
            }
        } catch (err) {
            console.error("Report error", err);
        }
    };

    const stopDetection = () => {
        setIsDetecting(false);
        setStatusText("Analysis paused");
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    const handleStopDetection = () => {
        stopDetection();
        if (detectionCount > 0) fetchReport();
    };

    const startDetection = () => {
        if (isDetecting) return;
        if (isLoading || error) {
            setStatusText(error || "Camera not ready");
            return;
        }
        setIsDetecting(true);
        setStatusText("Analyzing your interview presence...");
        intervalRef.current = setInterval(detectEmotion, DETECTION_INTERVAL);
    };

    const resetSession = async () => {
        if (!window.confirm("Start a new session? This clears data.")) return;
        try {
            await fetch(`${API_URL}/reset`, { method: "POST" });
            setDetectionCount(0);
            setHistory([]);
            setReportData(null);
            setAnalytics({
                average_score: 0,
                consistency_score: 0,
                dominant_emotion: "--",
                performance_trend: "insufficient_data",
            });
            setCurrentMetrics({
                emotion: "composed",
                confidence: 0,
                score: 0,
                impact: "",
                feedback: {
                    message: "Start analysis...",
                    icon: "👋",
                    tips: [],
                },
            });
            setInterviewMetrics({
                confidence: 0,
                nervousness: 0,
                engagement: 0,
                positivity: 0,
                focus: 0,
                eye_contact: 0,
                stability: 0,
                distraction: 0,
            });
            setStatusText("New session started");
        } catch (err) {
            alert("Failed to reset session");
        }
    };

    // --- Sub-Components ---
    const MetricBar: React.FC<MetricBarProps> = ({
        label,
        value,
        inverse = false,
    }) => (
        <div className="metric-bar-wrapper">
            <div className="metric-label-row">
                <span className="metric-label">{label}</span>
                <span
                    className="metric-value"
                    style={{ color: getMetricColor(value, inverse) }}
                >
                    {value}%
                </span>
            </div>
            <div className="metric-bar-bg">
                <div
                    className="metric-bar-fill"
                    style={{
                        width: `${value}%`,
                        backgroundColor: getMetricColor(value, inverse),
                        transition: "width 0.5s ease",
                    }}
                />
            </div>
        </div>
    );

    return (
        <div className="container">
            <div className="content">
                {/* Video Section */}
                <div className="video-section w-full">
                    <div className="video-container">
                        <video
                            ref={videoRef}
                            id="webcam"
                            autoPlay
                            playsInline
                            muted
                        />
                        <canvas ref={canvasRef} style={{ display: "none" }} />

                        {/* Overlays */}
                        {isDetecting && (
                            <div
                                className="score-badge"
                                style={{
                                    borderColor: getScoreColor(
                                        currentMetrics.score,
                                    ),
                                }}
                            >
                                <div className="score-value">
                                    {currentMetrics.score}
                                </div>
                                <div className="score-label">Score</div>
                            </div>
                        )}

                        {isLoading && (
                            <div className="overlay loading">
                                <div className="spinner"></div>
                                <p>Initializing AI Coach...</p>
                            </div>
                        )}

                        {error && (
                            <div className="overlay error-overlay">
                                <div className="error-icon">⚠️</div>
                                <p>{error}</p>
                            </div>
                        )}
                    </div>

                    <div className="relative right-2 bottom-4 left-2 bg-black/70 text-white px-3 py-1 rounded">
                        Emotion:
                        {EMOTION_NAMES[currentMetrics.emotion] ||
                            currentMetrics.emotion}
                    </div>

                    <div className="controls">
                        {!isDetecting ?
                            <button
                                className="btn btn-primary"
                                onClick={startDetection}
                                disabled={isLoading || !!error}
                            >
                                <span className="btn-icon">▶️</span> Start
                                Analysis
                            </button>
                        :   <button
                                className="btn btn-danger"
                                onClick={handleStopDetection}
                            >
                                <span className="btn-icon">⏸️</span> Pause
                            </button>
                        }
                        <button
                            className="btn btn-info"
                            onClick={fetchReport}
                            disabled={detectionCount === 0}
                        >
                            <span className="btn-icon">📊</span> View Report
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={resetSession}
                        >
                            <span className="btn-icon">🔄</span> New Session
                        </button>
                    </div>
                </div>
            </div>

            {/* Report Modal
            {showReport && reportData && (
                <div className="modal" onClick={() => setShowReport(false)}>
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h2>📊 Performance Report</h2>
                            <button
                                className="close-btn"
                                onClick={() => setShowReport(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="modal-body">
                            <div
                                className="report-grade"
                                style={{
                                    color: getScoreColor(
                                        reportData.analytics.average_score,
                                    ),
                                }}
                            >
                                {reportData.grade}
                            </div>
                            <p className="report-summary">
                                {reportData.summary}
                            </p>

                            <div className="stats-grid">
                                <div className="stat-box">
                                    <div className="stat-value">
                                        {reportData.analytics.average_score}
                                    </div>
                                    <div className="stat-label">Avg Score</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value">
                                        {reportData.analytics.total_detections}
                                    </div>
                                    <div className="stat-label">Detections</div>
                                </div>
                            </div>

                            <h3>💡 Recommendations</h3>
                            <ul className="recommendations-list">
                                {reportData.recommendations.map((rec, i) => (
                                    <li key={i}>{rec}</li>
                                ))}
                            </ul>

                            <div className="report-actions">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => window.print()}
                                >
                                    🖨️ Print
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setShowReport(false)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )} */}
        </div>
    );
};

export default Video;
