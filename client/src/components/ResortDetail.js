import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

function ResortDetail() {
  const { id } = useParams();
  const [resort, setResort] = useState(null);
  const [trails, setTrails] = useState([]);
  const [lifts, setLifts] = useState([]);
  const [loading, setLoading] = useState(true);

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
        {resort.coordinates && (
          <p>
            <strong>Location:</strong> {resort.coordinates.lat.toFixed(4)}, {resort.coordinates.lng.toFixed(4)}
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