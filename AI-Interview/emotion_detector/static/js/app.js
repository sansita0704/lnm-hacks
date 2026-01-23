// Enhanced Emotion Detection Frontend with Interview Analytics

const API_URL = "http://localhost:5000";
const DETECTION_INTERVAL = 1000; // Increased to 1 second for better accuracy

// State
let stream = null;
let detectionInterval = null;
let isDetecting = false;
let detectionCount = 0;
let emotionHistory = [];
let lastAnalytics = null;

// DOM Elements
const video = document.getElementById("webcam");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const reportBtn = document.getElementById("reportBtn");
const resetBtn = document.getElementById("resetBtn");
const loading = document.getElementById("loading");
const errorOverlay = document.getElementById("error");
const errorMessage = document.getElementById("error-message");
const statusText = document.getElementById("status-text");
const fpsCounter = document.getElementById("fps-counter");
const emotionDisplay = document.getElementById("emotion-display");
const feedbackDisplay = document.getElementById("feedback-display");
const historyDisplay = document.getElementById("history-display");
const scoreBadge = document.getElementById("score-badge");
const interviewImpact = document.getElementById("interview-impact");
const impactText = document.getElementById("impact-text");
const reportModal = document.getElementById("reportModal");
const closeModal = document.getElementById("closeModal");
const reportContent = document.getElementById("reportContent");

// Analytics elements
const avgScore = document.getElementById("avg-score");
const consistency = document.getElementById("consistency");
const dominantEmotion = document.getElementById("dominant-emotion");
const trend = document.getElementById("trend");

// Interview-appropriate emotion icons
const EMOTION_ICONS = {
    confident: "😊",
    composed: "😐",
    anxious: "😰",
    low_energy: "😔",
    tense: "😠",
    engaged: "😲",
};

// Emotion display names
const EMOTION_NAMES = {
    confident: "Confident & Engaging",
    composed: "Composed & Professional",
    anxious: "Anxious / Nervous",
    low_energy: "Low Energy / Disengaged",
    tense: "Tense / Stressed",
    engaged: "Engaged & Interested",
};

// Score color coding
function getScoreColor(score) {
    if (score >= 85) return "#28a745";
    if (score >= 70) return "#17a2b8";
    if (score >= 55) return "#ffc107";
    return "#dc3545";
}

// Trend icons
const TREND_ICONS = {
    improving: "📈 Improving",
    stable: "➡️ Stable",
    declining: "📉 Needs Focus",
    insufficient_data: "⏳ Collecting data...",
};

// Initialize
async function init() {
    console.log("Initializing enhanced emotion detection...");

    try {
        // Request camera access with higher quality
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user",
            },
        });

        video.srcObject = stream;

        video.onloadedmetadata = () => {
            video.play();
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            loading.style.display = "none";
            startBtn.disabled = false;
            statusText.textContent = "Camera ready - Click Start Analysis";
            console.log("Camera initialized successfully");
        };
    } catch (err) {
        console.error("Camera error:", err);
        showError(
            "Failed to access camera. Please grant permissions and reload the page.",
        );
    }
}

// Start detection
function startDetection() {
    if (isDetecting) return;

    isDetecting = true;
    startBtn.style.display = "none";
    stopBtn.style.display = "block";
    scoreBadge.style.display = "flex";
    statusText.textContent = "Analyzing your interview presence...";

    // Start detection loop
    detectionInterval = setInterval(detectEmotion, DETECTION_INTERVAL);

    console.log("Enhanced detection started");
}

// Stop detection
function stopDetection() {
    if (!isDetecting) return;

    isDetecting = false;
    stopBtn.style.display = "none";
    startBtn.style.display = "block";
    statusText.textContent = "Analysis paused";

    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }

    console.log("Detection stopped");

    // NEW: Show dashboard when paused (if we have data)
    if (detectionCount > 0) {
        setTimeout(() => showReport(), 500); // Small delay for smooth UX
    }
}

// Detect emotion from current video frame
async function detectEmotion() {
    // CRITICAL FIX: Check if detection is still active
    if (!isDetecting) {
        console.log("Detection stopped, skipping frame");
        return;
    }

    try {
        // Capture frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL("image/jpeg", 0.95); // Higher quality

        // Send to API
        const response = await fetch(`${API_URL}/detect`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ image: imageData }),
        });

        const result = await response.json();

        if (result.success) {
            detectionCount++;
            updateDisplay(result);
            updateAnalytics(result.analytics);
            updateInterviewMetrics(result.interview_metrics); // NEW
            fpsCounter.textContent = `Detections: ${detectionCount}`;
        } else {
            console.warn("Detection failed:", result.error);
            if (!result.face_detected) {
                statusText.textContent =
                    "⚠️ No face detected - please position yourself in frame";
            }
        }
    } catch (err) {
        console.error("Detection error:", err);
        statusText.textContent =
            "❌ Connection error - check if server is running";
    }
}

