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
    <div className="page-shell">
      <div className="hero">
        <div className="hero-kicker">Mountain intelligence for ski days that matter</div>
        <h1>Find resorts worth the trip.</h1>
        <p>Scan terrain, lift networks, and resort data in one place before you commit a weekend or a full season.</p>
        <div className="hero-actions">
          <Link to="/resorts" className="btn">
            Explore Resorts
          </Link>
          <Link to="/trails" className="btn btn-ghost">
            Browse Trails
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.resorts.toLocaleString()}</div>
          <div className="stat-label">Indexed Resorts</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.trails.toLocaleString()}</div>
          <div className="stat-label">Mapped Trails</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.lifts.toLocaleString()}</div>
          <div className="stat-label">Lift Lines</div>
        </div>
      </div>

      <div className="grid feature-grid">
        <div className="card feature-card">
          <h3>Find Your Perfect Resort</h3>
          <p>Search through our extensive database of ski resorts worldwide. Filter by location, amenities, and more.</p>
          <Link to="/resorts" className="btn">Browse Resorts</Link>
        </div>
        <div className="card feature-card">
          <h3>Explore Trails</h3>
          <p>Discover trails of all difficulty levels. From beginner-friendly runs to expert challenges.</p>
          <Link to="/trails" className="btn">View Trails</Link>
        </div>
        <div className="card feature-card">
          <h3>Check Lift Status</h3>
          <p>Get real-time information about lifts, gondolas, and chairlifts at your favorite resorts.</p>
          <Link to="/lifts" className="btn">See Lifts</Link>
        </div>
      </div>
    </div>
  );
}

export default Home; 
