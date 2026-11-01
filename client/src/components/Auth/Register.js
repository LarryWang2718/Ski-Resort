import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { register, clearError } from '../../store/slices/authSlice';
import { ErrorNotice } from '../Feedback';

// Same rule the API enforces, so users find out before submitting
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_HINT = 'At least 8 characters, with an uppercase letter, a lowercase letter and a number.';

function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [passwordError, setPasswordError] = useState('');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => () => dispatch(clearError()), [dispatch]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    // Clear password error when user types
    if (e.target.name === 'password' || e.target.name === 'confirmPassword') {
      setPasswordError('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!PASSWORD_PATTERN.test(formData.password)) {
      setPasswordError(PASSWORD_HINT);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    // Remove confirmPassword from data sent to API
    const { confirmPassword, ...registerData } = formData;
    dispatch(register(registerData));
  };

  return (
    <div className="page-shell auth-shell">
      <header className="page-header">
        <div className="page-kicker">Account</div>
        <h1>Create account</h1>
      </header>

      {error && <ErrorNotice message={error} />}
      {passwordError && <ErrorNotice message={passwordError} />}

      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="form-field">
            <span>First name</span>
            <input
              type="text"
              name="firstName"
              autoComplete="given-name"
              value={formData.firstName}
              onChange={handleChange}
              className="field"
              required
            />
          </label>

          <label className="form-field">
            <span>Last name</span>
            <input
              type="text"
              name="lastName"
              autoComplete="family-name"
              value={formData.lastName}
              onChange={handleChange}
              className="field"
              required
            />
          </label>
        </div>

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
            autoComplete="new-password"
            value={formData.password}
            onChange={handleChange}
            className="field"
            required
          />
          <small className="form-hint">{PASSWORD_HINT}</small>
        </label>

        <label className="form-field">
          <span>Confirm password</span>
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={handleChange}
            className="field"
            required
          />
        </label>

        <button type="submit" className="btn btn-block" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}

export default Register;
