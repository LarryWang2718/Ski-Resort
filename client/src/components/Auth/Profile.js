import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout, updateProfile } from '../../store/slices/authSlice';

function Profile() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });

  const [isEditing, setIsEditing] = useState(false);

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
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const updateData = { ...formData };
    if (!updateData.password) {
      delete updateData.password;
    }
    dispatch(updateProfile(updateData));
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
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 0' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2>Profile</h2>
          <button onClick={handleLogout} className="btn btn-secondary">
            Logout
          </button>
        </div>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {!isEditing ? (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>Name:</strong> {user?.firstName} {user?.lastName}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>Email:</strong> {user?.email}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>Role:</strong> {user?.role || 'user'}
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="btn"
              style={{ marginRight: '1rem' }}
            >
              Edit Profile
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="firstName" style={{ display: 'block', marginBottom: '0.5rem' }}>
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className="search-bar"
                required
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="lastName" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="search-bar"
                required
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="search-bar"
                required
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem' }}>
                New Password (leave blank to keep current)
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="search-bar"
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button
                type="submit"
                className="btn"
                style={{ marginRight: '1rem' }}
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Profile; 