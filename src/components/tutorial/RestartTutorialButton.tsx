
import React from 'react';
import { Button } from '@/components/ui/button';
import { useTutorial } from '@/contexts/TutorialContext';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';

const RestartTutorialButton: React.FC = () => {
  const { startTutorial } = useTutorial();
  const { user } = useAuth();
  const { translate } = useTranslation();

  const handleRestartTutorial = async () => {
    if (!user) return;

    try {
      // Update the database to mark tutorial as not completed
      const { error } = await supabase
        .from('profiles')
        .update({ 
          tutorial_completed: 'NO',
          tutorial_step: 0
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error restarting tutorial:', error);
        toast.error(await translate('Failed to restart tutorial.'));
        return;
      }

      startTutorial();
      toast.success(await translate('Tutorial restarted!'));
    } catch (error) {
      console.error('Error:', error);
      toast.error(await translate('Something went wrong.'));
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleRestartTutorial}
      className="w-full"
    >
      <TranslatableText text="Restart Tutorial" />
    </Button>
  );
};

export default RestartTutorialButton;
