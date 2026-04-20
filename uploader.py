# Intelligence Fusion Dashboard - File Uploader
# Phase 3: Image Upload Handler with S3 Integration

import os
import json
import boto3
from botocore.exceptions import ClientError
from datetime import datetime

# ========================================
# AWS S3 Configuration
# ========================================

# If you have real AWS credentials, set these environment variables
# Otherwise, files will be stored locally
AWS_ACCESS_KEY = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
AWS_BUCKET = os.environ.get('S3_BUCKET', 'intelligence-dashboard')

USE_S3 = bool(AWS_ACCESS_KEY and AWS_SECRET_KEY and AWS_BUCKET)

# Local fallback
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ========================================
# S3 Service
# ========================================

class S3Service:
    def __init__(self):
        self.client = None
        self.resource = None
        
        if USE_S3:
            try:
                self.client = boto3.client(
                    's3',
                    aws_access_key_id=AWS_ACCESS_KEY,
                    aws_secret_access_key=AWS_SECRET_KEY,
                    region_name=AWS_REGION
                )
                self.resource = boto3.resource(
                    's3',
                    aws_access_key_id=AWS_ACCESS_KEY,
                    aws_secret_access_key=AWS_SECRET_KEY,
                    region_name=AWS_REGION
                )
                print(f"S3 client initialized. Bucket: {AWS_BUCKET}")
            except Exception as e:
                print(f"Failed to initialize S3: {e}")
                self.client = None
    
    def upload_file(self, file_path, object_name=None):
        """Upload a file to S3"""
        if not self.client:
            return None
            
        if object_name is None:
            object_name = os.path.basename(file_path)
        
        try:
            self.client.upload_file(
                file_path,
                AWS_BUCKET,
                object_name,
                ExtraArgs={
                    'ContentType': self.get_content_type(object_name)
                }
            )
            
            # Return public URL
            url = f"https://{AWS_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{object_name}"
            return url
            
        except ClientError as e:
            print(f"S3 upload error: {e}")
            return None
    
    def delete_file(self, object_name):
        """Delete a file from S3"""
        if not self.client:
            return False
            
        try:
            self.client.delete_object(
                Bucket=AWS_BUCKET,
                Key=object_name
            )
            return True
        except ClientError as e:
            print(f"S3 delete error: {e}")
            return False
    
    def generate_presigned_url(self, object_name, expiration=3600):
        """Generate a presigned URL for downloading"""
        if not self.client:
            return None
            
        try:
            url = self.client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': AWS_BUCKET,
                    'Key': object_name
                },
                ExpiresIn=expiration
            )
            return url
        except ClientError as e:
            print(f"Presigned URL error: {e}")
            return None
    
    def get_content_type(self, filename):
        """Get content type based on file extension"""
        ext = filename.lower().split('.')[-1]
        types = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'pdf': 'application/pdf',
            'json': 'application/json',
            'csv': 'text/csv'
        }
        return types.get(ext, 'application/octet-stream')
    
    def list_files(self, prefix=''):
        """List files in S3 bucket"""
        if not self.client:
            return []
            
        try:
            response = self.client.list_objects_v2(
                Bucket=AWS_BUCKET,
                Prefix=prefix
            )
            
            files = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    files.append({
                        'key': obj['Key'],
                        'size': obj['Size'],
                        'last_modified': obj['LastModified'].isoformat()
                    })
            
            return files
        except ClientError as e:
            print(f"S3 list error: {e}")
            return []


# ========================================
# Image Processor
# ========================================

class ImageProcessor:
    @staticmethod
    def save_upload(file, folder=UPLOAD_FOLDER):
        """Save uploaded file locally"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{file.filename}"
        filepath = os.path.join(folder, filename)
        
        file.save(filepath)
        
        return {
            'filename': filename,
            'filepath': filepath,
            'url': f'/uploads/{filename}'
        }
    
    @staticmethod
    def validate_image(file):
        """Validate image file"""
        allowed_extensions = {'jpg', 'jpeg', 'png', 'gif'}
        allowed_types = {'image/jpeg', 'image/png', 'image/gif'}
        
        filename = file.filename.lower()
        ext = filename.split('.')[-1]
        
        if ext not in allowed_extensions:
            return False, "Invalid file extension"
        
        if file.content_type not in allowed_types:
            return False, "Invalid file type"
        
        # Check file size (max 10MB)
        file.seek(0, 2)
        size = file.tell()
        file.seek(0)
        
        if size > 10 * 1024 * 1024:
            return False, "File too large (max 10MB)"
        
        return True, "Valid"
    
    @staticmethod
    def create_marker_from_image(file_data, lat, lng, title):
        """Create a marker entry from uploaded image"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        marker = {
            'id': int(datetime.now().timestamp()),
            'lat': float(lat),
            'lng': float(lng),
            'type': 'IMINT',
            'title': title or f"IMINT - {timestamp}",
            'description': f"Uploaded image: {file_data['filename']}",
            'image': file_data['url'],
            'timestamp': datetime.now().isoformat() + 'Z'
        }
        
        return marker


