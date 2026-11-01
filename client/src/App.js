import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Resorts from './components/Resorts';
import Trails from './components/Trails';
import Lifts from './components/Lifts';
import ResortDetail from './components/ResortDetail';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Profile from './components/Auth/Profile';
import AssistantPage from './components/Assistant/AssistantPage';
import RequireAuth from './components/RequireAuth';
import ErrorBoundary from './components/ErrorBoundary';
import { EmptyNotice } from './components/Feedback';
import './App.css';

function NotFound() {
  return (
    <div className="page-shell">
      <EmptyNotice>
        That page doesn't exist. <Link to="/">Go to the home page</Link>
      </EmptyNotice>
    </div>
  );
}

function Layout() {
  const { pathname } = useLocation();

  return (
    // The mountain photo is only used on the home page
    <div
      className={`App app-shell${pathname === '/' ? ' app-shell--home' : ''}`}
      style={{ '--app-bg-image': `url(${process.env.PUBLIC_URL}/background.jpg)` }}
    >
      <Navbar />
      <main className="container">
        <ErrorBoundary resetKey={pathname}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/resorts" element={<Resorts />} />
            <Route path="/resorts/:id" element={<ResortDetail />} />
            <Route path="/trails" element={<Trails />} />
            <Route path="/lifts" element={<Lifts />} />
            <Route path="/assistant" element={<RequireAuth><AssistantPage /></RequireAuth>} />
            <Route path="/assistant/:conversationId" element={<RequireAuth><AssistantPage /></RequireAuth>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function App() {
  return (
    <Provider store={store}>
      <Router>
        <Layout />
      </Router>
    </Provider>
  );
}

export default App;
