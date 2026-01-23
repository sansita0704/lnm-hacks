"""
Enhanced Emotion Detection Module for Interview Analysis
Uses DeepFace with improved accuracy and interview-specific feedback
NOW INCLUDES: Interview Metrics (Emotion & Attitude + Interview Behavior)
"""

from deepface import DeepFace
import cv2
import logging
from collections import deque
from datetime import datetime
import numpy as np

logger = logging.getLogger(__name__)

class EmotionDetector:
    """Handles emotion detection with interview-specific analysis and metrics"""
    
    # Map DeepFace emotions to interview-appropriate terms
    EMOTION_MAP = {
        'happy': 'confident',
        'sad': 'low_energy',
        'neutral': 'composed',
        'angry': 'tense',
        'surprise': 'engaged',
        'fear': 'anxious'
    }
    
    # Interview-specific feedback
    FEEDBACK = {
        'confident': {
            'message': 'Excellent! You appear confident and enthusiastic.',
            'icon': '😊',
            'color': 'success',
            'score': 95,
            'tips': [
                'Your positive energy creates strong rapport',
                'This confidence level is ideal for interviews',
                'Maintain eye contact and this enthusiasm'
            ],
            'interview_impact': 'Very Positive - You\'re making a great impression'
        },
        'composed': {
            'message': 'You appear calm and professional.',
            'icon': '😐',
            'color': 'info',
            'score': 75,
            'tips': [
                'Show slightly more enthusiasm about the opportunity',
                'Smile when discussing your achievements',
                'Let your passion for the role show through'
            ],
            'interview_impact': 'Neutral - Add more energy to stand out'
        },
        'anxious': {
            'message': 'You seem nervous. Deep breaths - you\'ve got this!',
            'icon': '😰',
            'color': 'warning',
            'score': 50,
            'tips': [
                'Take 3 deep breaths before answering',
                'Remember: they want you to succeed',
                'Focus on your achievements, not your nerves',
                'Pause and smile before responding'
            ],
            'interview_impact': 'Needs Improvement - Nervousness is visible'
        },
        'low_energy': {
            'message': 'Your energy seems low. Are you feeling okay?',
            'icon': '😔',
            'color': 'warning',
            'score': 45,
            'tips': [
                'Sit up straight to boost your energy',
                'Think of something that excites you about this role',
                'Recall a recent win to lift your mood',
                'Consider taking a short break if needed'
            ],
            'interview_impact': 'Concerning - Low energy may signal lack of interest'
        },
        'tense': {
            'message': 'You appear tense or frustrated. Let\'s reset.',
            'icon': '😠',
            'color': 'danger',
            'score': 35,
            'tips': [
                'Relax your jaw and shoulders',
                'Take a 10-second pause to collect yourself',
                'Reframe challenging questions as opportunities',
                'Maintain professional composure'
            ],
            'interview_impact': 'Negative - Tension can be misinterpreted'
        },
        'engaged': {
            'message': 'Great! You look interested and engaged.',
            'icon': '😲',
            'color': 'success',
            'score': 85,
            'tips': [
                'Your active listening is showing',
                'This engagement demonstrates genuine interest',
                'Natural reactions build connection'
            ],
            'interview_impact': 'Positive - Shows authentic interest in the role'
        }
    }
    
    def __init__(self, smoothing_window=7, metrics_smoothing_window=5):
        """
        Initialize detector with enhanced smoothing
        
        Args:
            smoothing_window: Number of frames to smooth emotions
            metrics_smoothing_window: Number of frames to smooth metrics
        """
        self.smoothing_window = smoothing_window
        self.emotion_history = deque(maxlen=smoothing_window)
        self.confidence_history = deque(maxlen=smoothing_window)
        self.session_emotions = []
        self.session_start = datetime.now()
        
        # NEW: Metrics tracking
        self.metrics_smoothing_window = metrics_smoothing_window
        self.metrics_history = {
            'confidence': deque(maxlen=metrics_smoothing_window),
            'nervousness': deque(maxlen=metrics_smoothing_window),
            'engagement': deque(maxlen=metrics_smoothing_window),
            'positivity': deque(maxlen=metrics_smoothing_window),
            'focus': deque(maxlen=metrics_smoothing_window),
            'eye_contact': deque(maxlen=metrics_smoothing_window),
            'stability': deque(maxlen=metrics_smoothing_window),
            'distraction': deque(maxlen=metrics_smoothing_window),
        }
        self.face_position_history = deque(maxlen=10)
        
        logger.info("Enhanced EmotionDetector initialized with interview metrics")
    
    def detect(self, image):
        """
        Detect emotion with improved accuracy and calculate interview metrics
        
        Args:
            image: OpenCV image (BGR format)
            
        Returns:
            dict with emotion, confidence, feedback, analytics, and interview metrics
        """
        try:
            # Preprocess image for better accuracy
            preprocessed = self._preprocess_image(image)
            
            # Analyze with DeepFace
            result = DeepFace.analyze(
                preprocessed,
                actions=['emotion'],
                enforce_detection=True,
                detector_backend='retinaface',
                silent=True
            )
            
            if isinstance(result, list):
                result = result[0]
            
            # Extract emotion data
            raw_emotion = result['dominant_emotion']
            mapped_emotion = self.EMOTION_MAP.get(raw_emotion, 'composed')
            all_emotions = result['emotion']
            
            # Get face region for position tracking
            face_region = result.get('region', {})
            
            # Calculate confidence
            adjusted_confidence = self._calculate_adjusted_confidence(all_emotions, raw_emotion)
            
            # Add to history
            self.emotion_history.append(mapped_emotion)
            self.confidence_history.append(adjusted_confidence)
            self.session_emotions.append({
                'emotion': mapped_emotion,
                'confidence': adjusted_confidence,
                'timestamp': datetime.now()
            })
            
            # Calculate smoothed emotion
            smoothed_emotion = self._get_smoothed_emotion()
            smoothed_confidence = self._get_smoothed_confidence()
            
            # Get feedback
            feedback = self.FEEDBACK.get(smoothed_emotion, self.FEEDBACK['composed'])
            
            # NEW: Calculate interview metrics
            interview_metrics = self._calculate_interview_metrics(all_emotions, face_region)
            
            # Calculate session analytics
            analytics = self._calculate_analytics()
            
            return {
                'face_detected': True,
                'emotion': mapped_emotion,
                'confidence': round(adjusted_confidence, 2),
                'smoothed_emotion': smoothed_emotion,
                'smoothed_confidence': round(smoothed_confidence, 2),
                'all_emotions': all_emotions,
                'feedback': feedback,
                'analytics': analytics,
                'interview_score': feedback['score'],
                'interview_metrics': interview_metrics  # NEW
            }
            
        except ValueError as e:
            logger.warning(f"No face detected: {str(e)}")
            return {
                'face_detected': False,
                'error': 'No face detected - please position yourself clearly in frame'
            }
            
        except Exception as e:
            logger.error(f"Error detecting emotion: {str(e)}")
            try:
                return self._fallback_detection(image)
            except:
                return {
                    'face_detected': False,
                    'error': 'Detection failed - please ensure good lighting'
                }
    
    def _calculate_interview_metrics(self, emotions, face_region):
        """
        Calculate Emotion & Attitude and Interview Behavior metrics
        
        Returns dict with 8 metrics (0-100 scale)
        """
        # Normalize DeepFace emotion scores (0-100 to 0-1)
        normalized_emotions = {
            'happy': emotions.get('happy', 0) / 100.0,
            'sad': emotions.get('sad', 0) / 100.0,
            'neutral': emotions.get('neutral', 0) / 100.0,
            'angry': emotions.get('angry', 0) / 100.0,
            'surprised': emotions.get('surprise', 0) / 100.0,
            'fear': emotions.get('fear', 0) / 100.0
        }
        
        # EMOTION & ATTITUDE METRICS
        
        # 1. Confidence: High happy + low fear/sad
        confidence = self._clamp(
            (normalized_emotions['happy'] * 100) +
            (normalized_emotions['neutral'] * 30) -
            (normalized_emotions['fear'] * 50) -
            (normalized_emotions['sad'] * 40),
            0, 100
        )
        
        # 2. Nervousness: High fear + anger, low happy
        nervousness = self._clamp(
            (normalized_emotions['fear'] * 100) +
            (normalized_emotions['angry'] * 40) +
            (normalized_emotions['sad'] * 30) -
            (normalized_emotions['happy'] * 20),
            0, 100
        )
        
        # 3. Engagement: High surprised + happy, low neutral/sad
        engagement = self._clamp(
            (normalized_emotions['surprised'] * 80) +
            (normalized_emotions['happy'] * 60) -
            (normalized_emotions['neutral'] * 40) -
            (normalized_emotions['sad'] * 50),
            0, 100
        )
        
        # 4. Positivity: High happy, low sad/angry
        positivity = self._clamp(
            (normalized_emotions['happy'] * 100) +
            (normalized_emotions['surprised'] * 20) -
            (normalized_emotions['sad'] * 60) -
            (normalized_emotions['angry'] * 70),
            0, 100
        )
        
        # 5. Focus: Low distraction emotions, high neutral/happy
        focus = self._clamp(
            (normalized_emotions['neutral'] * 60) +
            (normalized_emotions['happy'] * 40) -
            (normalized_emotions['surprised'] * 30) -
            (normalized_emotions['fear'] * 40),
            0, 100
        )
        
        # INTERVIEW BEHAVIOR METRICS
        
        # 6. Eye Contact: Based on face position stability
        eye_contact = self._calculate_eye_contact(face_region)
        
        # 7. Stability: Inverse of emotion variance
        emotion_values = list(normalized_emotions.values())
        emotion_variance = sum(abs(v - 0.5) for v in emotion_values)
        stability = self._clamp(100 - (emotion_variance * 40), 0, 100)
        
        # 8. Distraction: High movement + surprise, low focus
        distraction = self._clamp(
            (normalized_emotions['surprised'] * 50) +
            (normalized_emotions['fear'] * 40) +
            ((100 - eye_contact) * 0.5) -
            (normalized_emotions['neutral'] * 30),
            0, 100
        )
        
        # Store in history for smoothing
        raw_metrics = {
            'confidence': confidence,
            'nervousness': nervousness,
            'engagement': engagement,
            'positivity': positivity,
            'focus': focus,
            'eye_contact': eye_contact,
            'stability': stability,
            'distraction': distraction
        }
        
        # Smooth metrics
        smoothed_metrics = {}
        for key, value in raw_metrics.items():
            self.metrics_history[key].append(value)
            smoothed_metrics[key] = self._smooth_metric(key)
        
        return smoothed_metrics
    
    def _calculate_eye_contact(self, face_region):
        """Calculate eye contact from face position stability"""
        if not face_region or 'x' not in face_region:
            return 50.0
        
        # Store position
        self.face_position_history.append({
            'x': face_region.get('x', 0),
            'y': face_region.get('y', 0)
        })
        
        if len(self.face_position_history) < 3:
            return 50.0
        
        # Calculate position variance
        positions = list(self.face_position_history)
        x_values = [p['x'] for p in positions]
        y_values = [p['y'] for p in positions]
        
        x_variance = np.var(x_values) if len(x_values) > 1 else 0
        y_variance = np.var(y_values) if len(y_values) > 1 else 0
        total_variance = x_variance + y_variance
        
        # Lower variance = better eye contact
        stability = max(0, 100 - (total_variance / 10))
        
        return self._clamp(stability, 0, 100)
    
    def _smooth_metric(self, metric_key):
        """Smooth metric using weighted moving average"""
        history = list(self.metrics_history[metric_key])
        
        if not history:
            return 0.0
        
        # Weighted average (recent values weighted more)
        weights = list(range(1, len(history) + 1))
        weighted_sum = sum(value * weight for value, weight in zip(history, weights))
        weight_total = sum(weights)
        
        smoothed = weighted_sum / weight_total if weight_total > 0 else 0
        
        return round(smoothed, 1)
    
    def _clamp(self, value, min_val, max_val):
        """Clamp value between min and max"""
        return max(min_val, min(max_val, value))
    
    def _preprocess_image(self, image):
        """Preprocess image for better detection accuracy"""
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        lab = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        l = clahe.apply(l)
        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2RGB)
        
        return enhanced
    
    def _calculate_adjusted_confidence(self, all_emotions, dominant):
        """Calculate adjusted confidence based on emotion distribution"""
        dominant_score = all_emotions[dominant]
        
        sorted_emotions = sorted(all_emotions.items(), key=lambda x: x[1], reverse=True)
        second_score = sorted_emotions[1][1] if len(sorted_emotions) > 1 else 0
        
        margin = dominant_score - second_score
        adjusted = (dominant_score + margin) / 200.0
        
        return min(adjusted, 1.0)
    
    def _fallback_detection(self, image):
        """Fallback to opencv backend if retinaface fails"""
        result = DeepFace.analyze(
            image,
            actions=['emotion'],
            enforce_detection=False,
            detector_backend='opencv',
            silent=True
        )
        
        if isinstance(result, list):
            result = result[0]
        
        raw_emotion = result['dominant_emotion']
        mapped_emotion = self.EMOTION_MAP.get(raw_emotion, 'composed')
        all_emotions = result['emotion']
        confidence = all_emotions[raw_emotion] / 100.0
        face_region = result.get('region', {})
        
        self.emotion_history.append(mapped_emotion)
        self.confidence_history.append(confidence)
        
        smoothed_emotion = self._get_smoothed_emotion()
        feedback = self.FEEDBACK.get(smoothed_emotion, self.FEEDBACK['composed'])
        
        # Calculate metrics even in fallback
        interview_metrics = self._calculate_interview_metrics(all_emotions, face_region)
        
        return {
            'face_detected': True,
            'emotion': mapped_emotion,
            'confidence': round(confidence, 2),
            'smoothed_emotion': smoothed_emotion,
            'smoothed_confidence': round(self._get_smoothed_confidence(), 2),
            'feedback': feedback,
            'interview_score': feedback['score'],
            'interview_metrics': interview_metrics
        }
    
    def _get_smoothed_emotion(self):
        """Get most common emotion from history with weighted approach"""
        if not self.emotion_history:
            return 'composed'
        
        weighted_emotions = list(self.emotion_history)
        recent_weight = 2
        
        if len(weighted_emotions) >= 2:
            weighted_emotions.extend(list(self.emotion_history)[-2:] * recent_weight)
        
        counts = {}
        for emotion in weighted_emotions:
            counts[emotion] = counts.get(emotion, 0) + 1
        
        return max(counts.items(), key=lambda x: x[1])[0]
    
    def _get_smoothed_confidence(self):
        """Calculate average confidence with recent bias"""
        if not self.confidence_history:
            return 0.0
        
        confidences = list(self.confidence_history)
        weights = list(range(1, len(confidences) + 1))
        weighted_sum = sum(c * w for c, w in zip(confidences, weights))
        weight_total = sum(weights)
        
        return weighted_sum / weight_total if weight_total > 0 else 0.0
    
    def _calculate_analytics(self):
        """Calculate session-wide analytics"""
        if not self.session_emotions:
            return {}
        
        emotion_counts = {}
        for record in self.session_emotions:
            emotion = record['emotion']
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        
        total = len(self.session_emotions)
        distribution = {
            emotion: round((count / total) * 100, 1)
            for emotion, count in emotion_counts.items()
        }
        
        scores = [self.FEEDBACK[record['emotion']]['score'] for record in self.session_emotions]
        avg_score = sum(scores) / len(scores) if scores else 0
        
        if len(scores) > 1:
            mean = sum(scores) / len(scores)
            variance = sum((x - mean) ** 2 for x in scores) / len(scores)
            consistency = max(0, 100 - (variance ** 0.5))
        else:
            consistency = 100
        
        duration = (datetime.now() - self.session_start).total_seconds()
        
        return {
            'total_detections': total,
            'emotion_distribution': distribution,
            'average_score': round(avg_score, 1),
            'consistency_score': round(consistency, 1),
            'session_duration': round(duration, 1),
            'dominant_emotion': max(emotion_counts.items(), key=lambda x: x[1])[0],
            'performance_trend': self._calculate_trend()
        }
    
    def _calculate_trend(self):
        """Calculate if performance is improving, declining, or stable"""
        if len(self.session_emotions) < 4:
            return 'insufficient_data'
        
        mid = len(self.session_emotions) // 2
        first_half = self.session_emotions[:mid]
        second_half = self.session_emotions[mid:]
        
        first_avg = sum(self.FEEDBACK[e['emotion']]['score'] for e in first_half) / len(first_half)
        second_avg = sum(self.FEEDBACK[e['emotion']]['score'] for e in second_half) / len(second_half)
        
        diff = second_avg - first_avg
        
        if diff > 5:
            return 'improving'
        elif diff < -5:
            return 'declining'
        else:
            return 'stable'
    
    def get_session_report(self):
        """Generate detailed session report"""
        if not self.session_emotions:
            return None
        
        analytics = self._calculate_analytics()
        
        avg_score = analytics['average_score']
        if avg_score >= 85:
            grade = 'A - Excellent'
            summary = 'Outstanding interview presence! You demonstrated strong confidence and engagement.'
        elif avg_score >= 70:
            grade = 'B - Good'
            summary = 'Good interview performance. With slight improvements, you\'ll excel.'
        elif avg_score >= 55:
            grade = 'C - Fair'
            summary = 'Fair performance. Focus on managing anxiety and showing more enthusiasm.'
        else:
            grade = 'D - Needs Improvement'
            summary = 'Your interview presence needs work. Practice emotional regulation and confidence building.'
        
        return {
            'grade': grade,
            'summary': summary,
            'analytics': analytics,
            'recommendations': self._get_recommendations(analytics)
        }
    
    def _get_recommendations(self, analytics):
        """Generate personalized recommendations"""
        recommendations = []
        dist = analytics.get('emotion_distribution', {})
        
        if dist.get('anxious', 0) > 30:
            recommendations.append('Practice mock interviews to reduce anxiety')
            recommendations.append('Use deep breathing techniques before interviews')
        
        if dist.get('low_energy', 0) > 25:
            recommendations.append('Work on projecting enthusiasm and energy')
            recommendations.append('Research the company to build genuine excitement')
        
        if dist.get('composed', 0) > 50 and dist.get('confident', 0) < 20:
            recommendations.append('Show more personality - let your passion shine through')
            recommendations.append('Practice smiling naturally when discussing achievements')
        
        if dist.get('tense', 0) > 15:
            recommendations.append('Practice relaxation techniques before interviews')
            recommendations.append('Reframe challenging questions positively')
        
        if analytics.get('consistency_score', 0) < 60:
            recommendations.append('Work on maintaining consistent emotional energy')
            recommendations.append('Practice emotional regulation techniques')
        
        if not recommendations:
            recommendations.append('Maintain your excellent interview presence!')
            recommendations.append('Keep practicing to stay sharp')
        
        return recommendations
    
    def reset(self):
        """Reset emotion history and metrics"""
        self.emotion_history.clear()
        self.confidence_history.clear()
        self.session_emotions.clear()
        self.face_position_history.clear()
        for key in self.metrics_history:
            self.metrics_history[key].clear()
        self.session_start = datetime.now()
        logger.info("Session reset - new interview session started")