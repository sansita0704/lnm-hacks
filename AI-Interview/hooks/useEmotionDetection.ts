"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const API_URL = 'http://localhost:5000';
const DETECTION_INTERVAL = 1000;

export interface EmotionData {
  emotion: string;
  confidence: number;
  score: number;
  feedback: {
    message: string;
    tips: string[];
    icon: string;
    interview_impact: string;
  };
  analytics: {
    average_score: number;
    consistency_score: number;
    dominant_emotion: string;
    performance_trend: string;
  };
}

export const useEmotionDetection = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isDetecting, setIsDetecting] = useState(false);
  const [data, setData] = useState<EmotionData | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Initialize Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error", err);
      setError("Failed to access camera");
    }
  };

  // The Core Detection Loop
  const detectFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !isDetecting) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Draw video frame to canvas
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);

    // Get Base64
    const imageData = canvasRef.current.toDataURL('image/jpeg', 0.95);

    try {
      const response = await fetch(`${API_URL}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      });

      const result = await response.json();

      if (result.success) {
        setData({
          emotion: result.smoothed_emotion,
          confidence: result.smoothed_confidence,
          score: result.interview_score,
          feedback: result.feedback,
          analytics: result.analytics
        });
        
        setHistory(prev => [result.smoothed_emotion, ...prev].slice(0, 10));
      }
    } catch (err) {
      console.error("Detection API Error", err);
    }
  };

  // Manage Detection Loop
  useEffect(() => {
    if (isDetecting) {
      intervalRef.current = setInterval(detectFrame, DETECTION_INTERVAL);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isDetecting]);

  // Cleanup on unmount
  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    isDetecting,
    setIsDetecting,
    data,
    history,
    error
  };
};