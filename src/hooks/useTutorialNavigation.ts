
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const useTutorialNavigation = () => {
  const navigate = useNavigate();
  const [navigationState, setNavigationState] = useState({
    inProgress: false,
    targetRoute: null as string | null
  });

  const navigateToRoute = (route: string) => {
    console.log(`[TutorialNavigation] Navigating to ${route}`);
    setNavigationState({
      inProgress: true,
      targetRoute: route
    });
    navigate(route);
  };

  const clearNavigation = () => {
    setNavigationState({
      inProgress: false,
      targetRoute: null
    });
  };

  return {
    navigationState,
    navigateToRoute,
    clearNavigation
  };
};
