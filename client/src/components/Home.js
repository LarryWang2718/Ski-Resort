import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

function Home() {
  const [stats, setStats] = useState({
    resorts: 0,
    trails: 0,
    lifts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [resortsRes, trailsRes, liftsRes] = await Promise.all([
          axios.get('/api/resorts?limit=1'),
          axios.get('/api/trails?limit=1'),
          axios.get('/api/lifts?limit=1')
        ]);

        setStats({
          resorts: resortsRes.data.pagination?.total || 0,
          trails: trailsRes.data.pagination?.total || 0,
          lifts: liftsRes.data.pagination?.total || 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div className="hero">
        <h1>Discover Amazing Ski Resorts</h1>
        <p>Explore thousands of ski resorts, trails, and lifts around the world</p>
        <Link to="/resorts" className="btn">
          Explore Resorts
        </Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.resorts.toLocaleString()}</div>
          <div className="stat-label">Ski Resorts</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.trails.toLocaleString()}</div>
          <div className="stat-label">Trails</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.lifts.toLocaleString()}</div>
          <div className="stat-label">Lifts</div>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>🏔️ Find Your Perfect Resort</h3>
          <p>Search through our extensive database of ski resorts worldwide. Filter by location, amenities, and more.</p>
          <Link to="/resorts" className="btn">Browse Resorts</Link>
        </div>
        <div className="card">
          <h3>⛷️ Explore Trails</h3>
          <p>Discover trails of all difficulty levels. From beginner-friendly runs to expert challenges.</p>
          <Link to="/trails" className="btn">View Trails</Link>
        </div>
        <div className="card">
          <h3>🚠 Check Lift Status</h3>
          <p>Get real-time information about lifts, gondolas, and chairlifts at your favorite resorts.</p>
          <Link to="/lifts" className="btn">See Lifts</Link>
        </div>
      </div>
    </div>
  );
}

export default Home; 