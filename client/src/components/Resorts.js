import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

function Resorts() {
  const [resorts, setResorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchResorts();
  }, [page, searchTerm, country]);

  const fetchResorts = async () => {
    setLoading(true);
    try {
      let url = `/api/resorts?page=${page}&limit=20`;
      if (searchTerm) {
        url = `/api/resorts/search?q=${searchTerm}&limit=20`;
      } else if (country) {
        url += `&country=${country}`;
      }

      const response = await axios.get(url);
      setResorts(response.data.data);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (error) {
      console.error('Error fetching resorts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchResorts();
  };

  if (loading) {
    return <div className="loading">Loading resorts...</div>;
  }

  return (
    <div>
      <h1 style={{ color: 'white', marginBottom: '2rem' }}>Ski Resorts</h1>
      
      <div className="card">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search resorts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-bar"
          />
          <input
            type="text"
            placeholder="Filter by country..."
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="search-bar"
          />
          <button type="submit" className="btn">Search</button>
        </form>
      </div>

      <div className="grid">
        {resorts.map((resort) => (
          <div key={resort._id} className="card">
            <h3>{resort.name}</h3>
            <p><strong>Country:</strong> {resort.location_country}</p>
            {resort.location_region && (
              <p><strong>Region:</strong> {resort.location_region}</p>
            )}
            {resort.coordinates && (
              <p>
                <strong>Location:</strong> {resort.coordinates.lat.toFixed(4)}, {resort.coordinates.lng.toFixed(4)}
              </p>
            )}
            <Link to={`/resorts/${resort._id}`} className="btn">
              View Details
            </Link>
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

export default Resorts; 