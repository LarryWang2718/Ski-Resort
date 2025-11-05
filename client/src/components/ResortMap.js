import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Map, { Marker, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

function ResortMap({ resort, trails = [], lifts = [], showTrails = true, showLifts = true }) {
  // Get Mapbox access token from environment variable
  const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || '';

  // Parse resort coordinates - handle different data structures
  const getResortCenter = () => {
    if (!resort) {
      console.warn('[ResortMap] No resort object provided');
      return null;
    }
    
    let lat, lng;
    
    // Try location_coordinate structure first (from database model)
    if (resort.location_coordinate) {
      const latStr = resort.location_coordinate.lat;
      const lngStr = resort.location_coordinate.long;
      
      // Debug: log raw values
      console.log('[ResortMap] Raw coordinate values:', {
        lat: latStr,
        lng: lngStr,
        latType: typeof latStr,
        lngType: typeof lngStr,
        location_coordinate: resort.location_coordinate
      });
      
      // Trim and parse - handle empty strings, null, undefined
      if (latStr != null && latStr !== '' && lngStr != null && lngStr !== '') {
        lat = parseFloat(String(latStr).trim());
        lng = parseFloat(String(lngStr).trim());
      } else {
        console.warn('[ResortMap] location_coordinate exists but values are empty/null:', {
          lat: latStr,
          lng: lngStr
        });
      }
    }
    // Try coordinates structure (alternative format)
    else if (resort.coordinates) {
      const latStr = resort.coordinates.lat;
      const lngStr = resort.coordinates.lng || resort.coordinates.long;
      
      if (latStr != null && latStr !== '' && lngStr != null && lngStr !== '') {
        lat = parseFloat(String(latStr).trim());
        lng = parseFloat(String(lngStr).trim());
      }
    }
    // Try direct lat/lng properties
    else if (resort.latitude && resort.longitude) {
      lat = parseFloat(String(resort.latitude).trim());
      lng = parseFloat(String(resort.longitude).trim());
    } else {
      console.warn('[ResortMap] No coordinate structure found. Resort object keys:', Object.keys(resort));
    }
    
    // Validate parsed values are valid numbers and within valid coordinate ranges
    if (isNaN(lat) || isNaN(lng)) {
      console.warn('[ResortMap] Parsed coordinates are NaN:', { lat, lng });
      return null;
    }
    
    // Check if coordinates are within valid ranges (lat: -90 to 90, lng: -180 to 180)
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      console.warn('[ResortMap] Coordinates out of valid range:', { lat, lng });
      return null;
    }
    
    // Check if coordinates are 0,0 (likely invalid/default)
    if (lat === 0 && lng === 0) {
      console.warn('[ResortMap] Coordinates are 0,0 (likely invalid):', { lat, lng });
      return null;
    }
    
    console.log('[ResortMap] Valid coordinates found:', { lat, lng });
    return [lng, lat]; // Mapbox uses [longitude, latitude]
  };

  const resortCenter = getResortCenter();
  
  // Default to a central location if no resort center (for testing)
  const [viewport, setViewport] = useState({
    longitude: resortCenter ? resortCenter[0] : -122.4194,
    latitude: resortCenter ? resortCenter[1] : 37.7749,
    zoom: 12
  });

  // Update viewport when resort center changes
  useEffect(() => {
    if (resortCenter) {
      setViewport(prev => ({
        ...prev,
        longitude: resortCenter[0],
        latitude: resortCenter[1]
      }));
    }
  }, [resortCenter]);

  const [selectedFeature, setSelectedFeature] = useState(null);

  const onMapClick = useCallback((event) => {
    setSelectedFeature(null);
  }, []);

  // Debug logging (remove after fixing)
  useEffect(() => {
    console.log('Mapbox Token:', MAPBOX_TOKEN ? 'Token found' : 'Token missing');
    console.log('Resort object:', resort);
    console.log('Resort location_coordinate:', resort?.location_coordinate);
    console.log('Resort Center:', resortCenter);
    console.log('Viewport:', viewport);
  }, [MAPBOX_TOKEN, resort, resortCenter, viewport]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'white' }}>
          ⚠️ Mapbox token not configured. Please add REACT_APP_MAPBOX_TOKEN to your .env file.
        </p>
        <p style={{ color: '#999', marginTop: '1rem', fontSize: '0.9rem' }}>
          Get your free token at{' '}
          <a href="https://account.mapbox.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#4A90E2' }}>
            mapbox.com
          </a>
        </p>
      </div>
    );
  }

  // Use fallback coordinates if resort center is not available
  const mapCenter = resortCenter || [-122.4194, 37.7749]; // Default to San Francisco if no coordinates
  
  if (!resortCenter) {
    console.warn('No valid coordinates found for resort. Using default location.');
  }

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
        {...viewport}
        onMove={evt => setViewport(evt.viewState)}
        onClick={onMapClick}
        onLoad={() => console.log('Map loaded successfully')}
        onError={(e) => console.error('Map error:', e)}
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        reuseMaps={true}
        attributionControl={true}
      >
        {/* Resort Center Marker - only show if we have actual resort coordinates */}
        {resortCenter && (
          <Marker
            longitude={resortCenter[0]}
            latitude={resortCenter[1]}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedFeature({ type: 'resort', data: resort });
            }}
          >
            <div style={{
              background: '#FF6B6B',
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              border: '3px solid white',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }} />
          </Marker>
        )}

        {/* Trails Markers */}
        {showTrails && trails.map((trail) => {
          if (!trail.latitude || !trail.longitude) return null;
          
          return (
            <Marker
              key={trail._id}
              longitude={trail.longitude}
              latitude={trail.latitude}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedFeature({ type: 'trail', data: trail });
              }}
            >
              <div style={{
                background: getTrailColor(trail.difficulty),
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                border: '2px solid white',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
              }} />
            </Marker>
          );
        })}

        {/* Lifts Markers */}
        {showLifts && lifts.map((lift) => {
          if (!lift.latitude || !lift.longitude) return null;
          
          return (
            <Marker
              key={lift._id}
              longitude={lift.longitude}
              latitude={lift.latitude}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedFeature({ type: 'lift', data: lift });
              }}
            >
              <div style={{
                background: '#4ECDC4',
                width: '12px',
                height: '12px',
                borderRadius: '2px',
                transform: 'rotate(45deg)',
                border: '1px solid white',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
              }} />
            </Marker>
          );
        })}

        {/* Popup for selected feature */}
        {selectedFeature && (
          <Popup
            longitude={
              selectedFeature.type === 'resort' 
                ? (resortCenter ? resortCenter[0] : mapCenter[0])
                : selectedFeature.type === 'trail'
                ? selectedFeature.data.longitude
                : selectedFeature.data.longitude
            }
            latitude={
              selectedFeature.type === 'resort'
                ? (resortCenter ? resortCenter[1] : mapCenter[1])
                : selectedFeature.type === 'trail'
                ? selectedFeature.data.latitude
                : selectedFeature.data.latitude
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
                  <Link 
                    to={`/trails/${selectedFeature.data._id}`}
                    style={{ 
                      display: 'inline-block', 
                      marginTop: '0.5rem',
                      color: '#4A90E2',
                      textDecoration: 'none',
                      fontSize: '0.9rem'
                    }}
                  >
                    View Details →
                  </Link>
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
                  <Link 
                    to={`/lifts/${selectedFeature.data._id}`}
                    style={{ 
                      display: 'inline-block', 
                      marginTop: '0.5rem',
                      color: '#4A90E2',
                      textDecoration: 'none',
                      fontSize: '0.9rem'
                    }}
                  >
                    View Details →
                  </Link>
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

// Helper function to get trail color based on difficulty
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
