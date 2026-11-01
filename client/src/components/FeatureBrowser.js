import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useApi from '../hooks/useApi';
import api, { getErrorMessage, withQuery } from '../api/client';
import { formatLocation } from '../utils/format';
import { EmptyNotice, ErrorNotice, LoadingNotice } from './Feedback';
import Pagination from './Pagination';

const PAGE_SIZE = 20;

// Shared list page for trails and lifts: text search, one type filter, a resort filter, pagination.
// `typeFilter` is { param, label, options: [[value, label]] }; `renderMeta(item)` fills the right column.
function FeatureBrowser({ endpoint, kicker, title, intro, noun, typeFilter, renderMeta }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const type = searchParams.get(typeFilter.param) || '';
  const resort = searchParams.get('resort') || '';
  const resortName = searchParams.get('resortName') || '';
  const page = Number(searchParams.get('page')) || 1;

  const [form, setForm] = useState({ q, resortName });
  const [resolveError, setResolveError] = useState(null);
  useEffect(() => {
    setForm({ q, resortName });
  }, [q, resortName]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  const results = useApi(withQuery(endpoint, { q, [typeFilter.param]: type, resort, page, limit: PAGE_SIZE }));
  const items = results.data?.data || [];
  const pagination = results.data?.pagination;
  const hasFilters = Boolean(q || type || resort);

  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next);
  };

  // The resort box takes a name; resolve it to the best-ranked matching resort
  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = form.resortName.trim();
    let resortParams = { resort: '', resortName: '' };

    if (name && name !== resortName) {
      try {
        const response = await api.get(withQuery('/resorts/search', { q: name, limit: 1 }));
        const match = response.data.data[0];
        if (!match) {
          setResolveError(`No resort matches “${name}”.`);
          return;
        }
        resortParams = { resort: match._id, resortName: match.name };
      } catch (error) {
        setResolveError(getErrorMessage(error));
        return;
      }
    } else if (name) {
      resortParams = { resort, resortName };
    }

    setResolveError(null);
    updateParams({ q: form.q.trim(), ...resortParams });
  };

  const clearFilters = () => {
    setResolveError(null);
    setSearchParams({});
  };

  return (
    <div className="page-shell">
      <header className="page-header">
        <div className="page-kicker">{kicker}</div>
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>

      <form className="filter-bar" role="search" onSubmit={handleSubmit}>
        <input
          type="search"
          className="field field--grow"
          placeholder={`Search ${noun} by name`}
          aria-label={`Search ${noun}`}
          value={form.q}
          onChange={(e) => setForm({ ...form, q: e.target.value })}
        />
        <select
          className="field"
          aria-label={typeFilter.label}
          value={type}
          onChange={(e) => updateParams({ [typeFilter.param]: e.target.value })}
        >
          <option value="">{`All ${typeFilter.label.toLowerCase()}`}</option>
          {typeFilter.options.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input
          type="search"
          className="field"
          placeholder="Resort name"
          aria-label="Filter by resort"
          value={form.resortName}
          onChange={(e) => setForm({ ...form, resortName: e.target.value })}
        />
        <button type="submit" className="btn">Search</button>
      </form>

      <div className="list-summary">
        <span>
          {pagination && `${pagination.total.toLocaleString()} ${hasFilters ? `matching ${noun}` : noun}`}
          {resortName && ` at ${resortName}`}
        </span>
        {hasFilters && (
          <button type="button" className="link-button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {resolveError && <ErrorNotice message={resolveError} />}
      {results.error && <ErrorNotice message={results.error} onRetry={results.reload} />}
      {!results.data && results.loading && <LoadingNotice>{`Loading ${noun}…`}</LoadingNotice>}
      {results.data && items.length === 0 && <EmptyNotice>{`No ${noun} match these filters.`}</EmptyNotice>}

      {items.length > 0 && (
        <ul className={`list${results.loading ? ' is-stale' : ''}`} aria-busy={results.loading}>
          {items.map((item) => {
            const itemResort = typeof item.resort === 'object' ? item.resort : null;
            const content = (
              <>
                <div className="list-text">
                  <span className="list-title">{item.name}</span>
                  <span className="list-sub">
                    {itemResort ? [itemResort.name, formatLocation(itemResort)].filter(Boolean).join(' · ') : ''}
                  </span>
                </div>
                <span className="list-meta">{renderMeta(item)}</span>
              </>
            );
            return (
              <li key={item._id}>
                {itemResort ? (
                  <Link to={`/resorts/${itemResort._id}`} className="list-row">{content}</Link>
                ) : (
                  <div className="list-row list-row--static">{content}</div>
                )}
              </li>
            );
          })}
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

export default FeatureBrowser;
