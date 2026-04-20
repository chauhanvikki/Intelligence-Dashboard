# MongoDB Service for Intelligence Dashboard
from pymongo import MongoClient
from pymongo import DESCENDING

MONGO_URI = "mongodb+srv://singhvikki870_db_user:3lnQDQJBDvIegPHc@intelligence-dashboard.qrz3qvd.mongodb.net/"
DATABASE_NAME = "intelligence_dashboard"
COLLECTION_NAME = "intelligence"

class MongoDBService:
    def __init__(self):
        self.client = None
        self.db = None
        self.collection = None
        self._connect()
    
    def _connect(self):
        try:
            self.client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000, connectTimeoutMS=10000, ssl=True)
            self.client.admin.command('ping')
            self.db = self.client[DATABASE_NAME]
            self.collection = self.db[COLLECTION_NAME]
            print(f"Connected to MongoDB: {DATABASE_NAME}")
        except Exception as e:
            print(f"MongoDB connection error: {e}")
            self.client = None
            self.db = None
            self.collection = None
    
    def is_connected(self):
        if self.collection is None:
            return False
        try:
            self.collection.count_documents({})
            return True
        except:
            return False
    
    def get_all_markers(self):
        if self.collection is None or not self.is_connected():
            return []
        try:
            markers = list(self.collection.find({}, {'_id': 0}))
            for m in markers:
                if '_id' in m:
                    del m['_id']
            return markers
        except Exception as e:
            print(f"Error fetching markers: {e}")
            return []
    
    def get_marker_by_id(self, marker_id):
        if self.collection is None or not self.is_connected():
            return None
        try:
            marker = self.collection.find_one({'id': marker_id}, {'_id': 0})
            if marker and '_id' in marker:
                del marker['_id']
            return marker
        except Exception as e:
            print(f"Error fetching marker: {e}")
            return None
    
    def add_marker(self, marker_data):
        if self.collection is None or not self.is_connected():
            return None
        try:
            last_marker = self.collection.find_one(sort=[('id', DESCENDING)])
            new_id = (last_marker['id'] + 1) if last_marker else 1
            marker_data['id'] = new_id
            self.collection.insert_one(marker_data)
            if '_id' in marker_data:
                del marker_data['_id']
            return marker_data
        except Exception as e:
            print(f"Error adding marker: {e}")
            return None
    
    def update_marker(self, marker_id, data):
        if self.collection is None or not self.is_connected():
            return None
        try:
            result = self.collection.update_one({'id': marker_id}, {'$set': data})
            return self.get_marker_by_id(marker_id) if result.modified_count > 0 else None
        except Exception as e:
            print(f"Error updating marker: {e}")
            return None
    
    def delete_marker(self, marker_id):
        if self.collection is None or not self.is_connected():
            return False
        try:
            result = self.collection.delete_one({'id': marker_id})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error deleting marker: {e}")
            return False
    
    def bulk_insert(self, markers):
        if self.collection is None or not self.is_connected():
            return 0
        try:
            last_marker = self.collection.find_one(sort=[('id', DESCENDING)])
            start_id = (last_marker['id'] + 1) if last_marker else 1
            
            for i, marker in enumerate(markers):
                marker['id'] = start_id + i
                if '_id' in marker:
                    del marker['_id']
            
            result = self.collection.insert_many(markers)
            return len(result.inserted_ids) if hasattr(result, 'inserted_ids') else len(markers)
        except Exception as e:
            print(f"Error bulk insert: {e}")
            return 0
    
    def get_stats(self):
        if self.collection is None or not self.is_connected():
            return {'total': 0, 'osint': 0, 'humint': 0, 'imint': 0}
        try:
            total = self.collection.count_documents({})
            osint = self.collection.count_documents({'type': 'OSINT'})
            humint = self.collection.count_documents({'type': 'HUMINT'})
            imint = self.collection.count_documents({'type': 'IMINT'})
            return {'total': total, 'osint': osint, 'humint': humint, 'imint': imint}
        except:
            return {'total': 0, 'osint': 0, 'humint': 0, 'imint': 0}
    
    def close(self):
        if self.client:
            self.client.close()

mongo_service = MongoDBService()