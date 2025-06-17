// Dashboard JavaScript
class StormRiskDashboard {
    constructor() {
        this.map = null;
        this.layers = {
            bangladesh: null,
            stormTrack: null,
            healthFacilities: null,
            educationFacilities: null
        };
        this.data = {};
        this.init();
    }

    async init() {
        this.initMap();
        await this.loadData();
        this.setupEventListeners();
        this.hideLoading();
    }

    initMap() {
        // Initialize Leaflet map centered on Bangladesh
        this.map = L.map('map').setView([23.6850, 90.3563], 7);

        // Add base tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);

        // Add a dark theme alternative
        const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors, © CARTO',
            maxZoom: 18
        });

        // Layer control
        const baseMaps = {
            "OpenStreetMap": this.map._layers[Object.keys(this.map._layers)[0]],
            "Dark Theme": darkTiles
        };

        L.control.layers(baseMaps).addTo(this.map);
    }

    async loadData() {
        try {
            // Load all data in parallel
            const [bangladeshData, amphanData, healthData, educationData, statsData] = await Promise.all([
                fetch('/api/bangladesh').then(r => r.json()),
                fetch('/api/amphan').then(r => r.json()),
                fetch('/api/health').then(r => r.json()),
                fetch('/api/education').then(r => r.json()),
                fetch('/api/stats').then(r => r.json())
            ]);

            this.data = {
                bangladesh: bangladeshData,
                amphan: amphanData,
                health: healthData,
                education: educationData,
                stats: statsData
            };

            this.updateStats();
            this.addLayers();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load map data. Please refresh the page.');
        }
    }

    updateStats() {
        const stats = this.data.stats;
        document.getElementById('total-districts').textContent = stats.total_districts;
        document.getElementById('high-risk-districts').textContent = stats.high_risk_districts;
        document.getElementById('total-health').textContent = stats.total_health_facilities;
        document.getElementById('total-education').textContent = stats.total_education_facilities;
    }

    addLayers() {
        // Add Bangladesh districts with risk classification
        this.layers.bangladesh = L.geoJSON(this.data.bangladesh, {
            style: (feature) => this.getDistrictStyle(feature),
            onEachFeature: (feature, layer) => this.onEachDistrict(feature, layer)
        }).addTo(this.map);

        // Add Amphan storm track
        this.layers.stormTrack = L.geoJSON(this.data.amphan, {
            pointToLayer: (feature, latlng) => {
                const windSpeed = feature.properties.max_sustained_wind;
                const radius = Math.max(3, windSpeed / 10);
                
                return L.circleMarker(latlng, {
                    radius: radius,
                    fillColor: '#000000',
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const popup = `
                    <div class="popup-title">Storm Track Point</div>
                    <div class="popup-info">
                        <span><strong>Time:</strong> ${new Date(props.time).toLocaleString()}</span>
                        <span><strong>Wind Speed:</strong> ${props.max_sustained_wind} mph</span>
                        <span><strong>Pressure:</strong> ${props.central_pressure} mb</span>
                        <span><strong>Category:</strong> ${this.getStormCategory(props.max_sustained_wind)}</span>
                    </div>
                `;
                layer.bindPopup(popup);
            }
        }).addTo(this.map);

        // Add health facilities
        this.layers.healthFacilities = L.geoJSON(this.data.health, {
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, {
                    radius: 4,
                    fillColor: '#e53e3e',
                    color: '#fff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const popup = `
                    <div class="popup-title">${props.name || 'Health Facility'}</div>
                    <div class="popup-info">
                        ${props.addr_city ? `<span><strong>City:</strong> ${props.addr_city}</span>` : ''}
                    </div>
                `;
                layer.bindPopup(popup);
            }
        }).addTo(this.map);

        // Add education facilities
        this.layers.educationFacilities = L.geoJSON(this.data.education, {
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, {
                    radius: 4,
                    fillColor: '#3182ce',
                    color: '#fff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const popup = `
                    <div class="popup-title">${props.name || 'Education Facility'}</div>
                    <div class="popup-info">
                        ${props.addr_city ? `<span><strong>City:</strong> ${props.addr_city}</span>` : ''}
                    </div>
                `;
                layer.bindPopup(popup);
            }
        }).addTo(this.map);

        // Fit map to Bangladesh bounds
        this.map.fitBounds(this.layers.bangladesh.getBounds());
    }

    getDistrictStyle(feature) {
        const riskScore = feature.properties.storm_risk_score || 0;
        const hospitalDensity = feature.properties.hospital_density_class || 'Low';
        
        let fillColor = '#f0f0f0'; // Default no risk
        
        // Color based on storm risk
        switch(riskScore) {
            case 5: fillColor = '#d73027'; break;
            case 4: fillColor = '#fc8d59'; break;
            case 3: fillColor = '#fee08b'; break;
            case 2: fillColor = '#e0f3f8'; break;
            case 1: fillColor = '#91bfdb'; break;
            default: fillColor = '#f0f0f0'; break;
        }

        return {
            fillColor: fillColor,
            weight: 2,
            opacity: 1,
            color: '#fff',
            dashArray: '',
            fillOpacity: 0.7
        };
    }

    onEachDistrict(feature, layer) {
        const props = feature.properties;
        
        layer.on({
            mouseover: (e) => {
                const layer = e.target;
                layer.setStyle({
                    weight: 3,
                    color: '#666',
                    dashArray: '',
                    fillOpacity: 0.9
                });
                layer.bringToFront();
            },
            mouseout: (e) => {
                this.layers.bangladesh.resetStyle(e.target);
            },
            click: (e) => {
                this.showDistrictInfo(props);
                this.map.fitBounds(e.target.getBounds());
            }
        });

        const popup = `
            <div class="popup-title">${props.NAME_4}</div>
            <div class="popup-info">
                <span><strong>District:</strong> ${props.NAME_2}</span>
                <span><strong>Division:</strong> ${props.NAME_1}</span>
                <span><strong>Severity Level:</strong> ${props.storm_risk_score || 0} <span class="risk-badge risk-${props.storm_risk_score || 0}">${this.getRiskLabel(props.storm_risk_score || 0)}</span></span>
                <span><strong>Health Facilities:</strong> ${props.health_facility_count || 0}</span>
                <span><strong>Education Facilities:</strong> ${props.education_facility_count || 0}</span>
                <span><strong>Children Under 5:</strong> ${props.children_under_five?.toLocaleString() || 0}</span>
            </div>
        `;
        layer.bindPopup(popup);
    }

    showDistrictInfo(props) {
        const infoPanel = document.getElementById('district-info');
        infoPanel.innerHTML = `
            <h4>${props.NAME_4}</h4>
            <p><strong>District:</strong> ${props.NAME_2}</p>
            <p><strong>Division:</strong> ${props.NAME_1}</p>
            <p><strong>Storm Risk Score:</strong> ${props.storm_risk_score || 0}/5</p>
            <p><strong>Risk Level:</strong> ${this.getRiskLabel(props.storm_risk_score || 0)}</p>
            <p><strong>Health Facilities:</strong> ${props.health_facility_count || 0}</p>
            <p><strong>Education Facilities:</strong> ${props.education_facility_count || 0}</p>
            <p><strong>Children Under 5:</strong> ${props.children_under_five?.toLocaleString() || 0}</p>
        `;
    }

    getRiskLabel(score) {
        const labels = {
            5: 'Very High',
            4: 'High',
            3: 'Medium',
            2: 'Low',
            1: 'Very Low',
            0: 'No Risk'
        };
        return labels[score] || 'Unknown';
    }

    getWindSpeedColor(windSpeed) {
        if (windSpeed >= 157) return '#8b0000'; // Category 5
        if (windSpeed >= 130) return '#ff0000'; // Category 4
        if (windSpeed >= 111) return '#ff6600'; // Category 3
        if (windSpeed >= 96) return '#ffaa00'; // Category 2
        if (windSpeed >= 74) return '#ffff00'; // Category 1
        if (windSpeed >= 39) return '#00ff00'; // Tropical Storm
        return '#0066ff'; // Tropical Depression
    }

    getStormCategory(windSpeed) {
        if (windSpeed >= 157) return 'Category 5 Hurricane';
        if (windSpeed >= 130) return 'Category 4 Hurricane';
        if (windSpeed >= 111) return 'Category 3 Hurricane';
        if (windSpeed >= 96) return 'Category 2 Hurricane';
        if (windSpeed >= 74) return 'Category 1 Hurricane';
        if (windSpeed >= 39) return 'Tropical Storm';
        return 'Tropical Depression';
    }

    setupEventListeners() {
        // Layer toggle controls
        document.getElementById('storm-track').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.map.addLayer(this.layers.stormTrack);
            } else {
                this.map.removeLayer(this.layers.stormTrack);
            }
        });

        document.getElementById('health-facilities').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.map.addLayer(this.layers.healthFacilities);
            } else {
                this.map.removeLayer(this.layers.healthFacilities);
            }
        });

        document.getElementById('education-facilities').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.map.addLayer(this.layers.educationFacilities);
            } else {
                this.map.removeLayer(this.layers.educationFacilities);
            }
        });

        // Export Data button event
        const exportBtn = document.getElementById('export-data-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportSubdistrictDataCSV());
        }
    }

    hideLoading() {
        const loading = document.getElementById('map-loading');
        loading.classList.add('hidden');
        setTimeout(() => {
            loading.style.display = 'none';
        }, 300);
    }

    showError(message) {
        const loading = document.getElementById('map-loading');
        loading.innerHTML = `
            <div style="text-align: center; color: #e53e3e;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>${message}</p>
            </div>
        `;
    }

    exportSubdistrictDataCSV() {
        // Map risk_level to a sort order
        const riskOrder = {
            'Very High': 5,
            'High': 4,
            'Medium': 3,
            'Low': 2,
            'Very Low': 1,
            'No Risk': 0
        };
        // Prepare rows: one per subdistrict in GeoJSON
        const seenSubdistricts = new Set();
        const rows = this.data.bangladesh.features.map(f => {
            const props = f.properties;
            const subdistrict = props.NAME_4;
            if (seenSubdistricts.has(subdistrict)) return null; // skip duplicate
            seenSubdistricts.add(subdistrict);
            return {
                'District Name': props.NAME_2,
                'Sub-district/Upazila': subdistrict,
                'Number of children under 5': Math.round(props.children_under_five || 0),
                'Count of Health Facilities': props.health_facility_count || 0,
                'Count of Education Facilities': props.education_facility_count || 0,
                'Severity Level': props.risk_level || ''
            };
        }).filter(Boolean);
        // Sort rows by severity level (highest to lowest)
        rows.sort((a, b) => (riskOrder[b['Severity Level']] || 0) - (riskOrder[a['Severity Level']] || 0));
        // CSV header
        const header = [
            'District Name',
            'Sub-district/Upazila',
            'Number of children under 5',
            'Count of Health Facilities',
            'Count of Education Facilities',
            'Severity Level'
        ];
        // Convert to CSV string
        const csv = [header.join(',')].concat(
            rows.map(row => header.map(h => '"' + String(row[h]).replace(/"/g, '""') + '"').join(','))
        ).join('\n');
        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bangladesh_subdistricts_export.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StormRiskDashboard();
});

