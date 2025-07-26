import React from 'react';
import { useCapacitorBackHandler } from '@/hooks/useCapacitorBackHandler';
import ExitConfirmationModal from '../shared/ExitConfirmationModal';

interface CapacitorWrapperProps {
  children: React.ReactNode;
}

const CapacitorWrapper: React.FC<CapacitorWrapperProps> = ({ children }) => {
  const { showExitModal, confirmExit, cancelExit, isNativeEnvironment } = useCapacitorBackHandler({
    onExitConfirmation: () => {
      console.log('[Capacitor] User attempted to exit app');
    },
    onBackIntercepted: () => {
      console.log('[Capacitor] Back navigation intercepted');
    }
  });

  // Only render the modal and handlers in native environment
  if (!isNativeEnvironment) {
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

export default CapacitorWrapper;