// Update display with results
function updateDisplay(result) {
    const emotion = result.smoothed_emotion;
    const confidence = result.smoothed_confidence;
    const feedback = result.feedback;
    const score = result.interview_score;

    // Update emotion display
    const icon = EMOTION_ICONS[emotion] || "😐";
    const name = EMOTION_NAMES[emotion] || emotion;

    emotionDisplay.innerHTML = `
        <div class="emotion-icon">${icon}</div>
        <div class="emotion-info">
            <div class="emotion-name">${name}</div>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${confidence * 100}%; background: ${getScoreColor(score)};"></div>
            </div>
            <div class="confidence-text">Confidence: ${Math.round(confidence * 100)}%</div>
        </div>
    `;

    // Update interview impact
    interviewImpact.style.display = "block";
    impactText.textContent = feedback.interview_impact;
    impactText.style.color = getScoreColor(score);

    // Update score badge
    scoreBadge.querySelector(".score-value").textContent = score;
    scoreBadge.style.borderColor = getScoreColor(score);
    scoreBadge.style.background = `linear-gradient(135deg, ${getScoreColor(score)}22, ${getScoreColor(score)}44)`;

    // Update feedback
    feedbackDisplay.innerHTML = `
        <div class="feedback-message" style="color: ${getScoreColor(score)};">
            <span style="font-size: 2rem;">${feedback.icon}</span>
            <span>${feedback.message}</span>
        </div>
        <div class="feedback-tips">
            <h3>💡 AI Coach Tips:</h3>
            <ul>
                ${feedback.tips.map((tip) => `<li>${tip}</li>`).join("")}
            </ul>
        </div>
    `;

    // Update history
    emotionHistory.unshift(emotion);
    if (emotionHistory.length > 15) {
        emotionHistory.pop();
    }

    historyDisplay.innerHTML = emotionHistory
        .slice(0, 8)
        .map((e, idx) => {
            const timeAgo = idx === 0 ? "Now" : `${idx}s ago`;
            return `
            <div class="history-item">
                <div class="history-dot emotion-${e}"></div>
                <span class="history-emotion">${EMOTION_NAMES[e]}</span>
                <span class="history-time">${timeAgo}</span>
            </div>
        `;
        })
        .join("");

    statusText.textContent = `Current: ${name} • Score: ${score}/100`;
}

// Update analytics display
function updateAnalytics(analytics) {
    if (!analytics || Object.keys(analytics).length === 0) return;

    lastAnalytics = analytics;

    // Update analytics display
    avgScore.textContent = `${analytics.average_score || 0}/100`;
    avgScore.style.color = getScoreColor(analytics.average_score || 0);

    consistency.textContent = `${analytics.consistency_score || 0}%`;
    consistency.style.color =
        analytics.consistency_score >= 70 ? "#28a745" : "#ffc107";

    const domEmotion = analytics.dominant_emotion || "composed";
    dominantEmotion.textContent = EMOTION_NAMES[domEmotion] || domEmotion;
    dominantEmotion.style.textTransform = "capitalize";

    trend.textContent =
        TREND_ICONS[analytics.performance_trend] || "⏳ Analyzing...";
}

// NEW: Update interview metrics display
function updateInterviewMetrics(metrics) {
    if (!metrics || Object.keys(metrics).length === 0) return;

    // Helper to get color based on value
    function getMetricColor(value, inverse = false) {
        const actualValue = inverse ? 100 - value : value;
        if (actualValue >= 70) return "#10b981"; // green
        if (actualValue >= 40) return "#f59e0b"; // yellow
        return "#ef4444"; // red
    }

    // Metrics configuration (which ones are inverse)
    const metricsConfig = {
        confidence: { inverse: false },
        nervousness: { inverse: true },
        engagement: { inverse: false },
        positivity: { inverse: false },
        focus: { inverse: false },
        eye_contact: { inverse: false },
        stability: { inverse: false },
        distraction: { inverse: true },
    };

    // Update each metric with animation
    Object.entries(metricsConfig).forEach(([key, config]) => {
        const value = Math.round(metrics[key] || 0);
        const color = getMetricColor(value, config.inverse);

        // Update value text
        const valueElement = document.getElementById(`metric-${key}-value`);
        if (valueElement) {
            valueElement.textContent = `${value}%`;
            valueElement.style.color = color;
        }

        // Update bar with animation
        const barElement = document.getElementById(`metric-${key}-bar`);
        if (barElement) {
            barElement.style.width = `${value}%`;
            barElement.style.backgroundColor = color;

            // Add pulse effect on update
            const wrapper = barElement.closest(".metric-bar-wrapper");
            if (wrapper) {
                wrapper.classList.add("updating");
                setTimeout(() => wrapper.classList.remove("updating"), 500);
            }
        }
    });
}

