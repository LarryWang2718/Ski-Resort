import React from 'react';
import { Link } from 'react-router-dom';
import useApi from '../hooks/useApi';

// Totals come from the pagination block of a one-item page
const useTotal = (path) => useApi(`${path}?limit=1`).data?.pagination?.total;

const formatTotal = (total) => (total === undefined ? '—' : total.toLocaleString());

const SECTIONS = [
  {
    to: '/resorts',
    title: 'Find your resort',
    description: 'Ranked resorts with slope length, lift count, elevation and snowfall, filterable by country and region.'
  },
  {
    to: '/trails',
    title: 'Explore trails',
    description: 'Every mapped piste, from novice runs to extreme lines, searchable by difficulty and resort.'
  },
  {
    to: '/lifts',
    title: 'Compare lifts',
    description: 'Gondolas, chairlifts and surface lifts, with capacity and ride time where they are mapped.'
  }
];

function Home() {
  const resorts = useTotal('/resorts');
  const trails = useTotal('/trails');
  const lifts = useTotal('/lifts');

  return (
    <div className="page-shell">
      <section className="hero">
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
      </section>

      <dl className="stat-strip">
        <div className="stat">
          <dt className="stat-label">Indexed Resorts</dt>
          <dd className="stat-number">{formatTotal(resorts)}</dd>
        </div>
        <div className="stat">
          <dt className="stat-label">Mapped Trails</dt>
          <dd className="stat-number">{formatTotal(trails)}</dd>
        </div>
        <div className="stat">
          <dt className="stat-label">Lift Lines</dt>
          <dd className="stat-number">{formatTotal(lifts)}</dd>
        </div>
      </dl>

      <ul className="list">
        {SECTIONS.map((section) => (
          <li key={section.to}>
            <Link to={section.to} className="list-row">
              <div className="list-text">
                <span className="list-title">{section.title}</span>
                <span className="list-sub">{section.description}</span>
              </div>
              <span className="list-arrow" aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Home;
