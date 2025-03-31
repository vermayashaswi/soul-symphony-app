
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Lock, Moon, Sun, Palette, HelpCircle, Shield, Mail, Check as CheckIcon } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import { useTheme } from '@/hooks/use-theme';
import { setupJournalReminder, initializeCapacitorNotifications } from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';

interface SettingItemProps {
  icon: React.ElementType;
  title: string;
  description: string;
  children?: React.ReactNode;
}

function SettingItem({ icon: Icon, title, description, children }: SettingItemProps) {
  return (
    <div className="flex items-start justify-between py-4">
      <div className="flex gap-3">
        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function Settings() {
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const { user } = useAuth();
  
  const colorThemes = [
    { name: 'Default', color: 'bg-primary' },
    { name: 'Calm', color: 'bg-blue-400' },
    { name: 'Soothing', color: 'bg-violet-400' },
    { name: 'Energy', color: 'bg-amber-400' },
    { name: 'Focus', color: 'bg-emerald-400' },
  ];

  useEffect(() => {
    if (notificationsEnabled) {
      setupJournalReminder(true).then(() => {
        // Show a mobile notification message
        if (typeof window !== 'undefined' && !('Notification' in window) || 
            (window.Notification && window.Notification.permission !== 'granted')) {
          initializeCapacitorNotifications();
        }
      });
    }
  }, [notificationsEnabled]);

  const handleContactSupport = () => {
    const subject = encodeURIComponent("Help me, I don't want to be SOuLO right now");
    const mailtoLink = `mailto:verma.yashaswi@gmail.com?subject=${subject}`;
    window.open(mailtoLink, '_blank');
  };
  
  return (
    <div className="min-h-screen pb-20">
      <Navbar />
      
      <div className="max-w-3xl mx-auto px-4 pt-28">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Personalize your Feelosophy experience</p>
        </div>
        
        <div className="space-y-6">
          {/* Profile Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-background rounded-xl p-6 shadow-sm border"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Your Profile</h2>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
              <ProfilePictureUpload />
              
              <div className="flex-1 space-y-4 text-center sm:text-left">
                <div>
                  <h3 className="text-xl font-semibold">{user?.user_metadata?.full_name || 'User'}</h3>
                  <p className="text-muted-foreground">{user?.email}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary rounded-lg p-3">
                    <p className="text-muted-foreground text-sm">Journal Entries</p>
                    <p className="text-xl font-medium">48</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-3">
                    <p className="text-muted-foreground text-sm">Current Streak</p>
                    <p className="text-xl font-medium">8 days</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          
          {/* Appearance Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-background rounded-xl p-6 shadow-sm border"
          >
            <h2 className="text-xl font-semibold mb-4">Appearance</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Theme Mode</label>
                <div className="flex p-1 bg-secondary rounded-full w-fit">
                  <button
                    onClick={() => {
                      setTheme('light');
                      toast.success('Light theme applied');
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all",
                      theme === 'light' ? "bg-background shadow-sm" : "hover:text-foreground text-muted-foreground"
                    )}
                  >
                    <Sun className="h-4 w-4" />
                    <span>Light</span>
                  </button>
                  <button
                    onClick={() => {
                      setTheme('dark');
                      toast.success('Dark theme applied');
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all",
                      theme === 'dark' ? "bg-background shadow-sm" : "hover:text-foreground text-muted-foreground"
                    )}
                  >
                    <Moon className="h-4 w-4" />
                    <span>Dark</span>
                  </button>
                  <button
                    onClick={() => {
                      setTheme('system');
                      toast.success('System theme applied');
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all",
                      theme === 'system' ? "bg-background shadow-sm" : "hover:text-foreground text-muted-foreground"
                    )}
                  >
                    <span>System</span>
                  </button>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Color Theme</label>
                <div className="flex flex-wrap gap-3">
                  {colorThemes.map((themeOption) => (
                    <button
                      key={themeOption.name}
                      onClick={() => {
                        setColorTheme(themeOption.name as any);
                        toast.success(`${themeOption.name} theme applied`);
                      }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 transition-all",
                      )}
                    >
                      <div
                        className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all",
                          themeOption.color,
                          colorTheme === themeOption.name 
                            ? "border-foreground ring-2 ring-background ring-offset-2" 
                            : "border-muted"
                        )}
                      >
                        {colorTheme === themeOption.name && (
                          <CheckIcon className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <span className="text-xs">{themeOption.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
          
          {/* Other Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-background rounded-xl p-6 shadow-sm border"
          >
            <h2 className="text-xl font-semibold mb-4">Preferences</h2>
            
            <div className="space-y-3 divide-y">
              <SettingItem
                icon={Bell}
                title="Notifications"
                description="Get reminders to journal and stay on track"
              >
                <Switch 
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                />
              </SettingItem>
            </div>
          </motion.div>
          
          {/* Support Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="bg-background rounded-xl p-6 shadow-sm border"
          >
            <h2 className="text-xl font-semibold mb-4">Help & Support</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button variant="outline" size="lg" className="h-auto py-6 rounded-xl justify-start">
                <div className="flex flex-col items-start text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <HelpCircle className="h-4 w-4" />
                    <span className="font-medium">FAQ</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Frequently asked questions</p>
                </div>
              </Button>
              
              <Button variant="outline" size="lg" className="h-auto py-6 rounded-xl justify-start">
                <div className="flex flex-col items-start text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4" />
                    <span className="font-medium">Privacy Policy</span>
                  </div>
                  <p className="text-xs text-muted-foreground">How we protect your data</p>
                </div>
              </Button>
            </div>
            
            <div className="mt-6 text-center">
              <Button variant="default" className="gap-2" onClick={handleContactSupport}>
                <Mail className="h-4 w-4" />
                Contact Support
              </Button>
            </div>
          </motion.div>
          
          <div className="py-4 text-center text-sm text-muted-foreground">
            <p>Feelosophy v1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
