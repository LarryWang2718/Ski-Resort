import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';

function Navbar() {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const [logoError, setLogoError] = React.useState(false);

  const navClass = ({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`;

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="logo">
          {logoError ? (
            <span className="logo-text">Ski Resort Finder</span>
          ) : (
            <img
              src={`${process.env.PUBLIC_URL}/logo.jpg`}
              alt="Ski Resort Finder"
              className="logo-image"
              onError={() => setLogoError(true)}
            />
          )}
        </Link>
        <ul className="nav-links">
          <li><NavLink to="/" end className={navClass}>Home</NavLink></li>
          <li><NavLink to="/resorts" className={navClass}>Resorts</NavLink></li>
          <li><NavLink to="/trails" className={navClass}>Trails</NavLink></li>
          <li><NavLink to="/lifts" className={navClass}>Lifts</NavLink></li>
          {isAuthenticated ? (
            <>
              <li><NavLink to="/profile" className={navClass}>Profile</NavLink></li>
              <li>
                <button type="button" className="nav-link nav-button" onClick={() => dispatch(logout())}>
                  Logout
                </button>
              </li>
            </>
          ) : (
            <>
              <li><NavLink to="/login" className={navClass}>Login</NavLink></li>
              <li><NavLink to="/register" className={navClass}>Register</NavLink></li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
