import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Map, { Marker, Popup, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

function ResortMap({ resort, trails = [], lifts = [], showTrails = true, showLifts = true }) {
    const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || '';

    // Memoize resort center to prevent recalculation on every render
    const resortCenter = useMemo(() => {
        if (!resort || !resort.location_coordinate) {
            return null;
        }

        const latVal = resort.location_coordinate.lat;
        const lonVal = resort.location_coordinate.long;

        // Ensure we have valid values and convert to numbers
        if (latVal != null && lonVal != null) {
            const lat = typeof latVal === 'number' ? latVal : parseFloat(latVal);
            const lon = typeof lonVal === 'number' ? lonVal : parseFloat(lonVal);
            
            // Validate the parsed numbers
            if (!isNaN(lat) && !isNaN(lon) && 
                lat >= -90 && lat <= 90 && 
                lon >= -180 && lon <= 180) {
                return [lon, lat]; // Mapbox uses [longitude, latitude]
            }
        }

        return null;
    }, [resort?.location_coordinate?.lat, resort?.location_coordinate?.long]);

    // Default to a central location if no resort center (for testing)
    const [viewport, setViewport] = useState(() => {
        // Initialize with resort center if available, otherwise use default
        const center = resort?.location_coordinate 
            ? [resort.location_coordinate.long, resort.location_coordinate.lat]
            : null;
        
        if (center && !isNaN(center[0]) && !isNaN(center[1])) {
            return {
                longitude: typeof center[0] === 'number' ? center[0] : parseFloat(center[0]),
                latitude: typeof center[1] === 'number' ? center[1] : parseFloat(center[1]),
                zoom: 12
            };
        }
        
        return {
            longitude: -122.4194,
            latitude: 37.7749,
            zoom: 12
        };
    });

    // Only initialize viewport once when component mounts or resort changes
    // Don't reset viewport after user interactions
    const lastResortIdRef = React.useRef(resort?._id);

    useEffect(() => {
        // Only update viewport if the resort ID has changed (user navigated to different resort)
        const resortIdChanged = lastResortIdRef.current !== resort?._id;
        
        if (resortIdChanged && resort?.location_coordinate) {
            const latStr = resort.location_coordinate.lat;
            const lonStr = resort.location_coordinate.long;
            
            if (latStr && lonStr && !isNaN(latStr) && !isNaN(lonStr)) {
                setViewport(prev => ({
                    ...prev,
                    longitude: lonStr,
                    latitude: latStr,
                }));
            }
            lastResortIdRef.current = resort?._id;
        }
    }, [resort?._id]); // Only depend on resort ID, not coordinates

    const [selectedFeature, setSelectedFeature] = useState(null);
    const dragStartRef = React.useRef({ isDragging: false });

    const onMapClick = useCallback((event) => {
        // Only close popup if we didn't just drag
        if (!dragStartRef.current.isDragging) {
            setSelectedFeature(null);
        }
        dragStartRef.current.isDragging = false;
    }, []);

    const onMapDragStart = useCallback(() => {
        dragStartRef.current.isDragging = true;
    }, []);

    const trailsGeoJSON = useMemo(() => {
        if (!showTrails || !trails || trails.length === 0) {
            return null;
        }
        const features = trails
            .filter(trail => trail.coordinates && Array.isArray(trail.coordinates) && trail.coordinates.length >= 2)
            .map(trail => {
                const coordinates = trail.coordinates
                    .filter(coord => coord.longitude != null && coord.latitude != null && !isNaN(coord.longitude) && !isNaN(coord.latitude))
                    .map(coord => [coord.longitude, coord.latitude]);

                if (coordinates.length < 2) return null;

                return {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: coordinates
                    },
                    properties: {
                        id: trail._id,
                        name: trail.name,
                        difficulty: trail.difficulty,
                        status: trail.status,
                        trailData: {
                            ...trail,
                            resort: trail.resort || resort?._id
                        },
                    }
                };
            })
            .filter(feature => feature !== null);

        return {
            type: 'FeatureCollection',
            features: features
        };
    }, [trails, showTrails, resort?._id]);

    const liftsGeoJSON = useMemo(() => {
        if (!showLifts || !lifts || lifts.length === 0) {
            return null;
        }

        const features = lifts
            .filter(lift => lift.coordinates && Array.isArray(lift.coordinates) && lift.coordinates.length >= 2)
            .map(lift => {
                const coordinates = lift.coordinates
                    .filter(coord => coord.longitude != null && coord.latitude != null && !isNaN(coord.longitude) && !isNaN(coord.latitude))
                    .map(coord => [coord.longitude, coord.latitude]);

                if (coordinates.length < 2) return null;

                return {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: coordinates
                    },
                    properties: {
                        id: lift._id,
                        name: lift.name,
                        aerialway: lift.aerialway,
                        status: lift.status,
                        liftData: {
                            ...lift,
                            resort: lift.resort || resort?._id
                        },
                    }
                };
            })
            .filter(feature => feature !== null);

        return {
            type: 'FeatureCollection',
            features: features
        };
    }, [lifts, showLifts, resort?._id]);

    const onLayerClick = useCallback((event) => {
        const feature = event.features?.[0];
        if (!feature) return;

        event.originalEvent.stopPropagation();

        if (feature.properties.trailData) {
            setSelectedFeature({ type: 'trail', data: feature.properties.trailData });
        } else if (feature.properties.liftData) {
            setSelectedFeature({ type: 'lift', data: feature.properties.liftData });
        }
    }, []);

    const mapCenter = resortCenter || [-122.4194, 37.7749]; // Default to San Francisco if no coordinates

    return (
        <div style={{ 
          width: '100%', 
          height: '500px', 
          minHeight: '500px',
          borderRadius: '8px', 
          overflow: 'hidden', 
          position: 'relative',
          backgroundColor: '#f0f0f0' // Fallback background
        }}>
          <Map
            longitude={viewport.longitude}
            latitude={viewport.latitude}
            zoom={viewport.zoom}
            onMove={evt => setViewport(evt.viewState)}
            onDragStart={onMapDragStart}
            onClick={onMapClick}
            onLoad={() => console.log('Map loaded successfully')}
            onError={(e) => console.error('Map error:', e)}
            mapboxAccessToken={MAPBOX_TOKEN}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/outdoors-v12"
            reuseMaps={true}
            attributionControl={true}
            dragPan={true}
            dragRotate={false}
            scrollZoom={true}
            doubleClickZoom={true}
            touchZoom={true}
            touchRotate={false}
            touchPitch={false}
            interactiveLayerIds={['trails-layer', 'lifts-layer']}
          >
            {/* Trails as Lines */}
            {trailsGeoJSON && trailsGeoJSON.features.length > 0 && (
              <Source id="trails-source" type="geojson" data={trailsGeoJSON}>
                <Layer
                  id="trails-layer"
                  type="line"
                  paint={{
                    'line-color': [
                      'case',
                      ['==', ['get', 'difficulty'], 'easy'], '#2E7D32',      // Green - Beginner
                      ['==', ['get', 'difficulty'], 'intermediate'], '#1976D2', // Blue - Intermediate
                      ['==', ['get', 'difficulty'], 'advanced'], '#212121',    // Deep black - Advanced
                      ['==', ['get', 'difficulty'], 'expert'], '#000000',     // Black - Expert
                      ['==', ['get', 'difficulty'], 'difficult'], '#000000',  // Black - Double Black
                      ['==', ['get', 'difficulty'], 'extreme'], '#B71C1C',   // Red - Extreme/Out-of-Bounds
                      '#757575' // Default gray for novice, unknown
                    ],
                    'line-width': [
                      'case',
                      ['==', ['get', 'difficulty'], 'expert'], 3,           // Thicker for Expert
                      ['==', ['get', 'difficulty'], 'difficult'], 3,         // Thicker for Double Black
                      2                                                       // Default width
                    ],
                    'line-opacity': 0.8
                  }}
                  onClick={onLayerClick}
                />
              </Source>
            )}
    
            {/* Lifts as Lines */}
            {liftsGeoJSON && liftsGeoJSON.features.length > 0 && (
              <Source id="lifts-source" type="geojson" data={liftsGeoJSON}>
                <Layer
                  id="lifts-layer"
                  type="line"
                  paint={{
                    'line-color': [
                      'case',
                      // Closed or maintenance status
                      ['==', ['get', 'status'], 'closed'], '#9E9E9E',
                      ['==', ['get', 'status'], 'maintenance'], '#9E9E9E',
                      ['==', ['get', 'status'], 'abandoned'], '#9E9E9E',
                      // Gondola/Tram/Cable Car
                      ['==', ['get', 'aerialway'], 'gondola'], '#FF9800',
                      ['==', ['get', 'aerialway'], 'cable_car'], '#FF9800',
                      ['==', ['get', 'aerialway'], 'tram'], '#FF9800',
                      // Chairlift
                      ['==', ['get', 'aerialway'], 'chair_lift'], '#4ECDC4',
                      // Surface lifts (T-bar, rope tow, drag lift, etc.)
                      ['==', ['get', 'aerialway'], 't-bar'], '#8E24AA',
                      ['==', ['get', 'aerialway'], 'rope_tow'], '#8E24AA',
                      ['==', ['get', 'aerialway'], 'drag_lift'], '#8E24AA',
                      ['==', ['get', 'aerialway'], 'j-bar'], '#8E24AA',
                      ['==', ['get', 'aerialway'], 'platter'], '#8E24AA',
                      // Default for other lift types
                      '#4ECDC4' // Default to aqua teal
                    ],
                    'line-width': 3,
                    'line-opacity': 0.9,
                    'line-dasharray': [2, 2] // All lifts use dashed lines
                  }}
                  onClick={onLayerClick}
                />
              </Source>
            )}
    
            {/* Resort Center Marker - only show if we have actual resort coordinates */}
            {resortCenter && resortCenter[0] != null && resortCenter[1] != null && (
              <>
                {/* Black dot marker - anchored at center */}
                <Marker
                  key={`resort-dot-${resort?._id || 'default'}`}
                  longitude={resortCenter[0]}
                  latitude={resortCenter[1]}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setSelectedFeature({ type: 'resort', data: resort });
                  }}
                >
                  <div style={{
                    background: '#000000',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                    cursor: 'pointer'
                  }} />
                </Marker>
                {/* Resort name label - positioned to the right of the dot */}
                {resort?.name && (
                  <Marker
                    key={`resort-label-${resort?._id || 'default'}`}
                    longitude={resortCenter[0]}
                    latitude={resortCenter[1]}
                    anchor="left"
                    offset={[8, 0]}
                    onClick={(e) => {
                      e.originalEvent.stopPropagation();
                      setSelectedFeature({ type: 'resort', data: resort });
                    }}
                  >
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      textShadow: '0 0 3px rgba(255, 255, 255, 0.8), 0 0 6px rgba(255, 255, 255, 0.6)',
                      pointerEvents: 'none',
                      cursor: 'pointer'
                    }}>
                      {resort.name}
                    </div>
                  </Marker>
                )}
              </>
            )}
    
            {/* Popup for selected feature */}
            {selectedFeature && (
              <Popup
                longitude={
                  selectedFeature.type === 'resort' 
                    ? (resortCenter ? resortCenter[0] : mapCenter[0])
                    : selectedFeature.type === 'trail'
                    ? (selectedFeature.data.coordinates?.[0]?.longitude || selectedFeature.data.longitude)
                    : (selectedFeature.data.coordinates?.[0]?.longitude || selectedFeature.data.longitude)
                }
                latitude={
                  selectedFeature.type === 'resort'
                    ? (resortCenter ? resortCenter[1] : mapCenter[1])
                    : selectedFeature.type === 'trail'
                    ? (selectedFeature.data.coordinates?.[0]?.latitude || selectedFeature.data.latitude)
                    : (selectedFeature.data.coordinates?.[0]?.latitude || selectedFeature.data.latitude)
                }
                anchor="bottom"
                onClose={() => setSelectedFeature(null)}
                closeButton={true}
                closeOnClick={false}
              >
                <div style={{ padding: '0.5rem', minWidth: '200px' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 'bold' }}>
                    {selectedFeature.data.name}
                  </h3>
                  {selectedFeature.type === 'trail' && (
                    <>
                      <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                        <strong>Difficulty:</strong> {selectedFeature.data.difficulty || 'N/A'}
                      </p>
                      <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                        <strong>Status:</strong> {selectedFeature.data.status || 'N/A'}
                      </p>
                      {selectedFeature.data.resort && (
                        <Link 
                          to={`/resorts/${typeof selectedFeature.data.resort === 'object' ? selectedFeature.data.resort._id : selectedFeature.data.resort}`}
                          style={{ 
                            display: 'inline-block', 
                            marginTop: '0.5rem',
                            color: '#4A90E2',
                            textDecoration: 'none',
                            fontSize: '0.9rem',
                            fontWeight: '500'
                          }}
                        >
                          View Resort →
                        </Link>
                      )}
                    </>
                  )}
                  {selectedFeature.type === 'lift' && (
                    <>
                      <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                        <strong>Type:</strong> {selectedFeature.data.aerialway || 'N/A'}
                      </p>
                      <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                        <strong>Status:</strong> {selectedFeature.data.status || 'N/A'}
                      </p>
                      {selectedFeature.data.resort && (
                        <Link 
                          to={`/resorts/${typeof selectedFeature.data.resort === 'object' ? selectedFeature.data.resort._id : selectedFeature.data.resort}`}
                          style={{ 
                            display: 'inline-block', 
                            marginTop: '0.5rem',
                            color: '#4A90E2',
                            textDecoration: 'none',
                            fontSize: '0.9rem',
                            fontWeight: '500'
                          }}
                        >
                          View Resort →
                        </Link>
                      )}
                    </>
                  )}
                  {selectedFeature.type === 'resort' && (
                    <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                      <strong>Location:</strong> {resort.location_country || 'N/A'}
                    </p>
                  )}
                </div>
              </Popup>
            )}
          </Map>
        </div>
      );
    }
    
    // Helper function to get trail color based on difficulty (kept for reference, but now using paint expressions)
    function getTrailColor(difficulty) {
      const colors = {
        'novice': '#73D2DE',      // Light blue
        'easy': '#2E7D32',        // Green
        'intermediate': '#F9A825', // Yellow/Orange
        'advanced': '#EF6C00',    // Orange
        'difficult': '#C62828',   // Red
        'expert': '#4A148C',      // Purple
        'extreme': '#000000'      // Black
      };
      return colors[difficulty?.toLowerCase()] || '#757575'; // Default gray
    }
    
    export default ResortMap;

