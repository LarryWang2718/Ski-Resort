import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import './App.css';

function App() {
  return (
    <Provider store={store}>
      <Router>
        <div className="App">
          <Navbar />
          <div className="container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/resorts" element={<Resorts />} />
              <Route path="/resorts/:id" element={<ResortDetail />} />
              <Route path="/trails" element={<Trails />} />
              <Route path="/lifts" element={<Lifts />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </div>
        </div>
      </Router>
    </Provider>
  );
}

export default App; 