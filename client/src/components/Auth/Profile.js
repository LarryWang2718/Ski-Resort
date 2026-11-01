import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout, updateProfile, clearError } from '../../store/slices/authSlice';
import { ErrorNotice } from '../Feedback';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

function Profile() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState('');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, loading, error, isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        password: '',
      });
    }
  }, [isAuthenticated, navigate, user]);

  const handleChange = (e) => {
    setFormError('');
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const updateData = { ...formData };
    if (!updateData.password) {
      delete updateData.password;
    } else if (!PASSWORD_PATTERN.test(updateData.password)) {
      setFormError('New password needs at least 8 characters, with an uppercase letter, a lowercase letter and a number.');
      return;
    }

    // Stay in edit mode if the save fails so nothing typed is lost
    const result = await dispatch(updateProfile(updateData));
    if (updateProfile.fulfilled.match(result)) {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setFormError('');
    dispatch(clearError());
    setIsEditing(false);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="page-shell auth-shell">
      <header className="page-header">
        <div className="page-kicker">Account</div>
        <h1>Profile</h1>
      </header>

      {(formError || error) && <ErrorNotice message={formError || error} />}

      {!isEditing ? (
        <>
          <dl className="detail-list">
            <div>
              <dt>Name</dt>
              <dd>{user?.firstName} {user?.lastName}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user?.role || 'user'}</dd>
            </div>
          </dl>
          <div className="form-actions">
            <button type="button" onClick={() => setIsEditing(true)} className="btn">
              Edit Profile
            </button>
            <button type="button" onClick={handleLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </>
      ) : (
        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="form-field">
              <span>First name</span>
              <input
                type="text"
                name="firstName"
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
              value={formData.email}
              onChange={handleChange}
              className="field"
              required
            />
          </label>

          <label className="form-field">
            <span>New password</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              className="field"
            />
            <small className="form-hint">Leave blank to keep your current password.</small>
          </label>

          <div className="form-actions">
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={handleCancel} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default Profile;
