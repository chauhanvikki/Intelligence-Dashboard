# Intelligence Fusion Dashboard

A multi-source intelligence visualization platform combining OSINT, HUMINT, and IMINT data on an interactive geospatial map.

## Project Structure

```
intelligence-dashboard/
├── index.html          # Phase 1 - Static HTML demo
├── style.css          # Styles
├── app.js            # JavaScript logic
├── markers.json      # Dummy data
├── server.py        # Phase 2 - Flask API
├── uploader.py     # Phase 3 - File upload handler
├── uploads/        # Uploaded files directory
├── frontend/      # Phase 4 - React frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
├── sample_intelligence.csv   # Test data (CSV format)
├── sample_intelligence.json # Test data (JSON format)
└── run.bat          # Double-click to run server
```

## Quick Start

### Option 1: Static Demo (No server needed)

Simply open `index.html` in a browser:
```
Open index.html in Chrome/Firefox/Edge
```

### Option 2: With Flask API

1. Install Python dependencies:
```bash
pip install flask flask-cors
```

2. Run the server:
```bash
python server.py
```

3. Open `index.html` - it will fetch from API at localhost:5000

### Option 3: Full React Stack

1. Install frontend dependencies:
```bash
cd frontend
npm install
```

2. Start both servers (in separate terminals):
```bash
# Terminal 1: Flask backend
python server.py

# Terminal 2: React frontend
cd frontend
npm run dev
```

3. Open http://localhost:3000

## Features

### Phase 1: Map Visualization
- OpenStreetMap tile layer
- 3 dummy intelligence markers
- Hover popup with details
- Dark theme UI

### Phase 2: API Integration
- RESTful Flask API
- CRUD operations for markers
- JSON file storage

### Phase 3: Data Upload
- CSV file upload with lat/lng parsing
- JSON file upload
- Image upload support (local/S3)

### Phase 4: React Frontend
- Filter buttons (All/OSINT/HUMINT/IMINT)
- Drag-and-drop file upload
- Real-time report list
- Click-to-pan map

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/markers | Get all markers |
| GET | /api/markers/:id | Get single marker |
| POST | /api/markers | Add new marker |
| PUT | /api/markers/:id | Update marker |
| DELETE | /api/markers/:id | Delete marker |
| POST | /api/upload/csv | Upload CSV |
| POST | /api/upload/image | Upload image |
| GET | /api/stats | Get statistics |

## Data Format

### Marker JSON
```json
{
  "id": 1,
  "lat": 40.7128,
  "lng": -74.006,
  "type": "OSINT",
  "title": "NYC Activity",
  "description": "Intelligence report",
  "image": null,
  "timestamp": "2026-04-15T14:30:00Z"
}
```

### CSV Format
```csv
lat,lng,type,title,description
40.7128,-74.006,OSINT,NYC Activity,Test description
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Map | Leaflet.js |
| Tiles | OpenStreetMap |
| Backend | Python + Flask |
| Frontend | React + Vite |
| HTTP | Axios |

## Color Coding

| Type | Color | Icon |
|------|-------|------|
| OSINT | Blue | Satellite dish |
| HUMINT | Green | User/secret |
| IMINT | Red | Camera |

## Production Notes

To connect real AWS S3:
1. Set environment variables:
   - AWS_ACCESS_KEY_ID
   - AWS_SECRET_ACCESS_KEY
   - S3_BUCKET
   - AWS_REGION (default: us-east-1)

2. The uploader.py will automatically use S3 when credentials are provided

## License

MIT - For demonstration purposes