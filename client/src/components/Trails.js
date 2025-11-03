import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Trails() {
  const [trails, setTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [resortQuery, setResortQuery] = useState('');
  const [resortId, setResortId] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    // Fetch only on initial mount and page change. Search via submit.
    fetchTrails();
  }, [page]);

  const fetchTrails = async (opts = {}) => {
    const currentPage = opts.pageArg || page;
    const currentResortId = opts.resortIdArg !== undefined ? opts.resortIdArg : resortId;
    setLoading(true);
    try {
      let url = `/api/trails?page=${currentPage}&limit=20`;
      if (searchTerm) {
        url = `/api/trails/search?q=${encodeURIComponent(searchTerm)}&limit=20`;
        if (difficulty) url += `&difficulty=${encodeURIComponent(difficulty)}`;
        if (currentResortId) url += `&resort=${encodeURIComponent(currentResortId)}`;
      } else {
        if (difficulty) url += `&difficulty=${encodeURIComponent(difficulty)}`;
        if (currentResortId) url += `&resort=${encodeURIComponent(currentResortId)}`;
      }

      const response = await axios.get(url);
      setTrails(response.data.data);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (error) {
      console.error('Error fetching trails:', error);
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
      await fetchTrails({ pageArg: 1, resortIdArg: resolvedResortId });
    };
    resolveAndFetch();
  };

  if (loading) {
    return <div className="loading">Loading trails...</div>;
  }

  return (
    <div>
      <h1 style={{ color: 'white', marginBottom: '2rem' }}>Ski Trails</h1>
      
      <div className="card">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search trails..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-bar"
          />
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="search-bar"
          >
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="intermediate">Intermediate</option>
            <option value="difficult">Difficult</option>
            <option value="expert">Expert</option>
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
        {trails.map((trail) => (
          <div key={trail._id} className="card">
            <h3>{trail.name}</h3>
            <p><strong>Difficulty:</strong> {trail.difficulty}</p>
            <p><strong>Status:</strong> {trail.status}</p>
            {trail.resort && (
              <p><strong>Resort:</strong> {trail.resort.name}</p>
            )}
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

export default Trails; 