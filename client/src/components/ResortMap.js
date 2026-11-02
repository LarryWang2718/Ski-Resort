import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import MapGL, { Marker, Popup, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import DifficultyBadge from './DifficultyBadge';
import { DIFFICULTIES, UNKNOWN_DIFFICULTY_COLOR, humanize, liftLabel, statusNote } from '../utils/format';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || '';
// Visible lines are 2-3px wide; clicks are caught by wider transparent copies on top
const INTERACTIVE_LAYERS = ['trails-hit', 'lifts-hit'];
const HIT_PAINT = { 'line-width': 14, 'line-opacity': 0 };
const DEFAULT_ZOOM = 12;

// Same colours as the difficulty badges and legend
const TRAIL_COLOR = [
  'match', ['get', 'difficulty'],
  ...Object.entries(DIFFICULTIES).flatMap(([difficulty, { color }]) => [difficulty, color]),
  UNKNOWN_DIFFICULTY_COLOR
];

const LIFT_COLOR = [
  'case',
  // Closed or maintenance status
  ['in', ['get', 'status'], ['literal', ['closed', 'maintenance', 'abandoned', 'out_of_order']]], '#9E9E9E',
  // Gondola/Tram/Cable Car
  ['in', ['get', 'aerialway'], ['literal', ['gondola', 'cable_car', 'tram']]], '#FF9800',
  // Chairlift
  ['==', ['get', 'aerialway'], 'chair_lift'], '#4ECDC4',
  // Surface lifts (T-bar, rope tow, drag lift, etc.)
  ['in', ['get', 'aerialway'], ['literal', ['t-bar', 'rope_tow', 'drag_lift', 'j-bar', 'platter']]], '#8E24AA',
  // Default for other lift types
  '#4ECDC4'
];

const TRAIL_PAINT = {
  'line-color': TRAIL_COLOR,
  'line-width': ['match', ['get', 'difficulty'], ['expert', 'extreme'], 3, 2],
  'line-opacity': 0.8
};
// With a highlight, matching runs get a little stronger and the rest fade, so it is still the same map
const HIGHLIGHT_TRAIL_PAINT = {
  'line-color': TRAIL_COLOR,
  'line-width': [
    'case',
    ['get', 'highlighted'], ['match', ['get', 'difficulty'], ['expert', 'extreme'], 4, 3.5],
    ['match', ['get', 'difficulty'], ['expert', 'extreme'], 3, 2]
  ],
  'line-opacity': ['case', ['get', 'highlighted'], 1, 0.35]
};
// A faint light edge keeps dark (advanced, expert) runs readable against the terrain
const HIGHLIGHT_CASING_PAINT = { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.5 };

const toLngLat = (coordinates) => (coordinates || [])
  .filter((point) => Number.isFinite(point.longitude) && Number.isFinite(point.latitude))
  .map((point) => [point.longitude, point.latitude]);

// Mapbox turns nested objects in feature properties into JSON strings, so only
// flat values go into the GeoJSON; the full trail or lift is looked up by id on click.
const toFeatureCollection = (items, pickProperties) => ({
  type: 'FeatureCollection',
  features: items
    .map((item) => ({ item, coordinates: toLngLat(item.coordinates) }))
    .filter(({ coordinates }) => coordinates.length >= 2)
    .map(({ item, coordinates }) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates },
      properties: { id: item._id, ...pickProperties(item) }
    }))
});

// [[west, south], [east, north]] around the given trails, or null
const boundsOf = (trails) => {
  const points = trails.flatMap((trail) => toLngLat(trail.coordinates));
  if (points.length === 0) return null;
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
};

