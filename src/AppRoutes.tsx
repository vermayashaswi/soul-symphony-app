
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';  // Assuming you have an Index page

const AppRoutes = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        {/* Add more routes as needed, preserving the existing route structure */}
      </Routes>
    </Router>
  );
};

export default AppRoutes;
