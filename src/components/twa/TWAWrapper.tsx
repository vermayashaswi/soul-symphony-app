
import React from 'react';
import { useTWABackHandler } from '@/hooks/useTWABackHandler';
import ExitConfirmationModal from './ExitConfirmationModal';

interface TWAWrapperProps {
  children: React.ReactNode;
}

const TWAWrapper: React.FC<TWAWrapperProps> = ({ children }) => {
  const { showExitModal, confirmExit, cancelExit, isTWAEnvironment } = useTWABackHandler({
    onExitConfirmation: () => {
      console.log('[TWA] User attempted to exit app');
    },
    onBackIntercepted: () => {
      console.log('[TWA] Back navigation intercepted');
    }
  });

  // Only render the modal and handlers in TWA environment
  if (!isTWAEnvironment) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <ExitConfirmationModal
        isOpen={showExitModal}
        onConfirm={confirmExit}
        onCancel={cancelExit}
      />
    </>
  );
};

export default TWAWrapper;
