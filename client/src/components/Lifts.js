import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Lifts() {
  const navigate = useNavigate();
  const [lifts, setLifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [aerialway, setAerialway] = useState('');
  const [resortQuery, setResortQuery] = useState('');
  const [resortId, setResortId] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    // Fetch only on initial mount and page change. Search via submit.
    fetchLifts();
  }, [page]);

  const fetchLifts = async (opts = {}) => {
    const currentPage = opts.pageArg || page;
    const currentResortId = opts.resortIdArg !== undefined ? opts.resortIdArg : resortId;
    setLoading(true);
    try {
      let url = `/api/lifts?page=${currentPage}&limit=20`;
      if (searchTerm) {
        url = `/api/lifts/search?q=${encodeURIComponent(searchTerm)}&limit=20`;
        if (aerialway) url += `&aerialway=${encodeURIComponent(aerialway)}`;
        if (currentResortId) url += `&resort=${encodeURIComponent(currentResortId)}`;
      } else {
        if (aerialway) url += `&aerialway=${encodeURIComponent(aerialway)}`;
        if (currentResortId) url += `&resort=${encodeURIComponent(currentResortId)}`;
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
    const resolveAndFetch = async () => {
      let resolvedResortId = '';
      if (resortQuery && resortQuery.trim().length > 0) {
        try {
          const r = await axios.get(`/api/resorts/search?q=${encodeURIComponent(resortQuery)}&limit=1`);
          resolvedResortId = r.data.data?.[0]?._id || '';
        } catch (err) {
          console.error('Error resolving resort:', err);
        }
      }
      setResortId(resolvedResortId);
      setPage(1);
      await fetchLifts({ pageArg: 1, resortIdArg: resolvedResortId });
    };
    resolveAndFetch();
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
          <input
            type="text"
            placeholder="Filter by resort name..."
            value={resortQuery}
            onChange={(e) => setResortQuery(e.target.value)}
            className="search-bar"
          />
          <button type="submit" className="btn">Search</button>
        </form>
      </div>

      <div className="grid">
        {lifts.map((lift) => {
          const resortId = lift.resort ? (typeof lift.resort === 'object' ? lift.resort._id : lift.resort) : null;
          return (
            <div 
              key={lift._id} 
              className="card"
              onClick={() => resortId && navigate(`/resorts/${resortId}`)}
              style={{ 
                cursor: resortId ? 'pointer' : 'default',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={(e) => {
                if (resortId) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (resortId) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '';
                }
              }}
            >
              <h3>{lift.name}</h3>
              <p><strong>Type:</strong> {lift.aerialway}</p>
              <p><strong>Status:</strong> {lift.status}</p>
              {lift.resort && (
                <p><strong>Resort:</strong> {typeof lift.resort === 'object' ? lift.resort.name : 'N/A'}</p>
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
              {resortId && (
                <p style={{ marginTop: '0.5rem', color: '#4A90E2', fontSize: '0.9rem', fontWeight: '500' }}>
                  Click to view resort →
                </p>
              )}
            </div>
          );
        })}
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