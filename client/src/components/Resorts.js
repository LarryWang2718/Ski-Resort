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
    // Fetch when page changes or on initial mount. Search occurs via form submit.
    fetchResorts();
  }, [page]);

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
    <div className="page-shell">
      <div className="page-header">
        <div className="page-kicker">Directory</div>
        <h1>Ski Resorts</h1>
        <p>Search the catalog by name or country and jump straight into trail and lift detail.</p>
      </div>
      
      <div className="card filter-panel">
        <form onSubmit={handleSearch} className="search-form">
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
          <div key={resort._id} className="card resort-card">
            <h3>{resort.name}</h3>
            <p className="meta-row"><strong>Country:</strong> {resort.location_country}</p>
            {resort.location_region && (
              <p className="meta-row"><strong>Region:</strong> {resort.location_region}</p>
            )}
            {resort.location_coordinate && (
              <p className="meta-row">
                <strong>Location:</strong> {parseFloat(resort.location_coordinate.lat).toFixed(4)}, {parseFloat(resort.location_coordinate.long).toFixed(4)}
              </p>
            )}
            <Link to={`/resorts/${resort._id}`} className="btn">
              View Details
            </Link>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination-bar">
          <button
            className="btn btn-secondary"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Previous
          </button>
          <span className="pagination-copy">
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-secondary"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default Resorts; 
