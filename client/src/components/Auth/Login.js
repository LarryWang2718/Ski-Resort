import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login, clearError } from '../../store/slices/authSlice';
import { ErrorNotice } from '../Feedback';

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth);
  // Pages that need a login send people here and expect them back afterwards
  const from = location.state?.from;

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from ? `${from.pathname}${from.search}` : '/', { replace: true, state: from?.state });
    }
  }, [isAuthenticated, navigate, from]);

  // Don't carry this page's error over to the next page
  useEffect(() => () => dispatch(clearError()), [dispatch]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(login(formData));
  };

  return (
    <div className="page-shell auth-shell">
      <header className="page-header">
        <div className="page-kicker">Account</div>
        <h1>Log in</h1>
      </header>

      {error && <ErrorNotice message={error} />}

      <form className="form-stack" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            className="field"
            required
          />
        </label>

        <label className="form-field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={formData.password}
            onChange={handleChange}
            className="field"
            required
          />
        </label>

        <button type="submit" className="btn btn-block" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="auth-switch">
        Don't have an account? <Link to="/register">Create one</Link>
      </p>
    </div>
  );
}

export default Login;
