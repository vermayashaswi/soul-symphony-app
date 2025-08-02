import React, { ReactElement, cloneElement } from 'react';
import { useInteractionTracking } from '@/hooks/useInteractionTracking';

interface InteractionTrackerProps {
  action?: string;
  category?: 'button' | 'link' | 'form' | 'voice' | 'nav' | 'search' | 'modal' | 'custom';
  label?: string;
  children: ReactElement;
  trackOnMount?: boolean;
}

/**
 * Wrapper component that automatically tracks interactions on child elements
 * Usage:
 * <InteractionTracker action="record_voice" category="voice">
 *   <Button>Start Recording</Button>
 * </InteractionTracker>
 */
export const InteractionTracker: React.FC<InteractionTrackerProps> = ({
  action,
  category = 'custom',
  label,
  children,
  trackOnMount = false,
}) => {
  const {
    trackButtonClick,
    trackLinkClick,
    trackFormSubmission,
    trackVoiceAction,
    trackNavigation,
    trackSearch,
    trackModalAction,
    trackCustomInteraction,
  } = useInteractionTracking();

  // Track on mount if requested
  React.useEffect(() => {
    if (trackOnMount && action) {
      trackCustomInteraction(`mount_${action}`);
    }
  }, [trackOnMount, action, trackCustomInteraction]);

  const handleInteraction = () => {
    if (!action) return;

    const actionWithLabel = label ? `${action}_${label}` : action;

    switch (category) {
      case 'button':
        trackButtonClick(actionWithLabel);
        break;
      case 'link':
        trackLinkClick(actionWithLabel);
        break;
      case 'form':
        trackFormSubmission(actionWithLabel);
        break;
      case 'voice':
        // Extract voice action from the action string
        const voiceActionMatch = action.match(/(start|stop|play|pause)/);
        if (voiceActionMatch) {
          trackVoiceAction(voiceActionMatch[1] as 'start' | 'stop' | 'play' | 'pause');
        } else {
          trackCustomInteraction(actionWithLabel);
        }
        break;
      case 'nav':
        trackNavigation(actionWithLabel);
        break;
      case 'search':
        trackSearch(actionWithLabel);
        break;
      case 'modal':
        // Extract modal action from the action string
        const modalActionMatch = action.match(/(open|close)/);
        if (modalActionMatch) {
          trackModalAction(modalActionMatch[1] as 'open' | 'close', label);
        } else {
          trackCustomInteraction(actionWithLabel);
        }
        break;
      default:
        trackCustomInteraction(actionWithLabel);
    }
  };

  // Clone the child element and add the interaction handler
  const childWithInteraction = cloneElement(children, {
    onClick: (event: React.MouseEvent) => {
      // Call the original onClick if it exists
      if (children.props.onClick) {
        children.props.onClick(event);
      }
      // Track the interaction
      handleInteraction();
    },
  });

  return childWithInteraction;
};