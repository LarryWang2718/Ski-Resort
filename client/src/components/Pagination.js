import React from 'react';

function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;

  return (
    <nav className="pagination-bar" aria-label="Pagination">
      <button type="button" className="btn btn-secondary" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        Previous
      </button>
      <span className="pagination-copy">
        Page {page.toLocaleString()} of {pages.toLocaleString()}
      </span>
      <button type="button" className="btn btn-secondary" onClick={() => onChange(page + 1)} disabled={page >= pages}>
        Next
      </button>
    </nav>
  );
}

export default Pagination;
