import React from 'react';
import ReactDOM from 'react-dom/client';
import 'mapbox-gl/dist/mapbox-gl.css';
import './index.css';
import App from './App';
import { store } from './store/store';
import { onUnauthorized } from './api/client';
import { sessionExpired } from './store/slices/authSlice';

// Any 401 on an authenticated request means the stored token is no longer valid
onUnauthorized((message) => store.dispatch(sessionExpired(message)));

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
