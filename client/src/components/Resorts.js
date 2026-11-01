import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useApi from '../hooks/useApi';
import { withQuery } from '../api/client';
import { formatLocation, formatStat } from '../utils/format';
import { EmptyNotice, ErrorNotice, LoadingNotice } from './Feedback';
import Pagination from './Pagination';

const PAGE_SIZE = 20;

const resortStats = (resort) => [
  formatStat(resort.total_slope_length_km, 'km'),
  formatStat(resort.number_of_lifts, 'lifts'),
  formatStat(resort.elevation_top_m, 'm')
].filter(Boolean).join(' · ');

function Resorts() {
  // Filters live in the URL so Back from a resort returns to the same results
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const country = searchParams.get('country') || '';
  const region = searchParams.get('region') || '';
  const page = Number(searchParams.get('page')) || 1;

  const [searchText, setSearchText] = useState(q);
  useEffect(() => {
    setSearchText(q);
  }, [q]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  const filters = useApi('/resorts/filters');
  const resorts = useApi(withQuery('/resorts', { q, country, region, page, limit: PAGE_SIZE }));

  const countries = filters.data?.data || [];
  const regionGroups = country ? countries.filter((c) => c.country === country) : countries;
  const list = resorts.data?.data || [];
  const pagination = resorts.data?.pagination;
  const hasFilters = Boolean(q || country || region);

  // Empty values are dropped from the URL; any filter change starts again at page 1
  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    updateParams({ q: searchText.trim() });
  };

  // Region options carry their country, so picking one also selects the country
  const handleRegionChange = (value) => {
    const [regionCountry, regionName] = value ? value.split('|') : [country, ''];
    updateParams({ country: regionCountry, region: regionName });
  };

  const clearFilters = () => {
    setSearchText('');
    setSearchParams({});
  };

  return (
    <div className="page-shell">
      <header className="page-header">
        <div className="page-kicker">Directory</div>
        <h1>Ski Resorts</h1>
        <p>Search by name, or narrow the ranking down by country and region.</p>
      </header>

      <form className="filter-bar" role="search" onSubmit={handleSearch}>
        <input
          type="search"
          className="field field--grow"
          placeholder="Search resorts, regions or countries"
          aria-label="Search resorts"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <select
          className="field"
          aria-label="Country"
          value={country}
          onChange={(e) => updateParams({ country: e.target.value, region: '' })}
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c.country} value={c.country}>
              {c.country} ({c.resorts.toLocaleString()})
            </option>
          ))}
        </select>
        <select
          className="field"
          aria-label="Region"
          value={region ? `${country}|${region}` : ''}
          onChange={(e) => handleRegionChange(e.target.value)}
        >
          <option value="">All regions</option>
          {regionGroups.map((c) => (
            <optgroup key={c.country} label={c.country}>
              {c.regions.map((r) => (
                <option key={r} value={`${c.country}|${r}`}>{r}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="submit" className="btn">Search</button>
      </form>

      <div className="list-summary">
        <span>
          {pagination && `${pagination.total.toLocaleString()} ${hasFilters ? 'matching resorts' : 'resorts, ranked'}`}
        </span>
        {hasFilters && (
          <button type="button" className="link-button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {resorts.error && <ErrorNotice message={resorts.error} onRetry={resorts.reload} />}
      {!resorts.data && resorts.loading && <LoadingNotice>Loading resorts…</LoadingNotice>}
      {resorts.data && list.length === 0 && <EmptyNotice>No resorts match these filters.</EmptyNotice>}

      {list.length > 0 && (
        <ul className={`list${resorts.loading ? ' is-stale' : ''}`} aria-busy={resorts.loading}>
          {list.map((resort) => (
            <li key={resort._id}>
              <Link to={`/resorts/${resort._id}`} className="list-row">
                <div className="list-main">
                  <span className="list-rank">{resort.rank}</span>
                  <div className="list-text">
                    <span className="list-title">{resort.name}</span>
                    <span className="list-sub">{formatLocation(resort)}</span>
                  </div>
                </div>
                <span className="list-meta">{resortStats(resort)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pagination && (
        <Pagination
          page={pagination.page}
          pages={pagination.pages}
          onChange={(nextPage) => updateParams({ page: String(nextPage) })}
        />
      )}
    </div>
  );
}

export default Resorts;
