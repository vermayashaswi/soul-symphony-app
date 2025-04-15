
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { WebsiteRouteWrapper } from './RouteHelpers';
import HomePage from '@/pages/website/HomePage';
import BlogPage from '@/pages/website/BlogPage';
import BlogPostPage from '@/pages/website/BlogPostPage';
import FAQPage from '@/pages/website/FAQPage';
import PrivacyPolicyPage from '@/pages/legal/PrivacyPolicyPage';
import AppDownloadPage from '@/pages/AppDownloadPage';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';

const WebsiteRoutes = () => {
  console.log('Rendering WebsiteRoutes');
  
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-grow">
        <Routes>
          {/* Main website routes */}
          <Route 
            path="/" 
            element={
              <WebsiteRouteWrapper element={<HomePage />} />
            } 
          />
          
          <Route 
            path="/blog" 
            element={
              <WebsiteRouteWrapper element={<BlogPage />} />
            } 
          />
          
          <Route 
            path="/blog/:slug" 
            element={
              <WebsiteRouteWrapper element={<BlogPostPage />} />
            } 
          />
          
          <Route 
            path="/faq" 
            element={
              <WebsiteRouteWrapper element={<FAQPage />} />
            } 
          />
          
          <Route 
            path="/privacy-policy" 
            element={
              <WebsiteRouteWrapper element={<PrivacyPolicyPage />} />
            } 
          />
          
          <Route 
            path="/app-download" 
            element={
              <WebsiteRouteWrapper element={<AppDownloadPage />} />
            } 
          />
          
          {/* Redirect app paths to /app prefix */}
          <Route path="/auth" element={<Navigate to="/app/auth" replace />} />
          <Route path="/onboarding" element={<Navigate to="/app/onboarding" replace />} />
          
          {/* Catch all redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
};

export default WebsiteRoutes;
