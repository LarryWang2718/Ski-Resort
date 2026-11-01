import axios from 'axios';

const USER_KEY = 'user';

// The logged-in user (including their token), kept between visits. A corrupted value means logged out.
export const loadStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
};

export const storeUser = (user) => {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
};

const api = axios.create({
  baseURL: '/api',
  timeout: 15000
});

api.interceptors.request.use((config) => {
  const token = loadStoredUser()?.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Registered by the store so a rejected token logs the user out (avoids a circular import)
export const onUnauthorized = (handler) => {
  api.interceptors.response.use(undefined, (error) => {
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      handler(error.response.data?.message);
    }
    return Promise.reject(error);
  });
};

// A message that is safe and useful to show to the user
export const getErrorMessage = (error) => {
  if (error.code === 'ECONNABORTED') {
    return 'The server took too long to respond. Try again.';
  }
  // No response, or the dev proxy's plain-text error page instead of our JSON
  if (!error.response || typeof error.response.data !== 'object') {
    return "Can't reach the server. Check your connection and try again.";
  }
  return error.response.data?.message || 'Something went wrong. Try again.';
};

// "/resorts" + { q: 'alps', page: 2, country: '' } -> "/resorts?q=alps&page=2"
export const withQuery = (path, params) => {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  const query = new URLSearchParams(entries).toString();
  return query ? `${path}?${query}` : path;
};

export default api;
