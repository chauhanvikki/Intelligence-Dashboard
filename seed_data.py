import os
import sys
sys.path.insert(0, os.getcwd())

from pymongo import MongoClient
from config import MONGO_URI, DATABASE_NAME, COLLECTION_NAME

# Sample intelligence data
markers = [
    {
        "lat": 28.6139,
        "lng": 77.209,
        "type": "OSINT",
        "title": "Protest Alert - Delhi",
        "description": "Crowd gathering reported near central area",
        "image": "http://example.com/image1.jpg",
        "timestamp": "2026-04-18T14:30:00Z",
        "source": "Twitter"
    },
    {
        "lat": 31.326,
        "lng": 75.5762,
        "type": "HUMINT",
        "title": "Suspicious Activity - Punjab",
        "description": "Unknown vehicles spotted by local resident",
        "image": "http://example.com/image2.jpg",
        "timestamp": "2026-04-18T16:00:00Z",
        "source": "Local Report"
    },
    {
        "lat": 19.076,
        "lng": 72.8777,
        "type": "IMINT",
        "title": "Satellite Observation - Mumbai",
        "description": "Unusual structure detected in satellite image",
        "image": "http://example.com/image3.jpg",
        "timestamp": "2026-04-17T10:15:00Z",
        "source": "Satellite"
    },
    {
        "lat": 22.5726,
        "lng": 88.3639,
        "type": "OSINT",
        "title": "Traffic Congestion - Kolkata",
        "description": "Heavy traffic reported due to accident",
        "image": "http://example.com/image4.jpg",
        "timestamp": "2026-04-18T09:45:00Z",
        "source": "News"
    },
    {
        "lat": 26.9124,
        "lng": 75.7873,
        "type": "HUMINT",
        "title": "Fire Incident - Jaipur",
        "description": "Fire reported in residential building",
        "image": "http://example.com/image5.jpg",
        "timestamp": "2026-04-18T11:20:00Z",
        "source": "Emergency Call"
    },
    {
        "lat": 40.7128,
        "lng": -74.006,
        "type": "OSINT",
        "title": "NYC Financial District",
        "description": "Detected unusual communications from financial towers",
        "image": None,
        "timestamp": "2026-04-15T14:30:00Z",
        "source": "System"
    },
    {
        "lat": 51.5074,
        "lng": -0.1278,
        "type": "HUMINT",
        "title": "London Field Report",
        "description": "Source reports increased security near government building",
        "image": None,
        "timestamp": "2026-04-16T09:15:00Z",
        "source": "System"
    },
    {
        "lat": 35.6762,
        "lng": 139.6503,
        "type": "IMINT",
        "title": "Tokyo Port Satellite",
        "description": "Satellite capture of unusual vessel activity at Tokyo harbor",
        "image": "https://via.placeholder.com/400x250?text=Tokyo+Harbor",
        "timestamp": "2026-04-17T06:00:00Z",
        "source": "System"
    }
]

# Connect and insert
client = MongoClient(MONGO_URI)
db = client[DATABASE_NAME]
collection = db[COLLECTION_NAME]

# Clear and insert fresh
collection.delete_many({})
collection.insert_many(markers)

print(f"Inserted {len(markers)} markers into MongoDB")

# Verify
count = collection.count_documents({})
print(f"Total markers in database: {count}")