# ========================================
# CSV Parser
# ========================================

class CSVParser:
    @staticmethod
    def parse_csv_file(file):
        """Parse CSV file and return markers"""
        content = file.read().decode('utf-8')
        lines = content.strip().split('\n')
        
        if len(lines) < 2:
            return [], "CSV file is empty"
        
        # Parse headers
        headers = [h.strip().lower() for h in lines[0].split(',')]
        
        # Find column indices
        lat_idx = next((i for i, h in enumerate(headers) if 'lat' in h), -1)
        lng_idx = next((i for i, h in enumerate(headers) if 'lng' in h or 'lon' in h), -1)
        type_idx = next((i for i, h in enumerate(headers) if 'type' in h), -1)
        title_idx = next((i for i, h in enumerate(headers) if 'title' in h or 'name' in h), -1)
        desc_idx = next((i for i, h in enumerate(headers) if 'desc' in h or 'description' in h), -1)
        image_idx = next((i for i, h in enumerate(headers) if 'image' in h or 'url' in h), -1)
        
        if lat_idx == -1 or lng_idx == -1:
            return [], "CSV must have lat and lng columns"
        
        # Parse data rows
        markers = []
        
        for i, line in enumerate(lines[1:], 1):
            if not line.strip():
                continue
                
            values = [v.strip().strip('"') for v in line.split(',')]
            
            try:
                lat = float(values[lat_idx])
                lng = float(values[lng_idx])
                
                if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                    continue
                
                marker = {
                    'id': int(datetime.now().timestamp()) + i,
                    'lat': lat,
                    'lng': lng,
                    'type': values[type_idx].upper() if type_idx >= 0 and type_idx < len(values) else 'OSINT',
                    'title': values[title_idx] if title_idx >= 0 and title_idx < len(values) else f"Marker {i}",
                    'description': values[desc_idx] if desc_idx >= 0 and desc_idx < len(values) else '',
                    'image': values[image_idx] if image_idx >= 0 and image_idx < len(values) else None,
                    'timestamp': datetime.now().isoformat() + 'Z'
                }
                
                markers.append(marker)
                
            except (ValueError, IndexError) as e:
                continue
        
        return markers, f"Parsed {len(markers)} markers"
    
    @staticmethod
    def generate_sample_csv():
        """Generate a sample CSV template"""
        return """lat,lng,type,title,description
40.7128,-74.006,OSINT,NYC Financial District,Unusual activity detected
51.5074,-0.1278,HUMINT,London Field Report,Source report
35.6762,139.6503,IMINT,Tokyo Port,Shipment activity"""


# ========================================
# JSON Parser
# ========================================

class JSONParser:
    @staticmethod
    def parse_json_file(file):
        """Parse JSON file and return markers"""
        try:
            content = file.read().decode('utf-8')
            data = json.loads(content)
            
            # Handle both array and object formats
            if isinstance(data, list):
                markers = data
            elif isinstance(data, dict):
                markers = data.get('markers', data.get('data', []))
            else:
                return [], "Invalid JSON format"
            
            # Validate and normalize markers
            valid_markers = []
            for m in markers:
                if 'lat' in m and 'lng' in m:
                    valid_markers.append({
                        'id': m.get('id', int(datetime.now().timestamp())),
                        'lat': float(m['lat']),
                        'lng': float(m['lng']),
                        'type': m.get('type', 'OSINT').upper(),
                        'title': m.get('title', 'Untitled'),
                        'description': m.get('description', ''),
                        'image': m.get('image'),
                        'timestamp': m.get('timestamp', datetime.now().isoformat() + 'Z')
                    })
            
            return valid_markers, f"Parsed {len(valid_markers)} markers"
            
        except json.JSONDecodeError as e:
            return [], f"Invalid JSON: {str(e)}"
        except Exception as e:
            return [], f"Error: {str(e)}"
    
    @staticmethod
    def generate_sample_json():
        """Generate a sample JSON template"""
        sample = {
            "markers": [
                {
                    "lat": 40.7128,
                    "lng": -74.006,
                    "type": "OSINT",
                    "title": "NYC Activity",
                    "description": "Test marker"
                }
            ]
        }
        return json.dumps(sample, indent=2)


# ========================================
# Initialize Services
# ========================================

s3_service = S3Service() if USE_S3 else None


# ========================================
# Main
# ========================================

if __name__ == '__main__':
    print("=" * 50)
    print("Intelligence Dashboard - File Uploader")
    print("=" * 50)
    print(f"Mode: {'S3 Storage' if USE_S3 else 'Local Storage'}")
    print(f"Upload Folder: {UPLOAD_FOLDER}")
    print("=" * 50)