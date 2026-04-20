import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

// ========================================
// Configuration
// ========================================

const CONFIG = {
  mapCenter: [30, 0],
  defaultZoom: 2,
  tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  markerIcons: {
    OSINT: { icon: 'fa-satellite-dish', color: '#58a6ff' },
    HUMINT: { icon: 'fa-user-secret', color: '#3fb950' },
    IMINT: { icon: 'fa-camera', color: '#f85149' }
  }
};

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ========================================
// Services
// ========================================

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

const fetchMarkers = async () => {
  try {
    const response = await api.get('/markers');
    return response.data.markers || [];
  } catch (error) {
    console.error('Error fetching markers:', error);
    return [];
  }
};

const uploadCSV = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/upload/csv', formData);
  return response.data;
};

const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/upload/image', formData);
  return response.data;
};

// ========================================
// Custom Hooks
// ========================================

function useMarkers() {
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMarkers = async () => {
    setLoading(true);
    try {
      const data = await fetchMarkers();
      setMarkers(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarkers();
  }, []);

  return { markers, loading, error, reload: loadMarkers };
}

// ========================================
// Components
// ========================================

function Header() {
  return (
    <header className="header">
      <div className="logo">
        <i className="fas fa-globe-americas"></i>
        <span>Intelligence Fusion Dashboard</span>
      </div>
      <div className="header-controls">
        <div className="status-indicator">
          <span className="status-dot online"></span>
          <span>System Online</span>
        </div>
      </div>
    </header>
  );
}

function createMarkerIcon(type) {
  const config = CONFIG.markerIcons[type] || CONFIG.markerIcons.OSINT;
  
  return L.divIcon({
    className: 'custom-marker-wrapper',
    html: `
      <div className="custom-marker ${type.toLowerCase()}">
        <i className="fas ${config.icon}"></i>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
}

function MapPopup({ marker }) {
  const typeClass = marker.type.toLowerCase();
  const formattedDate = new Date(marker.timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <Popup>
      <div className="popup-content">
        <div className="popup-header">
          <span className={`popup-type-badge ${typeClass}`}>{marker.type}</span>
          <span className="popup-title">{marker.title}</span>
        </div>
        <div className="popup-body">
          <p className="popup-description">{marker.description}</p>
          {marker.image && (
            <img 
              src={marker.image} 
              alt={marker.title} 
              className="popup-image"
              onError={(e) => e.target.style.display = 'none'}
            />
          )}
        </div>
        <div className="popup-footer">
          <span className="popup-timestamp">{formattedDate}</span>
          <span className="popup-coords">
            {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}
          </span>
        </div>
      </div>
    </Popup>
  );
}

function IntelligenceMap({ markers, onMarkerClick }) {
  return (
    <MapContainer
      center={CONFIG.mapCenter}
      zoom={CONFIG.defaultZoom}
      className="map-container"
      zoomControl={true}
    >
      <TileLayer
        attribution={CONFIG.attribution}
        url={CONFIG.tileLayer}
        maxZoom={18}
      />
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.lat, marker.lng]}
          icon={createMarkerIcon(marker.type)}
          eventHandlers={{
            click: () => onMarkerClick && onMarkerClick(marker)
          }}
        >
          <MapPopup marker={marker} />
        </Marker>
      ))}
    </MapContainer>
  );
}

function MapLegend() {
  return (
    <div className="map-legend">
      <div className="legend-item">
        <span className="dot osint"></span> OSINT
      </div>
      <div className="legend-item">
        <span className="dot humint"></span> HUMINT
      </div>
      <div className="legend-item">
        <span className="dot imint"></span> IMINT
      </div>
    </div>
  );
}

function FilterButtons({ activeFilter, onFilterChange }) {
  const filters = [
    { id: 'all', label: 'All', color: 'all' },
    { id: 'OSINT', label: 'OSINT', color: 'osint' },
    { id: 'HUMINT', label: 'HUMINT', color: 'humint' },
    { id: 'IMINT', label: 'IMINT', color: 'imint' }
  ];

  return (
    <div className="filter-buttons">
      {filters.map((filter) => (
        <button
          key={filter.id}
          className={`filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
          onClick={() => onFilterChange(filter.id)}
        >
          <span className={`dot ${filter.color}`}></span>
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function FileUploader({ onUpload }) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (ext === 'csv' || ext === 'json') {
      await onUpload(file);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className={`upload-zone ${dragOver ? 'dragover' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      <i className="fas fa-cloud-upload-alt"></i>
      <p>Drag & drop CSV/JSON here</p>
      <span>or click to browse</span>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json"
        onChange={handleChange}
        hidden
      />
    </div>
  );
}

function ReportList({ markers, onReportClick }) {
  if (markers.length === 0) {
    return (
      <div className="empty-state">
        <i className="fas fa-inbox"></i>
        <p>No reports found</p>
      </div>
    );
  }

  return (
    <div className="report-list">
      {markers.map((marker) => {
        const typeClass = marker.type.toLowerCase();
        const formattedDate = new Date(marker.timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        return (
          <div
            key={marker.id}
            className="report-item"
            onClick={() => onReportClick && onReportClick(marker)}
          >
            <div className="report-item-header">
              <span className="report-item-title">{marker.title}</span>
              <span className={`report-item-type ${typeClass}`}>{marker.type}</span>
            </div>
            <p className="report-item-desc">{marker.description}</p>
            <span className="report-item-time">{formattedDate}</span>
          </div>
        );
      })}
    </div>
  );
}

function Sidebar({ markers, activeFilter, onFilterChange, onUpload, onReportClick }) {
  const filteredMarkers = useMemo(() => {
    if (activeFilter === 'all') return markers;
    return markers.filter((m) => m.type === activeFilter);
  }, [markers, activeFilter]);

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <h3><i className="fas fa-filter"></i> Intelligence Filters</h3>
        <FilterButtons
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
        />
      </div>

      <div className="sidebar-section">
        <h3><i className="fas fa-upload"></i> Data Upload</h3>
        <FileUploader onUpload={onUpload} />
      </div>

      <div className="sidebar-section">
        <h3><i className="fas fa-list"></i> Intelligence Reports</h3>
        <ReportList
          markers={filteredMarkers}
          onReportClick={onReportClick}
        />
      </div>
    </aside>
  );
}

function MapController({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 12, { duration: 1 });
    }
  }, [center, zoom, map]);
  
  return null;
}

// ========================================
// Main App
// ========================================

function App() {
  const { markers, loading, error, reload } = useMarkers();
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedMarker, setSelectedMarker] = useState(null);
  const mapRef = useRef(null);

  const handleUpload = async (file) => {
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      
      if (ext === 'csv') {
        await uploadCSV(file);
      } else if (ext === 'json') {
        // Handle JSON upload similarly
        console.log('JSON upload not implemented in demo');
      }
      
      reload();
    } catch (err) {
      console.error('Upload error:', err);
    }
  };

  const handleMarkerClick = (marker) => {
    setSelectedMarker(marker);
  };

  const handleReportClick = (marker) => {
    setSelectedMarker(marker);
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  if (loading) {
    return (
      <div className="app-container">
        <Header />
        <div className="loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header />
      
      <main className="main-content">
        <Sidebar
          markers={markers}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          onUpload={handleUpload}
          onReportClick={handleReportClick}
        />
        
        <div className="map-wrapper">
          <IntelligenceMap
            markers={activeFilter === 'all' 
              ? markers 
              : markers.filter(m => m.type === activeFilter)
            }
            onMarkerClick={handleMarkerClick}
          />
          <MapLegend />
          
          {selectedMarker && (
            <MapController
              center={[selectedMarker.lat, selectedMarker.lng]}
              zoom={12}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;