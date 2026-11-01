import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import useApi from '../hooks/useApi';
import ResortMap from './ResortMap';
import DifficultyBadge from './DifficultyBadge';
import { EmptyNotice, ErrorNotice, LoadingNotice } from './Feedback';
import { DIFFICULTIES, formatLocation, formatStat, humanize, liftLabel, statusNote } from '../utils/format';

// Big resorts map close to 1,000 trails; render a first batch and let the user ask for the rest
const INITIAL_ROWS = 50;

const LIFT_LEGEND = [
  ['legend-gondola', 'Gondola/Tram/Cable Car'],
  ['legend-chair', 'Chairlift'],
  ['legend-surface', 'Surface Lift'],
  ['legend-closed', 'Closed/Maintenance']
];

function FeatureList({ title, items, renderRow }) {
  const [filter, setFilter] = useState('');
  const [showAll, setShowAll] = useState(false);
  const noun = title.toLowerCase();

  const matches = useMemo(() => {
    const text = filter.trim().toLowerCase();
    return text ? items.filter((item) => item.name?.toLowerCase().includes(text)) : items;
  }, [items, filter]);
  const visible = showAll ? matches : matches.slice(0, INITIAL_ROWS);

  return (
    <section className="detail-section">
      <div className="section-heading">
        <h2 className="section-title">
          {title} <span className="section-count">{items.length.toLocaleString()}</span>
        </h2>
        {items.length > 10 && (
          <input
            type="search"
            className="field field--compact"
            placeholder={`Filter ${noun} by name`}
            aria-label={`Filter ${noun} by name`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}
      </div>

      {matches.length === 0 ? (
        <EmptyNotice>
          {items.length === 0 ? `No ${noun} are mapped for this resort.` : `No ${noun} match “${filter}”.`}
        </EmptyNotice>
      ) : (
        <ul className="list">
          {visible.map((item) => (
            <li key={item._id} className="list-row list-row--static">{renderRow(item)}</li>
          ))}
        </ul>
      )}

      {!showAll && matches.length > INITIAL_ROWS && (
        <button type="button" className="btn btn-secondary list-more" onClick={() => setShowAll(true)}>
          Show all {matches.length.toLocaleString()} {noun}
        </button>
      )}
    </section>
  );
}

const renderTrail = (trail) => (
  <>
    <div className="list-text">
      <span className="list-title">{trail.name}</span>
      <span className="list-sub">
        {[humanize(trail.pisteType), humanize(trail.grooming), trail.lit && 'Night skiing', statusNote(trail.status)]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </div>
    <span className="list-meta"><DifficultyBadge difficulty={trail.difficulty} /></span>
  </>
);

const renderLift = (lift) => (
  <>
    <div className="list-text">
      <span className="list-title">{lift.name}</span>
      <span className="list-sub">{[lift.lit && 'Night operation', statusNote(lift.status)].filter(Boolean).join(' · ')}</span>
    </div>
    <span className="list-meta">
      {[
        liftLabel(lift.aerialway),
        lift.capacity && `${lift.capacity.toLocaleString()} people/hour`,
        lift.duration && `${lift.duration} min`
      ].filter(Boolean).join(' · ')}
    </span>
  </>
);

function ResortDetail() {
  const { id } = useParams();
  // Don't show the previous resort while the next one loads
  const { data, error, status, reload } = useApi(`/resorts/${id}`, { keepPreviousData: false });
  const [showTrails, setShowTrails] = useState(true);
  const [showLifts, setShowLifts] = useState(true);

  if (error) {
    return (
      <div className="page-shell">
        {status === 404 || status === 400 ? (
          <EmptyNotice>
            That resort doesn't exist. <Link to="/resorts">Browse all resorts</Link>
          </EmptyNotice>
        ) : (
          <ErrorNotice message={error} onRetry={reload} />
        )}
      </div>
    );
  }

  if (!data) {
    return <div className="page-shell"><LoadingNotice>Loading resort details…</LoadingNotice></div>;
  }

  const { resort, trails, lifts } = data.data;
  const stats = [
    ['Slopes', formatStat(resort.total_slope_length_km, 'km')],
    ['Lifts', formatStat(resort.number_of_lifts)],
    ['Top elevation', formatStat(resort.elevation_top_m, 'm')],
    ['Vertical drop', formatStat(resort.elevation_difference_m, 'm')],
    ['Annual snowfall', formatStat(resort.annual_snowfall_cm, 'cm')]
  ].filter(([, value]) => value);

  return (
    <div className="page-shell">
      <header className="detail-header">
        <Link to="/resorts" className="back-link">← All resorts</Link>
        <div className="page-kicker">{resort.rank ? `Ranked #${resort.rank}` : 'Resort'}</div>
        <h1>{resort.name}</h1>
        <p className="detail-location">{formatLocation(resort)}</p>
        <Link
          to={`/assistant?resort=${resort._id}`}
          state={{ resortName: resort.name }}
          className="btn btn-secondary btn-small detail-ask"
        >
          Ask about this resort
        </Link>
      </header>

      {stats.length > 0 && (
        <dl className="stat-strip stat-strip--compact">
          {stats.map(([label, value]) => (
            <div className="stat" key={label}>
              <dt className="stat-label">{label}</dt>
              <dd className="stat-number">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <section className="detail-section">
        <div className="section-heading">
          <h2 className="section-title">Trail map</h2>
          <div className="map-controls">
            <label className="toggle-pill">
              <input type="checkbox" checked={showTrails} onChange={(e) => setShowTrails(e.target.checked)} />
              <span>Trails ({trails.length.toLocaleString()})</span>
            </label>
            <label className="toggle-pill">
              <input type="checkbox" checked={showLifts} onChange={(e) => setShowLifts(e.target.checked)} />
              <span>Lifts ({lifts.length.toLocaleString()})</span>
            </label>
          </div>
        </div>

        <div className="map-frame">
          <ResortMap
            resort={resort}
            trails={showTrails ? trails : []}
            lifts={showLifts ? lifts : []}
            showTrails={showTrails}
            showLifts={showLifts}
          />
        </div>

        <div className="map-legend">
          <div className="legend-item">
            <div className="legend-dot" />
            <span>Resort center</span>
          </div>
          {showTrails && Object.entries(DIFFICULTIES).map(([key, { label, color }]) => (
            <div className="legend-item" key={key}>
              <div className="legend-line" style={{ background: color }} />
              <span>{label}</span>
            </div>
          ))}
          {showLifts && LIFT_LEGEND.map(([className, label]) => (
            <div className="legend-item" key={className}>
              <div className={`legend-line ${className}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <FeatureList title="Trails" items={trails} renderRow={renderTrail} />
      <FeatureList title="Lifts" items={lifts} renderRow={renderLift} />
    </div>
  );
}

export default ResortDetail;
