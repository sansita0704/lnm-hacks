"""
Enhanced Emotion Detection MVP - Flask Server
With interview analytics and session reports
"""

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import base64
import numpy as np
import cv2
from emotion_detector import EmotionDetector
import logging
import json

app = Flask(__name__)
CORS(app)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize emotion detector with enhanced smoothing
detector = EmotionDetector(smoothing_window=7)

def convert_to_json_serializable(obj):
    """Convert numpy types to native Python types for JSON serialization"""
    if isinstance(obj, dict):
        return {key: convert_to_json_serializable(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_json_serializable(item) for item in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    else:
        return obj

@app.route('/')
def index():
    """Serve the main page"""
    return render_template('index.html')

@app.route('/detect', methods=['POST'])
def detect_emotion():
    """
    Detect emotion from base64 encoded image
    Expected JSON: {"image": "data:image/jpeg;base64,..."}
    """
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'success': False,
                'error': 'No image data provided'
            }), 400
        
        # Extract base64 image data
        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode base64 to image
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({
                'success': False,
                'error': 'Invalid image data'
            }), 400
        
        # Detect emotion
        result = detector.detect(img)

        if result.get('face_detected'):
            response = {
                'success': True,
                'emotion': str(result['emotion']),
                'confidence': float(result['confidence']),
                'smoothed_emotion': str(result['smoothed_emotion']),
                'smoothed_confidence': float(result['smoothed_confidence']),
                'feedback': convert_to_json_serializable(result['feedback']),
                'interview_score': int(result.get('interview_score', 75)),
                'analytics': convert_to_json_serializable(result.get('analytics', {})),
                'interview_metrics': convert_to_json_serializable(result.get('interview_metrics', {})),
                'face_detected': True
            }

            if 'all_emotions' in result:
                response['all_emotions'] = convert_to_json_serializable(result['all_emotions'])

            return jsonify(response)
        
        return jsonify({
            'success': False,
            'error': result.get('error', 'No face detected'),
            'face_detected': False
        })

    except Exception as e:
        logger.error(f"Error in detect_emotion: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500

@app.route('/reset', methods=['POST'])
def reset_session():
    """Reset emotion history and start new session"""
    detector.reset()
    return jsonify({
        'success': True, 
        'message': 'New interview session started'
    })

@app.route('/report', methods=['GET'])
def get_report():
    """Get session performance report"""
    report = detector.get_session_report()
    
    if report:
        # Convert to JSON serializable
        report_serializable = convert_to_json_serializable(report)
        return jsonify({
            'success': True,
            'report': report_serializable
        })
    else:
        return jsonify({
            'success': False,
            'error': 'No session data available'
        })

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy', 
        'service': 'emotion-detection-mvp',
        'version': '2.0-enhanced'
    })

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🎭 ENHANCED EMOTION DETECTION MVP v2.0")
    print("="*60)
    print("\n✨ New Features:")
    print("   • Interview-appropriate emotion labels")
    print("   • Improved accuracy with RetinaFace")
    print("   • Real-time interview score (0-100)")
    print("   • Session analytics & performance tracking")
    print("   • Personalized recommendations")
    print("   • 8 Interview Metrics (Emotion & Attitude + Behavior)")
    print("\n✅ Server starting...")
    print("📹 Open your browser to: http://localhost:5000")
    print("💡 Press Ctrl+C to stop\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)