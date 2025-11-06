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
    <div>
      <div className="card">
        <h1>{resort.name}</h1>
        <p><strong>Country:</strong> {resort.location_country}</p>
        {resort.location_region && (
          <p><strong>Region:</strong> {resort.location_region}</p>
        )}
        {resort.location_coordinate && (
          <p>
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
      <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
        <h2 style={{ color: 'white', marginBottom: '1rem' }}>Interactive Map</h2>
        <div className="card" style={{ padding: '1.5rem' }}>
          {/* Map Controls */}
          <div style={{ 
            marginBottom: '1rem', 
            display: 'flex', 
            gap: '1.5rem', 
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              cursor: 'pointer',
              color: '#333',
              fontSize: '1rem'
            }}>
              <input
                type="checkbox"
                checked={showTrails}
                onChange={(e) => setShowTrails(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: '500', color: '#333' }}>Trails ({trails.length})</span>
            </label>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              cursor: 'pointer',
              color: '#333',
              fontSize: '1rem'
            }}>
              <input
                type="checkbox"
                checked={showLifts}
                onChange={(e) => setShowLifts(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: '500', color: '#333' }}>Lifts ({lifts.length})</span>
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
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: 'rgba(255, 255, 255, 0.95)', 
            borderRadius: '4px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5rem',
            fontSize: '1rem'
          }}>
            <div style={{ color: '#333', fontWeight: 'bold', width: '100%', marginBottom: '0.5rem' }}>
              Legend:
            </div>
            
            {/* Resort Center */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                background: '#000000',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                border: '2px solid #333'
              }} />
              <span style={{ color: '#333' }}>Resort Center</span>
            </div>
            
            {/* Trail Difficulties */}
            {showTrails && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    background: '#2E7D32',
                    width: '14px',
                    height: '3px',
                    borderRadius: '2px'
                  }} />
                  <span style={{ color: '#333' }}>Easy (Green)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    background: '#1976D2',
                    width: '14px',
                    height: '3px',
                    borderRadius: '2px'
                  }} />
                  <span style={{ color: '#333' }}>Intermediate (Blue)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    background: '#212121',
                    width: '14px',
                    height: '3px',
                    borderRadius: '2px'
                  }} />
                  <span style={{ color: '#333' }}>Advanced (Black)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    background: '#000000',
                    width: '14px',
                    height: '4px',
                    borderRadius: '2px'
                  }} />
                  <span style={{ color: '#333' }}>Expert/Double Black</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    background: '#B71C1C',
                    width: '14px',
                    height: '3px',
                    borderRadius: '2px'
                  }} />
                  <span style={{ color: '#333' }}>Extreme/Out-of-Bounds (Red)</span>
                </div>
              </>
            )}
            
            {/* Lift Types */}
            {showLifts && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    background: 'repeating-linear-gradient(to right, #FF9800 0px, #FF9800 4px, transparent 4px, transparent 8px)',
                    width: '14px',
                    height: '3px',
                    borderRadius: '2px'
                  }} />
                  <span style={{ color: '#333' }}>Gondola/Tram/Cable Car (Orange, Dashed)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    background: 'repeating-linear-gradient(to right, #4ECDC4 0px, #4ECDC4 4px, transparent 4px, transparent 8px)',
                    width: '14px',
                    height: '3px',
                    borderRadius: '2px'
                  }} />
                  <span style={{ color: '#333' }}>Chairlift (Aqua, Dashed)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    background: 'repeating-linear-gradient(to right, #8E24AA 0px, #8E24AA 4px, transparent 4px, transparent 8px)',
                    width: '14px',
                    height: '3px',
                    borderRadius: '2px'
                  }} />
                  <span style={{ color: '#333' }}>Surface Lift (Purple, Dashed)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    background: 'repeating-linear-gradient(to right, #9E9E9E 0px, #9E9E9E 4px, transparent 4px, transparent 8px)',
                    width: '14px',
                    height: '3px',
                    borderRadius: '2px'
                  }} />
                  <span style={{ color: '#333' }}>Closed/Maintenance (Gray, Dashed)</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <h2 style={{ color: 'white', marginTop: '2rem' }}>Trails</h2>
      <div className="grid">
        {trails.map((trail) => (
          <div key={trail._id} className="card">
            <h3>{trail.name}</h3>
            <p><strong>Difficulty:</strong> {trail.difficulty}</p>
            <p><strong>Status:</strong> {trail.status}</p>
            {trail.pisteType && (
              <p><strong>Type:</strong> {trail.pisteType}</p>
            )}
            {trail.grooming && (
              <p><strong>Grooming:</strong> {trail.grooming}</p>
            )}
            {trail.lit && (
              <p><strong>Night Skiing:</strong> {trail.lit ? 'Yes' : 'No'}</p>
            )}
          </div>
        ))}
      </div>

      <h2 style={{ color: 'white', marginTop: '2rem' }}>Lifts</h2>
      <div className="grid">
        {lifts.map((lift) => (
          <div key={lift._id} className="card">
            <h3>{lift.name}</h3>
            <p><strong>Type:</strong> {lift.aerialway}</p>
            <p><strong>Status:</strong> {lift.status}</p>
            {lift.capacity && (
              <p><strong>Capacity:</strong> {lift.capacity} people/hour</p>
            )}
            {lift.duration && (
              <p><strong>Duration:</strong> {lift.duration} minutes</p>
            )}
            {lift.lit && (
              <p><strong>Night Operation:</strong> {lift.lit ? 'Yes' : 'No'}</p>
            )}
            {lift.oneway && (
              <p><strong>One Way:</strong> {lift.oneway ? 'Yes' : 'No'}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ResortDetail; 