import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ResortMap from './ResortMap';

function ResortDetail() {
  const { id } = useParams();
  const [resort, setResort] = useState(null);
  const [trails, setTrails] = useState([]);
  const [lifts, setLifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [showLifts, setShowLifts] = useState(true);

  useEffect(() => {
    fetchResortDetails();
  }, [id]);

  const fetchResortDetails = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/resorts/${id}`);
      setResort(response.data.data.resort);
      setTrails(response.data.data.trails);
      setLifts(response.data.data.lifts);
    } catch (error) {
      console.error('Error fetching resort details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading resort details...</div>;
  }

  if (!resort) {
    return <div className="error">Resort not found</div>;
  }

  return (
    <div className="page-shell">
      <div className="card detail-hero">
        <div className="page-kicker">Resort Detail</div>
        <h1>{resort.name}</h1>
        <p className="meta-row"><strong>Country:</strong> {resort.location_country}</p>
        {resort.location_region && (
          <p className="meta-row"><strong>Region:</strong> {resort.location_region}</p>
        )}
        {resort.location_coordinate && (
          <p className="meta-row">
            <strong>Location:</strong> {parseFloat(resort.location_coordinate.lat).toFixed(4)}, {parseFloat(resort.location_coordinate.long).toFixed(4)}
          </p>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{trails.length}</div>
          <div className="stat-label">Total Trails</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{lifts.length}</div>
          <div className="stat-label">Total Lifts</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">
            {trails.filter(t => t.status === 'open').length}
          </div>
          <div className="stat-label">Open Trails</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">
            {lifts.filter(l => l.status === 'open').length}
          </div>
          <div className="stat-label">Open Lifts</div>
        </div>
      </div>

      {/* Interactive Map Section */}
      <div className="detail-section">
        <h2 className="section-title">Interactive Map</h2>
        <div className="card map-panel">
          {/* Map Controls */}
          <div className="map-controls">
            <label className="toggle-pill">
              <input
                type="checkbox"
                checked={showTrails}
                onChange={(e) => setShowTrails(e.target.checked)}
              />
              <span>Trails ({trails.length})</span>
            </label>
            <label className="toggle-pill">
              <input
                type="checkbox"
                checked={showLifts}
                onChange={(e) => setShowLifts(e.target.checked)}
              />
              <span>Lifts ({lifts.length})</span>
            </label>
          </div>

          {/* Map Component */}
          <ResortMap 
            resort={resort}
            trails={showTrails ? trails : []}
            lifts={showLifts ? lifts : []}
            showTrails={showTrails}
            showLifts={showLifts}
          />

          {/* Map Legend */}
          <div className="map-legend">
            <div className="legend-title">
              Legend:
            </div>
            
            {/* Resort Center */}
            <div className="legend-item">
              <div className="legend-dot" />
              <span>Resort Center</span>
            </div>
            
            {/* Trail Difficulties */}
            {showTrails && (
              <>
                <div className="legend-item">
                  <div className="legend-line legend-easy" />
                  <span>Easy (Green)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line legend-intermediate" />
                  <span>Intermediate (Blue)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line legend-advanced" />
                  <span>Advanced (Black)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line legend-expert" />
                  <span>Expert/Double Black</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line legend-extreme" />
                  <span>Extreme/Out-of-Bounds (Red)</span>
                </div>
              </>
            )}
            
            {/* Lift Types */}
            {showLifts && (
              <>
                <div className="legend-item">
                  <div className="legend-line legend-gondola" />
                  <span>Gondola/Tram/Cable Car</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line legend-chair" />
                  <span>Chairlift</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line legend-surface" />
                  <span>Surface Lift</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line legend-closed" />
                  <span>Closed/Maintenance</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <h2 className="section-title">Trails</h2>
      <div className="grid">
        {trails.map((trail) => (
          <div key={trail._id} className="card detail-card">
            <h3>{trail.name}</h3>
            <p className="meta-row"><strong>Difficulty:</strong> {trail.difficulty}</p>
            <p className="meta-row"><strong>Status:</strong> {trail.status}</p>
            {trail.pisteType && (
              <p className="meta-row"><strong>Type:</strong> {trail.pisteType}</p>
            )}
            {trail.grooming && (
              <p className="meta-row"><strong>Grooming:</strong> {trail.grooming}</p>
            )}
            {trail.lit && (
              <p className="meta-row"><strong>Night Skiing:</strong> {trail.lit ? 'Yes' : 'No'}</p>
            )}
          </div>
        ))}
      </div>

      <h2 className="section-title">Lifts</h2>
      <div className="grid">
        {lifts.map((lift) => (
          <div key={lift._id} className="card detail-card">
            <h3>{lift.name}</h3>
            <p className="meta-row"><strong>Type:</strong> {lift.aerialway}</p>
            <p className="meta-row"><strong>Status:</strong> {lift.status}</p>
            {lift.capacity && (
              <p className="meta-row"><strong>Capacity:</strong> {lift.capacity} people/hour</p>
            )}
            {lift.duration && (
              <p className="meta-row"><strong>Duration:</strong> {lift.duration} minutes</p>
            )}
            {lift.lit && (
              <p className="meta-row"><strong>Night Operation:</strong> {lift.lit ? 'Yes' : 'No'}</p>
            )}
            {lift.oneway && (
              <p className="meta-row"><strong>One Way:</strong> {lift.oneway ? 'Yes' : 'No'}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ResortDetail; 
