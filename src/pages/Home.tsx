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
import { ArrowRight, LoaderCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const Home = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colorTheme, theme } = useTheme();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [makeNullProcessing, setMakeNullProcessing] = useState(false);
  const [showMakeNullConfirm, setShowMakeNullConfirm] = useState(false);
  const today = new Date();
  const formattedDate = format(today, 'EEE, MMM d');
  const navigate = useNavigate();

  const [processing, setProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const preloadImage = new Image();
    preloadImage.src = '/lovable-uploads/3f275134-f471-4af9-a7cd-700ccd855fe3.png';
  }, []);

  useEffect(() => {
    console.log('Home component mounted');
    console.log('Current user:', user?.email);

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

  console.warn('DEVELOPER WARNING: Reprocess button is visible to all users. This should only be used for debugging!');

  const handleForceReprocess = async () => {
    setShowConfirm(false);
    setProcessing(true);
    
    toast.info("Processing started...", {
      description: "Journal entries are being reprocessed and entityemotion data cleaned.",
      duration: 4000,
    });

    try {
      const { data, error } = await supabase.functions.invoke('temporary', { 
        method: 'POST',
        body: { action: 'reprocess_all' }
      });
      
      setProcessing(false);
      if (error) {
        toast.error("Processing failed", {
          description: `Error: ${error.message}`,
          duration: 7000,
        });
      } else {
        toast.success("Reprocessing complete!", {
          description: `Updated: ${data?.updated ?? 0}, Failed: ${data?.failed ?? 0}`,
          duration: 7000,
        });
      }
    } catch (e) {
      setProcessing(false);
      toast.error("Processing failed", {
        description: e?.message || 'Unknown error',
        duration: 7000,
      });
    }
  };

  const handleMakeNullAll = async () => {
    setShowMakeNullConfirm(false);
    setMakeNullProcessing(true);

    toast.info("Nullifying started...", {
      description: "Setting entities and entityemotion to null for ALL journal entries.",
      duration: 4000,
    });

    try {
      const { data, error } = await supabase.functions.invoke('temporary', {
        method: 'POST',
        body: { action: 'make_null_all' },
      });

      setMakeNullProcessing(false);
      if (error) {
        toast.error("Nullifying failed", {
          description: `Error: ${error.message}`,
          duration: 7000,
        });
      } else {
        toast.success("All entries cleared!", {
          description: "All 'entities' and 'entityemotion' fields set to null.",
          duration: 7000,
        });
      }
    } catch (e) {
      setMakeNullProcessing(false);
      toast.error("Nullifying failed", {
        description: e?.message || 'Unknown error',
        duration: 7000,
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

      <div className="absolute top-6 right-6 z-40 flex gap-2 admin-button">
        <Button
          variant="destructive"
          className="shadow px-4 py-2 font-semibold flex items-center gap-2"
          onClick={() => setShowConfirm(true)}
          disabled={processing}
        >
          {processing ? (
            <>
              <LoaderCircle className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Reprocess All Entries
            </>
          )}
        </Button>
        <Button
          variant="outline"
          className="shadow px-4 py-2 font-semibold flex items-center gap-2"
          onClick={() => setShowMakeNullConfirm(true)}
          disabled={makeNullProcessing}
        >
          {makeNullProcessing ? (
            <>
              <LoaderCircle className="w-4 h-4 animate-spin" />
              Clearing...
            </>
          ) : (
            <>
              <span className="text-muted-foreground">Make Null</span>
            </>
          )}
        </Button>
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
        {showMakeNullConfirm && (
          <div className="fixed z-50 inset-0 bg-black/40 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 relative max-w-xs w-full">
              <h3 className="font-bold mb-2 text-lg text-primary">Make All Null?</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                This will set <b>entities</b> and <b>entityemotion</b> to <b>NULL</b> for <b>ALL</b> journal entries.
                <br />Are you sure you want to proceed?
              </p>
              <div className="flex gap-3">
                <Button variant="destructive" onClick={handleMakeNullAll} disabled={makeNullProcessing}>
                  Yes, make all null
                </Button>
                <Button variant="outline" onClick={() => setShowMakeNullConfirm(false)} disabled={makeNullProcessing}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

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