// highlightedIds: trail ids to emphasise (from the assistant's "Show on map" links), or null
function ResortMap({ resort, trails = [], lifts = [], showTrails = true, showLifts = true, highlightedIds = null }) {
  const mapRef = useRef(null);
  const resortCenter = useMemo(() => {
    const lat = parseFloat(resort?.location_coordinate?.lat);
    const lon = parseFloat(resort?.location_coordinate?.long);
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return [lon, lat]; // Mapbox uses [longitude, latitude]
    }
    return null;
  }, [resort?.location_coordinate?.lat, resort?.location_coordinate?.long]);

  const [viewport, setViewport] = useState(() => ({
    longitude: resortCenter?.[0] ?? 0,
    latitude: resortCenter?.[1] ?? 0,
    zoom: resortCenter ? DEFAULT_ZOOM : 1
  }));
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [cursor, setCursor] = useState('grab');

  // Recentre only when the resort itself changes, not after the user pans
  useEffect(() => {
    if (resortCenter) {
      setViewport((previous) => ({ ...previous, longitude: resortCenter[0], latitude: resortCenter[1], zoom: DEFAULT_ZOOM }));
    }
    setSelectedFeature(null);
  }, [resortCenter]);

  const trailsById = useMemo(() => new Map(trails.map((trail) => [trail._id, trail])), [trails]);
  const liftsById = useMemo(() => new Map(lifts.map((lift) => [lift._id, lift])), [lifts]);

  const trailsGeoJSON = useMemo(
    () => toFeatureCollection(showTrails ? trails : [], (trail) => ({
      difficulty: trail.difficulty || 'unknown',
      highlighted: Boolean(highlightedIds?.has(trail._id))
    })),
    [trails, showTrails, highlightedIds]
  );
  const highlighting = Boolean(highlightedIds);

  // Bring the highlighted runs into view, once the map has loaded
  const highlightBounds = useMemo(
    () => (highlightedIds?.size ? boundsOf(trails.filter((trail) => highlightedIds.has(trail._id))) : null),
    [trails, highlightedIds]
  );
  const fitHighlight = useCallback(() => {
    if (highlightBounds) mapRef.current?.fitBounds(highlightBounds, { padding: 60, maxZoom: 14.5, duration: 0 });
  }, [highlightBounds]);

  useEffect(() => {
    fitHighlight();
  }, [fitHighlight]);
  const liftsGeoJSON = useMemo(
    () => toFeatureCollection(showLifts ? lifts : [], (lift) => ({ aerialway: lift.aerialway, status: lift.status })),
    [lifts, showLifts]
  );

  // A click on a trail or lift opens its popup at the click point; anywhere else closes it
  const onMapClick = useCallback((event) => {
    const feature = event.features?.[0];
    const isTrail = feature?.layer.id === 'trails-hit';
    const data = feature && (isTrail ? trailsById : liftsById).get(feature.properties.id);

    setSelectedFeature(data ? {
      type: isTrail ? 'trail' : 'lift',
      data,
      longitude: event.lngLat.lng,
      latitude: event.lngLat.lat
    } : null);
  }, [trailsById, liftsById]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="map-placeholder">
        The map needs a Mapbox token. Set REACT_APP_MAPBOX_TOKEN in client/.env and restart the dev server.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '500px', position: 'relative', backgroundColor: '#f0f0f0' }}>
      <MapGL
        ref={mapRef}
        onLoad={fitHighlight}
        {...viewport}
        onMove={(evt) => setViewport(evt.viewState)}
        onClick={onMapClick}
        onMouseEnter={() => setCursor('pointer')}
        onMouseLeave={() => setCursor('grab')}
        cursor={cursor}
        onError={(e) => console.error('Map error:', e.error || e)}
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        reuseMaps
        dragRotate={false}
        touchPitch={false}
        interactiveLayerIds={INTERACTIVE_LAYERS}
      >
        {/* Trails as Lines */}
        <Source id="trails-source" type="geojson" data={trailsGeoJSON}>
          {highlighting && (
            <Layer id="trails-highlight-casing" type="line" filter={['get', 'highlighted']} paint={HIGHLIGHT_CASING_PAINT} />
          )}
          <Layer id="trails-layer" type="line" paint={highlighting ? HIGHLIGHT_TRAIL_PAINT : TRAIL_PAINT} />
          <Layer id="trails-hit" type="line" paint={HIT_PAINT} />
        </Source>

        {/* Lifts as Lines */}
        <Source id="lifts-source" type="geojson" data={liftsGeoJSON}>
          <Layer
            id="lifts-layer"
            type="line"
            paint={{
              'line-color': LIFT_COLOR,
              'line-width': 3,
              'line-opacity': highlighting ? 0.45 : 0.9,
              'line-dasharray': [2, 2] // All lifts use dashed lines
            }}
          />
          <Layer id="lifts-hit" type="line" paint={HIT_PAINT} />
        </Source>

        {/* Resort centre dot and label */}
        {resortCenter && (
          <Marker longitude={resortCenter[0]} latitude={resortCenter[1]} anchor="left" offset={[-4, 0]}>
            <div className="map-marker">
              <span className="map-marker-dot" />
              <span className="map-marker-label">{resort.name}</span>
            </div>
          </Marker>
        )}

        {selectedFeature && (
          <Popup
            longitude={selectedFeature.longitude}
            latitude={selectedFeature.latitude}
            anchor="bottom"
            onClose={() => setSelectedFeature(null)}
            closeOnClick={false}
          >
            <div className="map-popup">
              <h3>{selectedFeature.data.name}</h3>
              {selectedFeature.type === 'trail' ? (
                <>
                  <p><DifficultyBadge difficulty={selectedFeature.data.difficulty} /></p>
                  <p>
                    {[humanize(selectedFeature.data.pisteType), humanize(selectedFeature.data.grooming), statusNote(selectedFeature.data.status)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </>
              ) : (
                <p>
                  {[
                    liftLabel(selectedFeature.data.aerialway),
                    selectedFeature.data.capacity && `${selectedFeature.data.capacity.toLocaleString()} people/hour`,
                    selectedFeature.data.duration && `${selectedFeature.data.duration} min`,
                    statusNote(selectedFeature.data.status)
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </Popup>
        )}
      </MapGL>
    </div>
  );
}

export default ResortMap;
