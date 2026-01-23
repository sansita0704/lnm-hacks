"use client";

import { useEmotionDetection } from "../hooks/useEmotionDetection";
import { cn } from "@/lib/utils";

// Helper for colors
const getScoreColor = (score: number) => {
  if (score >= 85) return 'text-green-500 border-green-500';
  if (score >= 70) return 'text-cyan-500 border-cyan-500';
  if (score >= 55) return 'text-yellow-500 border-yellow-500';
  return 'text-red-500 border-red-500';
};

const EMOTION_ICONS: Record<string, string> = {
    'confident': '😊', 'composed': '😐', 'anxious': '😰',
    'low_energy': '😔', 'tense': '😠', 'engaged': '😲'
};

const EmotionMonitor = () => {
  const { 
    videoRef, 
    canvasRef, 
    isDetecting, 
    setIsDetecting, 
    data, 
    history 
  } = useEmotionDetection();

  return (
    <div className="relative w-full h-full flex flex-col gap-4">
      
      {/* Video Feed Wrapper */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-black aspect-video">
        <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-full object-cover" 
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay Badge - Score */}
        {data && isDetecting && (
          <div className={cn(
            "absolute top-4 right-4 bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border flex items-center gap-2",
            getScoreColor(data.score)
          )}>
            <span className="text-xl font-bold">{data.score}</span>
            <span className="text-xs text-gray-300">/ 100</span>
          </div>
        )}

        {/* Overlay Badge - Current Emotion */}
        {data && isDetecting && (
           <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-gray-700">
             <div className="flex items-center gap-2">
                <span className="text-2xl">{EMOTION_ICONS[data.emotion] || '😐'}</span>
                <div>
                    <p className="text-sm font-medium capitalize text-white">{data.emotion.replace('_', ' ')}</p>
                    <div className="w-24 h-1 bg-gray-700 rounded-full mt-1">
                        <div 
                           className="h-full bg-blue-500 rounded-full transition-all duration-500"
                           style={{ width: `${data.confidence * 100}%`}}
                        />
                    </div>
                </div>
             </div>
           </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="flex gap-4 justify-center">
        <button
            onClick={() => setIsDetecting(!isDetecting)}
            className={cn(
                "px-6 py-2 rounded-full font-medium transition-all",
                isDetecting 
                  ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" 
                  : "bg-green-500 text-white hover:bg-green-600"
            )}
        >
            {isDetecting ? "Stop Analysis" : "Start Analysis"}
        </button>
      </div>

      {/* Real-time Feedback Section */}
      {data && (
        <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                <h4 className="text-sm text-gray-400 mb-2">AI Coach Tips</h4>
                <p className="text-sm text-white mb-2">{data.feedback.message}</p>
                <ul className="text-xs text-gray-300 list-disc list-inside">
                    {data.feedback.tips.slice(0, 2).map((tip, i) => (
                        <li key={i}>{tip}</li>
                    ))}
                </ul>
            </div>
            
            <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                <h4 className="text-sm text-gray-400 mb-2">Live Analytics</h4>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500">Consistency</span>
                    <span className="text-sm font-bold text-green-400">{data.analytics.consistency_score}%</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Trend</span>
                    <span className="text-xs capitalize bg-gray-800 px-2 py-1 rounded">
                        {data.analytics.performance_trend === 'improving' ? '📈 Improving' : '➡️ Stable'}
                    </span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default EmotionMonitor;