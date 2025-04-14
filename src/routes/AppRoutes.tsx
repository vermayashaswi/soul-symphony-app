
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Journal from '@/pages/Journal';
import Auth from '@/pages/Auth';
import ProtectedRoute from './ProtectedRoute';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/app/auth" element={<Auth />} />
      <Route path="/auth" element={<Auth />} />
      <Route 
        path="/app/journal" 
        element={
          <ProtectedRoute>
            <Journal />
          </ProtectedRoute>
        } 
      />
      <Route path="/app" element={<Navigate to="/app/journal" replace />} />
      <Route path="/" element={<Navigate to="/app" replace />} />
    </Routes>
  );
};

export default AppRoutes;
