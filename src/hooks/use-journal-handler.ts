
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useJournalEntries } from './use-journal-entries';

export function useJournalHandler(userId: string | undefined) {
  const navigate = useNavigate();
  const [isProcessingEmbeddings, setIsProcessingEmbeddings] = useState(false);
  const { processAllEmbeddings } = useJournalEntries(userId);

  const handleCreateJournal = () => {
    // Navigate to the record tab or show the journal creation dialog
    // This is a placeholder - implement as needed
    // Could set an active tab state or show a modal
    console.log('Create journal entry');
  };

  const handleViewInsights = () => {
    // Navigate to the insights page
    navigate('/insights');
  };

  const handleProcessAllEmbeddings = async () => {
    setIsProcessingEmbeddings(true);
    try {
      await processAllEmbeddings();
    } catch (error) {
      console.error('Error processing embeddings:', error);
    } finally {
      setIsProcessingEmbeddings(false);
    }
  };

  return {
    handleCreateJournal,
    handleViewInsights,
    handleProcessAllEmbeddings,
    isProcessingEmbeddings
  };
}