// Show report modal
async function showReport() {
    reportModal.style.display = "flex";
    reportContent.innerHTML =
        '<p class="loading-text">Generating report...</p>';

    try {
        const response = await fetch(`${API_URL}/report`);
        const result = await response.json();

        if (result.success) {
            const report = result.report;
            const analytics = report.analytics;

            // Generate distribution chart
            let distributionHTML = "";
            if (analytics.emotion_distribution) {
                distributionHTML = Object.entries(
                    analytics.emotion_distribution,
                )
                    .sort((a, b) => b[1] - a[1])
                    .map(
                        ([emotion, percentage]) => `
                        <div class="distribution-item">
                            <div class="distribution-label">
                                ${EMOTION_ICONS[emotion]} ${EMOTION_NAMES[emotion]}
                            </div>
                            <div class="distribution-bar">
                                <div class="distribution-fill emotion-${emotion}" style="width: ${percentage}%"></div>
                            </div>
                            <div class="distribution-percentage">${percentage}%</div>
                        </div>
                    `,
                    )
                    .join("");
            }

            reportContent.innerHTML = `
                <div class="report-section">
                    <div class="report-grade" style="color: ${getScoreColor(analytics.average_score)};">
                        ${report.grade}
                    </div>
                    <p class="report-summary">${report.summary}</p>
                </div>
                
                <div class="report-section">
                    <h3>📊 Session Statistics</h3>
                    <div class="stats-grid">
                        <div class="stat-box">
                            <div class="stat-value" style="color: ${getScoreColor(analytics.average_score)};">
                                ${analytics.average_score}/100
                            </div>
                            <div class="stat-label">Average Score</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${analytics.consistency_score}%</div>
                            <div class="stat-label">Consistency</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${analytics.total_detections}</div>
                            <div class="stat-label">Detections</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${Math.round(analytics.session_duration)}s</div>
                            <div class="stat-label">Duration</div>
                        </div>
                    </div>
                </div>
                
                <div class="report-section">
                    <h3>📈 Emotional State Distribution</h3>
                    <div class="distribution-chart">
                        ${distributionHTML}
                    </div>
                </div>
                
                <div class="report-section">
                    <h3>💡 Personalized Recommendations</h3>
                    <ul class="recommendations-list">
                        ${report.recommendations.map((rec) => `<li>${rec}</li>`).join("")}
                    </ul>
                </div>
                
                <div class="report-section">
                    <h3>🎯 Performance Trend</h3>
                    <p class="trend-text">
                        ${TREND_ICONS[analytics.performance_trend]}
                        ${
                            analytics.performance_trend === "improving" ?
                                "You're getting better throughout the session!"
                            : analytics.performance_trend === "stable" ?
                                "You're maintaining consistent performance."
                            : analytics.performance_trend === "declining" ?
                                "Try to maintain your energy levels."
                            :   "Keep practicing to establish a trend."
                        }
                    </p>
                </div>
                
                <div class="report-actions">
                    <button class="btn btn-primary" onclick="window.print()">
                        🖨️ Print Report
                    </button>
                    <button class="btn btn-secondary" onclick="closeReportModal()">
                        Close
                    </button>
                </div>
            `;
        } else {
            reportContent.innerHTML = `
                <p class="error-text">
                    ${result.error || "Not enough data yet. Continue practicing!"}
                </p>
                <button class="btn btn-primary" onclick="closeReportModal()">
                    Close
                </button>
            `;
        }
    } catch (err) {
        console.error("Report error:", err);
        reportContent.innerHTML = `
            <p class="error-text">Error loading report. Please try again.</p>
            <button class="btn btn-primary" onclick="closeReportModal()">Close</button>
        `;
    }
}

// Close report modal
function closeReportModal() {
    reportModal.style.display = "none";
}

// Show error
function showError(message) {
    loading.style.display = "none";
    errorOverlay.style.display = "flex";
    errorMessage.textContent = message;
    startBtn.disabled = true;
}

// Reset session
async function resetSession() {
    const confirmed = confirm(
        "Start a new interview session? This will clear all current data.",
    );
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_URL}/reset`, {
            method: "POST",
        });

        const result = await response.json();

        if (result.success) {
            detectionCount = 0;
            emotionHistory = [];
            lastAnalytics = null;

            // Reset displays
            historyDisplay.innerHTML =
                '<p class="history-placeholder">No data yet</p>';
            feedbackDisplay.innerHTML =
                '<p class="feedback-placeholder">Start analysis to receive coaching</p>';
            interviewImpact.style.display = "none";
            scoreBadge.style.display = "none";

            // Reset analytics
            avgScore.textContent = "--";
            consistency.textContent = "--";
            dominantEmotion.textContent = "--";
            trend.textContent = "--";

            statusText.textContent = "New session started";
            fpsCounter.textContent = "Detections: 0";

            console.log("New session started");
        }
    } catch (err) {
        console.error("Reset error:", err);
        alert("Failed to reset session. Please try again.");
    }
}

// Event listeners
startBtn.addEventListener("click", startDetection);
stopBtn.addEventListener("click", stopDetection);
reportBtn.addEventListener("click", showReport);
resetBtn.addEventListener("click", resetSession);
closeModal.addEventListener("click", closeReportModal);

// Close modal on outside click
reportModal.addEventListener("click", (e) => {
    if (e.target === reportModal) {
        closeReportModal();
    }
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
    if (stream) {
        stream.getTracks().forEach((track) => track.stop());
    }
    stopDetection();
});

// Start app
init();
