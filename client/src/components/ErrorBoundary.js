import React from 'react';
import { ErrorNotice } from './Feedback';

// Keeps a crash in one page (e.g. the map) from blanking the whole app.
// Changing `resetKey` (the route) clears the error so navigation still works.
class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info.componentStack);
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page-shell">
          <ErrorNotice
            message="Something went wrong while showing this page."
            onRetry={() => this.setState({ error: null })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
