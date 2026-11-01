import React from 'react';

export function LoadingNotice({ children = 'Loading…' }) {
  return <p className="notice" role="status">{children}</p>;
}

export function ErrorNotice({ message, onRetry }) {
  return (
    <div className="notice notice--error" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyNotice({ children }) {
  return <div className="notice">{children}</div>;
}
