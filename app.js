// ========================================
// Intelligence Fusion Dashboard - Enhanced App
// ========================================

(function() {
    'use strict';

    // ========================================
    // Configuration
    // ========================================

    const BASE_URL = 'https://intelligence-dashboard-qwgr.onrender.com';

    const CONFIG = {
        mapCenter: [30, 0],
        defaultZoom: 2,
        tileLayers: {
            dark: {
                url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            },
            standard: {
                url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            },
            satellite: {
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                attribution: '&copy; Esri &mdash; Earthstar Geographics'
            }
        },
        markerIcons: {
            OSINT: { icon: 'fa-satellite-dish', color: '#4d9fff' },
            HUMINT: { icon: 'fa-user-secret', color: '#34d399' },
            IMINT: { icon: 'fa-camera', color: '#f0605d' }
        }
    };

    // ========================================
    // State
    // ========================================

    let map;
    let currentTileLayer;
    let markers = [];
    let allMarkerData = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let pickingCoords = false;
    let selectedImageFile = null;

    // ========================================
    // DOM Elements
    // ========================================

    const el = {
        map: document.getElementById('map'),
        reportList: document.getElementById('reportList'),
        uploadZone: document.getElementById('uploadZone'),
        fileInput: document.getElementById('fileInput'),
        filterButtons: document.querySelectorAll('.filter-btn'),
        searchInput: document.getElementById('searchInput'),
        searchRecommendations: document.getElementById('searchRecommendations'),
        sidebar: document.getElementById('sidebar'),
        sidebarToggle: document.getElementById('sidebarToggle'),
        liveClock: document.getElementById('liveClock'),
        btnAddMarker: document.getElementById('btnAddMarker'),
        markerModal: document.getElementById('markerModal'),
        modalClose: document.getElementById('modalClose'),
        modalCancel: document.getElementById('modalCancel'),
        modalSubmit: document.getElementById('modalSubmit'),
        markerTitle: document.getElementById('markerTitle'),
        markerDesc: document.getElementById('markerDesc'),
        markerType: document.getElementById('markerType'),
        markerLat: document.getElementById('markerLat'),
        markerLng: document.getElementById('markerLng'),
        markerImage: document.getElementById('markerImage'),
        imageUploadArea: document.getElementById('imageUploadArea'),
        imageUploadPlaceholder: document.getElementById('imageUploadPlaceholder'),
        imagePreview: document.getElementById('imagePreview'),
        imageRemoveBtn: document.getElementById('imageRemoveBtn'),
        toastContainer: document.getElementById('toastContainer'),
        statTotal: document.getElementById('statTotal'),
        statOsint: document.getElementById('statOsint'),
        statHumint: document.getElementById('statHumint'),
        statImint: document.getElementById('statImint'),
        tileButtons: document.querySelectorAll('.tile-btn'),
        btnPickMap: document.getElementById('btnPickMap')
    };

    // ========================================
    // Toast Notifications
    // ========================================

    function showToast(message, type = 'info') {
        const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span class="toast-msg">${message}</span>`;
        el.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // ========================================
    // Live Clock
    // ========================================

    function updateClock() {
        const now = new Date();
        el.liveClock.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    }

    // ========================================
    // Stats
    // ========================================

    function animateValue(element, target) {
        const current = parseInt(element.textContent) || 0;
        if (current === target) return;
        const step = target > current ? 1 : -1;
        const duration = 400;
        const steps = Math.abs(target - current);
        const interval = Math.max(duration / steps, 20);
        let val = current;
        const timer = setInterval(() => {
            val += step;
            element.textContent = val;
            if (val === target) clearInterval(timer);
        }, interval);
    }

    function updateStats(data) {
        const total = data.length;
        const osint = data.filter(m => m.type === 'OSINT').length;
        const humint = data.filter(m => m.type === 'HUMINT').length;
        const imint = data.filter(m => m.type === 'IMINT').length;
        animateValue(el.statTotal, total);
        animateValue(el.statOsint, osint);
        animateValue(el.statHumint, humint);
        animateValue(el.statImint, imint);
    }

    // ========================================
    // Initialize Map
    // ========================================

    function initMap() {
        map = L.map('map', {
            center: CONFIG.mapCenter,
            zoom: CONFIG.defaultZoom,
            zoomControl: true,
            attributionControl: true
        });

        setTileLayer('dark');
        map.zoomControl.setPosition('bottomleft');

        // Map click for coordinate picking
        map.on('click', function(e) {
            if (pickingCoords) {
                el.markerLat.value = e.latlng.lat.toFixed(6);
                el.markerLng.value = e.latlng.lng.toFixed(6);
                pickingCoords = false;
                document.body.classList.remove('map-pick-mode');
                showToast('Coordinates captured!', 'success');
                el.markerModal.classList.add('active'); // Re-open modal
            }
        });

        loadMarkers();
    }

    // ========================================
    // Tile Layer Switching
    // ========================================

    function setTileLayer(name) {
        if (currentTileLayer) map.removeLayer(currentTileLayer);
        const config = CONFIG.tileLayers[name];
        currentTileLayer = L.tileLayer(config.url, {
            attribution: config.attribution,
            maxZoom: 18
        }).addTo(map);

        el.tileButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tile === name);
        });
    }

    // ========================================
    // Create Custom Marker Icon
    // ========================================

    function createMarkerIcon(type) {
        const config = CONFIG.markerIcons[type] || CONFIG.markerIcons.OSINT;
        return L.divIcon({
            className: 'custom-marker-wrapper',
            html: `
                <div class="marker-pulse ${type.toLowerCase()}"></div>
                <div class="custom-marker ${type.toLowerCase()}">
                    <i class="fas ${config.icon}"></i>
                </div>
            `,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
            popupAnchor: [0, -17]
        });
    }

    // ========================================
    // Create Popup Content
    // ========================================

    function createPopupContent(marker) {
        const typeClass = marker.type.toLowerCase();
        const fullImageUrl = marker.image && !marker.image.startsWith('http') ? `${BASE_URL}${marker.image}` : marker.image;
        const imageHtml = fullImageUrl
            ? `<img src="${fullImageUrl}" alt="${marker.title}" class="popup-image" onerror="this.style.display='none'">`
            : '';
        const formattedDate = new Date(marker.timestamp).toLocaleString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        return `
            <div class="popup-content">
                <div class="popup-header">
                    <span class="popup-type-badge ${typeClass}">${marker.type}</span>
                    <span class="popup-title">${marker.title}</span>
                </div>
                <div class="popup-body">
                    <p class="popup-description">${marker.description || 'No description available.'}</p>
                    ${imageHtml}
                </div>
                <div class="popup-footer">
                    <span class="popup-timestamp">${formattedDate}</span>
                    <span class="popup-coords">${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}</span>
                </div>
            </div>
        `;
    }

    // ========================================
    // Add Marker to Map
    // ========================================

    function createRichTooltip(markerData) {
        const typeClass = markerData.type.toLowerCase();
        const formattedDate = new Date(markerData.timestamp).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
        const fullImageUrl = markerData.image && !markerData.image.startsWith('http') ? `${BASE_URL}${markerData.image}` : markerData.image;
        const hasImage = !!fullImageUrl;
        const imgHtml = hasImage
            ? `<img class="rich-tooltip-img" src="${fullImageUrl}" alt="${markerData.title}" onerror="this.style.display='none'" />`
            : '';
        const noImgClass = hasImage ? '' : ' rich-tooltip-noimg';
        return `
            <div class="${noImgClass}">
                ${imgHtml}
                <div class="rich-tooltip-body">
                    <span class="rich-tooltip-badge ${typeClass}">${markerData.type}</span>
                    <div class="rich-tooltip-title">${markerData.title}</div>
                    <div class="rich-tooltip-desc">${markerData.description || 'No description'}</div>
                    <div class="rich-tooltip-meta">
                        <span class="rich-tooltip-time">${formattedDate}</span>
                        <span class="rich-tooltip-coords">${markerData.lat.toFixed(4)}, ${markerData.lng.toFixed(4)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    function addMarkerToMap(markerData) {
        const marker = L.marker([markerData.lat, markerData.lng], {
            icon: createMarkerIcon(markerData.type)
        });
        marker.bindPopup(createPopupContent(markerData), { maxWidth: 320, className: 'custom-popup' });
        marker.bindTooltip(createRichTooltip(markerData), {
            permanent: false,
            direction: 'top',
            offset: [0, -24],
            className: 'rich-tooltip',
            opacity: 1
        });
        marker.addTo(map);
        marker._data = markerData;
        markers.push(marker);
        return marker;
    }

    // ========================================
    // Load Markers
    // ========================================

    function loadMarkers() {
        markers.forEach(m => map.removeLayer(m));
        markers = [];

        fetch(`${BASE_URL}/api/markers`)
            .then(r => r.json())
            .then(data => {
                allMarkerData = data.markers || [];
                allMarkerData.forEach(m => addMarkerToMap(m));
                updateStats(allMarkerData);
                applyFilters();
                showToast(`Loaded ${allMarkerData.length} intelligence markers`, 'success');
            })
            .catch(err => {
                console.error('Error loading markers:', err);
                showToast('Failed to load markers', 'error');
            });
    }

    // ========================================
    // Filter & Search
    // ========================================

    function applyFilters() {
        let filtered = allMarkerData;

        if (currentFilter !== 'all') {
            filtered = filtered.filter(m => m.type === currentFilter);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(m =>
                (m.title && m.title.toLowerCase().includes(q)) ||
                (m.description && m.description.toLowerCase().includes(q))
            );
        }

        // Show/hide markers on map
        markers.forEach(marker => {
            const d = marker._data;
            const typeMatch = currentFilter === 'all' || d.type === currentFilter;
            let searchMatch = true;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                searchMatch = (d.title && d.title.toLowerCase().includes(q)) ||
                              (d.description && d.description.toLowerCase().includes(q));
            }
            if (typeMatch && searchMatch) {
                marker.addTo(map);
            } else {
                map.removeLayer(marker);
            }
        });

        renderReportList(filtered);
    }

    function renderSearchRecommendations(markerList) {
        if (!searchQuery) {
            el.searchRecommendations.classList.remove('active');
            return;
        }

        if (markerList.length === 0) {
            el.searchRecommendations.innerHTML = '<div class="search-rec-empty">No matching reports found</div>';
            el.searchRecommendations.classList.add('active');
            return;
        }

        const html = markerList.slice(0, 8).map(marker => {
            const typeClass = marker.type.toLowerCase();
            const title = highlightText(marker.title, searchQuery);
            const desc = highlightText(marker.description || '', searchQuery);
            
            return `
                <div class="search-rec-item" data-lat="${marker.lat}" data-lng="${marker.lng}">
                    <div class="search-rec-header">
                        <span class="search-rec-badge ${typeClass}">${marker.type}</span>
                        <span class="search-rec-title">${title}</span>
                    </div>
                    <div class="search-rec-desc">${desc}</div>
                </div>
            `;
        }).join('');

        el.searchRecommendations.innerHTML = html;
        el.searchRecommendations.classList.add('active');
    }

    function hideSearchRecommendations() {
        el.searchRecommendations.classList.remove('active');
    }

    function setFilter(filter) {
        currentFilter = filter;
        el.filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        applyFilters();
    }

    // ========================================
    // Render Report List
    // ========================================

    function renderReportList(markerList) {
        const html = markerList.map((marker, i) => {
            const typeClass = marker.type.toLowerCase();
            const formattedDate = new Date(marker.timestamp).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
            const title = highlightText(marker.title, searchQuery);
            const desc = highlightText(marker.description || '', searchQuery);

            return `
                <div class="report-item" data-lat="${marker.lat}" data-lng="${marker.lng}" style="animation-delay:${i * 30}ms">
                    <div class="report-item-header">
                        <span class="report-item-title">${title}</span>
                        <span class="report-item-type ${typeClass}">${marker.type}</span>
                    </div>
                    <p class="report-item-desc">${desc}</p>
                    <span class="report-item-time">${formattedDate}</span>
                </div>
            `;
        }).join('');

        el.reportList.innerHTML = html || '<p style="color:var(--text-secondary);padding:12px;text-align:center;font-size:0.82rem;">No reports found</p>';

        document.querySelectorAll('.report-item').forEach(item => {
            item.addEventListener('click', () => {
                const lat = parseFloat(item.dataset.lat);
                const lng = parseFloat(item.dataset.lng);
                map.flyTo([lat, lng], 12, { duration: 1 });
            });
        });
    }

    function highlightText(text, query) {
        if (!query || !text) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark style="background:rgba(77,159,255,0.3);color:inherit;padding:0 1px;border-radius:2px;">$1</mark>');
    }

    // ========================================
    // File Upload
    // ========================================

    function initUploadHandlers() {
        const zone = el.uploadZone;
        const input = el.fileInput;

        zone.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFiles(e.target.files);
        });

        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        });
    }

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext === 'csv') uploadFile(file, `${BASE_URL}/api/upload/csv`);
            else if (ext === 'json') uploadFile(file, `${BASE_URL}/api/upload/json`);
            else showToast('Unsupported file type: ' + ext, 'error');
        });
    }

    function uploadFile(file, endpoint) {
        const formData = new FormData();
        formData.append('file', file);
        fetch(endpoint, { method: 'POST', body: formData })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    showToast(`Added ${data.added} markers from ${file.name}`, 'success');
                    loadMarkers();
                } else {
                    showToast('Upload failed: ' + data.error, 'error');
                }
            })
            .catch(() => showToast('Error uploading file', 'error'));
    }

    // ========================================
    // Add Marker Modal
    // ========================================

    function openModal() {
        el.markerModal.classList.add('active');
        // Only clear if not picking coords (to preserve data if we are just re-opening after map pick)
        if (!pickingCoords) {
            el.markerTitle.value = '';
            el.markerDesc.value = '';
            el.markerLat.value = '';
            el.markerLng.value = '';
            el.markerType.value = 'OSINT';
            clearImagePreview();
        }
    }

    function initPickMap() {
        el.btnPickMap.addEventListener('click', () => {
            el.markerModal.classList.remove('active');
            pickingCoords = true;
            document.body.classList.add('map-pick-mode');
            showToast('Click on the map to pick coordinates', 'info');
        });
    }

    function closeModal() {
        el.markerModal.classList.remove('active');
        pickingCoords = false;
        document.body.classList.remove('map-pick-mode');
    }

    function clearImagePreview() {
        selectedImageFile = null;
        el.imagePreview.src = '';
        el.imageUploadArea.classList.remove('has-image');
        el.markerImage.value = '';
    }

    function setImagePreview(file) {
        if (!file) return;
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            showToast('Please select a JPG or PNG image', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image must be under 5MB', 'error');
            return;
        }
        selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            el.imagePreview.src = e.target.result;
            el.imageUploadArea.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    }

    function initImageUpload() {
        el.imageUploadArea.addEventListener('click', (e) => {
            if (e.target.closest('.image-remove-btn')) return;
            el.markerImage.click();
        });

        el.markerImage.addEventListener('change', (e) => {
            if (e.target.files[0]) setImagePreview(e.target.files[0]);
        });

        el.imageRemoveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearImagePreview();
        });

        el.imageUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            el.imageUploadArea.classList.add('dragover');
        });
        el.imageUploadArea.addEventListener('dragleave', () => {
            el.imageUploadArea.classList.remove('dragover');
        });
        el.imageUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            el.imageUploadArea.classList.remove('dragover');
            if (e.dataTransfer.files[0]) setImagePreview(e.dataTransfer.files[0]);
        });
    }

    async function submitMarker() {
        const title = el.markerTitle.value.trim();
        const desc = el.markerDesc.value.trim();
        const type = el.markerType.value;
        const lat = parseFloat(el.markerLat.value);
        const lng = parseFloat(el.markerLng.value);

        if (!title) { showToast('Please enter a title', 'error'); return; }
        if (isNaN(lat) || isNaN(lng)) { showToast('Please provide valid coordinates', 'error'); return; }

        try {
            let imageUrl = null;

            // Upload image first if selected
            if (selectedImageFile) {
                const formData = new FormData();
                formData.append('file', selectedImageFile);
                const uploadRes = await fetch(`${BASE_URL}/api/upload/image`, { method: 'POST', body: formData });
                const uploadData = await uploadRes.json();
                if (uploadData.success) {
                    imageUrl = `${BASE_URL}/uploads/` + uploadData.filename;
                } else {
                    showToast('Image upload failed: ' + (uploadData.error || 'Unknown error'), 'error');
                    return;
                }
            }

            const res = await fetch(`${BASE_URL}/api/markers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, description: desc, type, lat, lng, image: imageUrl })
            });
            const data = await res.json();

            if (data.id) {
                showToast(`Marker "${title}" added successfully!`, 'success');
                closeModal();
                loadMarkers();
            } else {
                showToast('Failed to add marker', 'error');
            }
        } catch (err) {
            showToast('Error adding marker', 'error');
        }
    }

    // ========================================
    // Sidebar Toggle
    // ========================================

    function toggleSidebar() {
        const collapsed = el.sidebar.classList.toggle('collapsed');
        const toggleBtn = el.sidebarToggle;
        toggleBtn.innerHTML = collapsed
            ? '<i class="fas fa-chevron-right"></i>'
            : '<i class="fas fa-chevron-left"></i>';
        toggleBtn.classList.toggle('collapsed-pos', collapsed);
        setTimeout(() => map.invalidateSize(), 400);
    }

    // ========================================
    // Keyboard Shortcuts
    // ========================================

    function initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                if (e.key === 'Escape') e.target.blur();
                return;
            }

            switch(e.key) {
                case '/':
                    e.preventDefault();
                    el.searchInput.focus();
                    break;
                case '[':
                    toggleSidebar();
                    break;
                case '1': setFilter('all'); break;
                case '2': setFilter('OSINT'); break;
                case '3': setFilter('HUMINT'); break;
                case '4': setFilter('IMINT'); break;
                case 'n':
                case 'N':
                    openModal();
                    break;
                case 'Escape':
                    closeModal();
                    break;
            }
        });
    }

    // ========================================
    // Tile Switcher
    // ========================================

    function initTileSwitcher() {
        el.tileButtons.forEach(btn => {
            btn.addEventListener('click', () => setTileLayer(btn.dataset.tile));
        });
    }

    // ========================================
    // Initialize
    // ========================================

    function init() {
        initMap();
        initUploadHandlers();
        initKeyboardShortcuts();
        initTileSwitcher();
        initImageUpload();
        initPickMap();

        // Search
        el.searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            applyFilters();
            
            // Show recommendations for current query
            if (searchQuery) {
                let filtered = allMarkerData;
                if (currentFilter !== 'all') {
                    filtered = filtered.filter(m => m.type === currentFilter);
                }
                const q = searchQuery.toLowerCase();
                filtered = filtered.filter(m =>
                    (m.title && m.title.toLowerCase().includes(q)) ||
                    (m.description && m.description.toLowerCase().includes(q))
                );
                renderSearchRecommendations(filtered);
            } else {
                hideSearchRecommendations();
            }
        });

        el.searchInput.addEventListener('focus', () => {
            if (searchQuery) {
                el.searchInput.dispatchEvent(new Event('input'));
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-box')) {
                hideSearchRecommendations();
            }
        });

        el.searchRecommendations.addEventListener('click', (e) => {
            const item = e.target.closest('.search-rec-item');
            if (item) {
                const lat = parseFloat(item.dataset.lat);
                const lng = parseFloat(item.dataset.lng);
                map.flyTo([lat, lng], 8, { duration: 1.5 });
                
                // Find and open marker popup
                const targetMarker = markers.find(m => 
                    Math.abs(m.getLatLng().lat - lat) < 0.0001 && 
                    Math.abs(m.getLatLng().lng - lng) < 0.0001
                );
                if (targetMarker) {
                    setTimeout(() => targetMarker.openPopup(), 1500);
                }
                
                hideSearchRecommendations();
                el.searchInput.value = ''; // Optional: clear search after picking
                searchQuery = '';
                applyFilters();
            }
        });

        // Filters
        el.filterButtons.forEach(btn => {
            btn.addEventListener('click', () => setFilter(btn.dataset.filter));
        });

        // Sidebar toggle
        el.sidebarToggle.addEventListener('click', toggleSidebar);

        // Modal
        el.btnAddMarker.addEventListener('click', openModal);
        el.modalClose.addEventListener('click', closeModal);
        el.modalCancel.addEventListener('click', closeModal);
        el.modalSubmit.addEventListener('click', submitMarker);
        el.markerModal.addEventListener('click', (e) => {
            if (e.target === el.markerModal) closeModal();
        });

        // Live clock
        updateClock();
        setInterval(updateClock, 1000);

        console.log('Intelligence Fusion Dashboard initialized');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();