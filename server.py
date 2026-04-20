# Intelligence Fusion Dashboard - Flask Backend
# Using MongoDB for storage

from flask import Flask, jsonify, request, send_from_directory, render_template
from flask_cors import CORS
import os
from datetime import datetime
from mongo_service import mongo_service

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = 'uploads'

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ========================================
# Frontend Routes
# ========================================

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('.', filename)


# ========================================
# API Routes
# ========================================

@app.route('/api/markers', methods=['GET'])
def get_markers():
    try:
        markers = mongo_service.get_all_markers()
        return jsonify({'markers': markers})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/markers/<int:marker_id>', methods=['GET'])
def get_marker(marker_id):
    try:
        marker = mongo_service.get_marker_by_id(marker_id)
        if marker:
            return jsonify(marker)
        return jsonify({'error': 'Marker not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/markers', methods=['POST'])
def add_marker():
    try:
        data = request.get_json()
        
        new_marker = {
            'lat': data.get('lat'),
            'lng': data.get('lng'),
            'type': data.get('type', 'OSINT'),
            'title': data.get('title', 'New Marker'),
            'description': data.get('description', ''),
            'image': data.get('image'),
            'timestamp': datetime.now().isoformat() + 'Z'
        }
        
        saved_marker = mongo_service.add_marker(new_marker)
        if saved_marker:
            return jsonify(saved_marker), 201
        return jsonify({'error': 'Failed to add marker to MongoDB'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/markers/<int:marker_id>', methods=['PUT'])
def update_marker(marker_id):
    try:
        data = request.get_json()
        data['timestamp'] = datetime.now().isoformat() + 'Z'
        
        updated_marker = mongo_service.update_marker(marker_id, data)
        if updated_marker:
            return jsonify(updated_marker)
        return jsonify({'error': 'Marker not found or update failed'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/markers/<int:marker_id>', methods=['DELETE'])
def delete_marker(marker_id):
    try:
        success = mongo_service.delete_marker(marker_id)
        if success:
            return jsonify({'success': True})
        return jsonify({'error': 'Marker not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/upload/csv', methods=['POST'])
def upload_csv():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if not file.filename.endswith('.csv'):
            return jsonify({'error': 'File must be CSV'}), 400
        
        content = file.read().decode('utf-8')
        lines = content.strip().split('\n')
        
        if len(lines) < 2:
            return jsonify({'error': 'CSV is empty'}), 400
        
        headers = [h.strip().lower() for h in lines[0].split(',')]
        
        lat_idx = next((i for i, h in enumerate(headers) if h in ['lat', 'latitude']), -1)
        lng_idx = next((i for i, h in enumerate(headers) if h in ['lng', 'longitude']), -1)
        type_idx = next((i for i, h in enumerate(headers) if h == 'type'), -1)
        title_idx = next((i for i, h in enumerate(headers) if h == 'title'), 0)
        desc_idx = next((i for i, h in enumerate(headers) if 'desc' in h), -1)
        
        if lat_idx == -1 or lng_idx == -1:
            return jsonify({'error': 'CSV must have lat/latitude and lng/longitude columns'}), 400
        
        new_markers = []
        
        for i, line in enumerate(lines[1:], 1):
            values = [v.strip().strip('"') for v in line.split(',')]
            
            if lat_idx < len(values) and lng_idx < len(values):
                try:
                    lat = float(values[lat_idx])
                    lng = float(values[lng_idx])
                    
                    new_marker = {
                        'lat': lat,
                        'lng': lng,
                        'type': values[type_idx].upper() if type_idx >= 0 and type_idx < len(values) else 'OSINT',
                        'title': values[title_idx] if title_idx >= 0 and title_idx < len(values) else f'Marker {i}',
                        'description': values[desc_idx] if desc_idx >= 0 and desc_idx < len(values) else '',
                        'image': None,
                        'timestamp': datetime.now().isoformat() + 'Z'
                    }
                    new_markers.append(new_marker)
                except (ValueError, IndexError):
                    continue
        
        added_count = mongo_service.bulk_insert(new_markers)
        
        return jsonify({
            'success': True,
            'added': added_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/upload/json', methods=['POST'])
def upload_json():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if not file.filename.endswith('.json'):
            return jsonify({'error': 'File must be JSON'}), 400
        
        import json
        content = file.read().decode('utf-8')
        data = json.loads(content)
        
        new_markers = []
        if isinstance(data, list):
            new_markers = data
        elif isinstance(data, dict):
            new_markers = data.get('markers', data.get('data', []))
        
        if not new_markers:
            return jsonify({'error': 'No markers found in JSON'}), 400
            
        # Clean up any _id or id fields so Mongo handles it cleanly
        for m in new_markers:
            m['timestamp'] = datetime.now().isoformat() + 'Z'
            if '_id' in m:
                del m['_id']
            if 'id' in m:
                del m['id']
        
        added_count = mongo_service.bulk_insert(new_markers)
        
        return jsonify({
            'success': True,
            'added': added_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/upload/image', methods=['POST'])
def upload_image():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if not file.filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            return jsonify({'error': 'File must be JPG or PNG'}), 400
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{file.filename}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        file.save(filepath)
        
        return jsonify({
            'success': True,
            'filename': filename
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/uploads/<path:filename>')
def get_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        stats = mongo_service.get_stats()
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/search', methods=['GET'])
def search_markers():
    try:
        q = request.args.get('q', '').lower()
        if not q:
            return jsonify({'markers': []})
        
        markers = mongo_service.get_all_markers()
        
        results = [
            m for m in markers
            if q in m.get('title', '').lower() or q in m.get('description', '').lower()
        ]
        
        return jsonify({'markers': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/healthz', methods=['GET'])
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'mongodb_connected': mongo_service.is_connected(),
        'timestamp': datetime.now().isoformat()
    })


if __name__ == '__main__':
    print("=" * 50)
    print("Intelligence Fusion Dashboard - API Server")
    print("=" * 50)
    print("Storage: MongoDB Cluster")
    print("Connected:" , "YES" if mongo_service.is_connected() else "NO")
    print("Server running at: http://localhost:5000")
    print("API Endpoints:")
    print("  GET    /api/markers       - Get all markers")
    print("  GET    /api/markers/:id   - Get single marker")
    print("  POST   /api/markers       - Add new marker")
    print("  PUT    /api/markers/:id  - Update marker")
    print("  DELETE /api/markers/:id   - Delete marker")
    print("  POST   /api/upload/csv    - Upload CSV")
    print("  POST   /api/upload/json   - Upload JSON")
    print("  POST   /api/upload/image - Upload image")
    print("  GET    /api/stats        - Get statistics")
    print("  GET    /api/health      - Health check")
    print("=" * 50)
    
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)