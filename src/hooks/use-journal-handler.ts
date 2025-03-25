
import { useNavigate } from 'react-router-dom';

export function useJournalHandler(userId: string | undefined) {
  const navigate = useNavigate();

  const handleCreateJournal = () => {
    // Navigate to the record page
    navigate('/record');
  };

  const handleViewInsights = () => {
    // Navigate to the insights page
    navigate('/insights');
  };

  // Add a simple implementation of processUnprocessedEntries to satisfy the interface
  // This is a no-op function now that embedding generation is automatic
  const processUnprocessedEntries = async () => {
    console.log('Processing unprocessed entries is now automatic, no manual action needed');
    return { success: true, processed: 0 };
  };

  return {
    handleCreateJournal,
    handleViewInsights,
    processUnprocessedEntries
  };
}
