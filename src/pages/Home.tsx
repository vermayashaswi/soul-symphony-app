
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useTheme } from '@/hooks/use-theme';
import { InspirationalQuote } from '@/components/quotes/InspirationalQuote';
import EnergyAnimation from '@/components/EnergyAnimation';
import JournalSummaryCard from '@/components/home/JournalSummaryCard';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

const Home = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colorTheme, theme } = useTheme();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const today = new Date();
  const formattedDate = format(today, 'EEE, MMM d');
  const navigate = useNavigate();

  // New state for reprocessing
  const [processing, setProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const preloadImage = new Image();
    preloadImage.src = '/lovable-uploads/3f275134-f471-4af9-a7cd-700ccd855fe3.png';
  }, []);

  useEffect(() => {
    console.log('Home component mounted');

    setRefreshKey(prev => prev + 1);

    const fetchUserProfile = async () => {
      if (user) {
        try {
          const localName = localStorage.getItem('user_display_name');

          const { data, error } = await supabase
            .from('profiles')
            .select('display_name, full_name')
            .eq('id', user.id)
            .single();

          if (error && error.code !== 'PGRST116') {
            console.error('Error fetching profile', error);
            return;
          }

          if (localName && (!data || !data.display_name)) {
            await updateDisplayName(localName);
            setDisplayName(localName);
            localStorage.removeItem('user_display_name');
          } else if (data && data.display_name) {
            setDisplayName(data.display_name);
          } else if (data && data.full_name) {
            setDisplayName(data.full_name);
          }
        } catch (error) {
          console.error('Error in profile fetching', error);
        }
      }
    };

    fetchUserProfile();
  }, [user]);

  const updateDisplayName = async (name: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: name,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error updating display name', error);
    }
  };

  const getJournalName = () => {
    if (displayName) {
      return displayName.endsWith('s') ? `${displayName}' Journal` : `${displayName}'s Journal`;
    }
    if (user?.email) {
      const name = user.email.split('@')[0];
      return name.endsWith('s') ? `${name}' Journal` : `${name}'s Journal`;
    }
    return 'Your Journal';
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  const dateStripVariants = {
    hidden: { x: 100, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const navigateToJournal = () => {
    try {
      navigate('/app/journal');
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  // --- ADMIN ONLY: Reprocess All Entries ---
  const isAdmin = user?.email === "admin@soulo.app";

  // Actual call to edge function
  const handleForceReprocess = async () => {
    setShowConfirm(false);
    setProcessing(true);
    const promise = supabase.functions.invoke('temporary', { method: 'POST' });

    toast({
      title: "Processing started...",
      description: "Journal entries are being reprocessed and entityemotion data cleaned.",
      duration: 4000,
      variant: "default"
    });

    try {
      const { data, error } = await promise;
      setProcessing(false);
      if (error) {
        toast({
          title: "Processing failed",
          description: `Error: ${error.message}`,
          duration: 7000,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Reprocessing complete!",
          description: `Updated: ${data?.updated ?? 0}, Failed: ${data?.failed ?? 0}`,
          duration: 7000,
          variant: "default"
        });
      }
    } catch (e: any) {
      setProcessing(false);
      toast({
        title: "Processing failed",
        description: e?.message || 'Unknown error',
        duration: 7000,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <div className="absolute inset-0 z-0">
        <EnergyAnimation fullScreen={true} bottomNavOffset={true} />
      </div>

      <div className="hidden">
        <img
          src="/lovable-uploads/3f275134-f471-4af9-a7cd-700ccd855fe3.png"
          alt="Preload Ruh's avatar"
          width="1"
          height="1"
        />
      </div>

      {/* --- ADMIN Button: Only visible to designated admin */}
      {isAdmin && (
        <div className="absolute top-6 right-6 z-40">
          <Button
            variant="outline"
            className="border border-destructive text-destructive shadow px-4 py-2 font-semibold"
            onClick={() => setShowConfirm(true)}
            disabled={processing}
          >
            {processing
              ? (
                <>
                  <span className="animate-spin mr-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  </span>
                  Processing...
                </>
              ) : 'Reprocess All Entries'}
          </Button>
          {/* Confirmation Dialog (simple custom) */}
          {showConfirm && (
            <div className="fixed z-50 inset-0 bg-black/40 flex items-center justify-center">
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 relative max-w-xs w-full">
                <h3 className="font-bold mb-2 text-lg text-destructive">Reprocess All Entries?</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Are you sure? This will overwrite <b>all entityemotion and entities</b> fields for <b>all</b> journal entries.
                </p>
                <div className="flex gap-3">
                  <Button variant="destructive" onClick={handleForceReprocess} disabled={processing}>
                    Yes, reprocess
                  </Button>
                  <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={processing}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="relative z-20 flex flex-col h-screen">
        <div className="p-4 flex flex-col">
          <div className="flex justify-between items-start w-full relative">
            <div className="relative">
              <h1
                className="text-2xl font-bold text-theme"
                style={{
                  fontWeight: 700,
                  letterSpacing: '0.005em',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale'
                }}
              >
                {getJournalName()}
              </h1>
            </div>

            <motion.div
              variants={dateStripVariants}
              initial="hidden"
              animate="visible"
              className={`px-3 py-1 rounded-l-md whitespace-nowrap ${theme === 'dark' ? 'bg-gray-800/80' : 'bg-gray-100/80'}`}
            >
              <div
                className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}
                style={{
                  fontWeight: 500,
                  letterSpacing: '0.01em',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale'
                }}
              >
                {formattedDate}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Arrow button with glowing effect - always visible for all users */}
      <div className="absolute top-[calc(50%-31px)] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40">
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/30 blur-md z-0"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.5, 0.8, 0.5]
          }}
          transition={{
            repeat: Infinity,
            duration: 2,
            ease: "easeInOut"
          }}
          style={{
            width: "calc(100% + 16px)",
            height: "calc(100% + 16px)",
            top: "-8px",
            left: "-8px"
          }}
        />
        <motion.button
          onClick={navigateToJournal}
          className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg relative z-20"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <ArrowRight className="text-primary-foreground h-6 w-6" />
        </motion.button>
      </div>

      <div className="flex-1 px-0 absolute inset-0 z-30">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="h-full w-full"
        >
          <motion.div
            variants={itemVariants}
            className="h-full w-full"
          >
            <div className="w-full h-full">
              <JournalSummaryCard />
            </div>
          </motion.div>
        </motion.div>
      </div>

      <div className="fixed inset-x-0 bottom-16 pb-5 z-25">
        <InspirationalQuote />
      </div>
    </div>
  );
};

export default Home;

