import { Button } from '@/components/ui/button';
import { Plus, BookOpen, Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OnboardingMessageProps {
  onCreateJournal?: () => void;
}

export const OnboardingMessage = ({ onCreateJournal }: OnboardingMessageProps) => {
  const navigate = useNavigate();

  const handleCreateJournal = () => {
    if (onCreateJournal) {
      onCreateJournal();
    } else {
      navigate('/app/journal/new');
    }
  };

  const handleViewJournal = () => {
    navigate('/app/journal');
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-6 p-8 text-center">
      <div className="rounded-full bg-primary/10 p-6">
        <BookOpen className="h-12 w-12 text-primary" />
      </div>
      
      <div className="max-w-md space-y-3">
        <h3 className="text-lg font-semibold text-foreground">
          Welcome to Your Personal AI Journal Assistant! 🌟
        </h3>
        <p className="text-sm text-muted-foreground">
          I'd love to help you explore insights from your journal, but I notice you haven't created any journal entries yet.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Button
          onClick={handleCreateJournal}
          className="w-full"
          size="lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Your First Entry
        </Button>
        
        <Button
          onClick={handleViewJournal}
          variant="outline"
          className="w-full"
          size="lg"
        >
          <Mic className="h-4 w-4 mr-2" />
          Go to Journal
        </Button>
      </div>

      <div className="max-w-md space-y-2 text-xs text-muted-foreground">
        <p className="font-medium">💡 Quick Tips:</p>
        <ul className="space-y-1 text-left">
          <li>• Share your thoughts, feelings, or daily experiences</li>
          <li>• Try voice recording for a more natural approach</li>
          <li>• Once you have entries, I'll provide personalized insights!</li>
        </ul>
      </div>
    </div>
  );
};