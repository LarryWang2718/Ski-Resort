import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Lifts() {
  const [lifts, setLifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [aerialway, setAerialway] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLifts();
  }, [page, searchTerm, aerialway]);

  const fetchLifts = async () => {
    setLoading(true);
    try {
      let url = `/api/lifts?page=${page}&limit=20`;
      if (searchTerm) {
        url = `/api/lifts/search?q=${searchTerm}&limit=20`;
      } else if (aerialway) {
        url += `&aerialway=${aerialway}`;
      }

      const response = await axios.get(url);
      setLifts(response.data.data);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (error) {
      console.error('Error fetching lifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLifts();
  };

  if (loading) {
    return <div className="loading">Loading lifts...</div>;
  }

  return (
    <div>
      <h1 style={{ color: 'white', marginBottom: '2rem' }}>Ski Lifts</h1>
      
      <div className="card">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search lifts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-bar"
          />
          <select
            value={aerialway}
            onChange={(e) => setAerialway(e.target.value)}
            className="search-bar"
          >
            <option value="">All Types</option>
            <option value="chair_lift">Chair Lift</option>
            <option value="gondola">Gondola</option>
            <option value="cable_car">Cable Car</option>
            <option value="drag_lift">Drag Lift</option>
            <option value="magic_carpet">Magic Carpet</option>
          </select>
          <button type="submit" className="btn">Search</button>
        </form>
      </div>

      <div className="grid">
        {lifts.map((lift) => (
          <div key={lift._id} className="card">
            <h3>{lift.name}</h3>
            <p><strong>Type:</strong> {lift.aerialway}</p>
            <p><strong>Status:</strong> {lift.status}</p>
            {lift.resort && (
              <p><strong>Resort:</strong> {lift.resort.name}</p>
            )}
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

      {totalPages > 1 && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            style={{ marginRight: '1rem' }}
          >
            Previous
          </button>
          <span style={{ color: 'white', margin: '0 1rem' }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-secondary"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            style={{ marginLeft: '1rem' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default Lifts; 