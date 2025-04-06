import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Lock, Moon, Sun, Palette, HelpCircle, Shield, Mail, Check as CheckIcon, LogOut, Monitor } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import { useTheme } from '@/hooks/use-theme';
import { setupJournalReminder, initializeCapacitorNotifications } from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import SouloLogo from '@/components/SouloLogo';
import { ColorPicker } from '@/components/settings/ColorPicker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
          <h3 className="font-medium text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function Settings() {
  const { theme, setTheme, colorTheme, setColorTheme, customColor, setCustomColor, systemTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const { user, signOut } = useAuth();
  const [streakDays, setStreakDays] = useState(0);
  const { entries } = useJournalEntries(user?.id, 0, !!user);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const [showFAQ, setShowFAQ] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  const colorThemes = [
    { name: 'Default', color: 'bg-blue-500' },
    { name: 'Calm', color: 'bg-violet-500' },
    { name: 'Soothing', color: 'bg-pink-200' },
    { name: 'Energy', color: 'bg-amber-400' },
    { name: 'Focus', color: 'bg-emerald-400' },
  ];

  useEffect(() => {
    const calculateStreak = async () => {
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from('Journal Entries')
            .select('created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
            
          if (error) {
            console.error("Error fetching entries for streak:", error);
            return;
          }
          
          if (!data || data.length === 0) {
            setStreakDays(0);
            return;
          }
          
          let streak = 1;
          let currentDate = new Date(data[0].created_at);
          
          for (let i = 1; i < data.length; i++) {
            const entryDate = new Date(data[i].created_at);
            
            const timeDiff = currentDate.getTime() - entryDate.getTime();
            const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
            
            if (daysDiff === 1) {
              streak++;
              currentDate = entryDate;
            } else if (daysDiff > 1) {
              break;
            } else if (daysDiff === 0) {
              currentDate = entryDate;
            }
          }
          
          setStreakDays(streak);
        } catch (error) {
          console.error("Error calculating streak:", error);
        }
      }
    };
    
    calculateStreak();
  }, [user, entries]);

  useEffect(() => {
    if (notificationsEnabled) {
      setupJournalReminder(true).then(() => {
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
  
  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out');
    }
  };
  
  const getThemeStyle = () => {
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();
    return { 
      color: themeColor, 
      borderColor: themeColor
    };
  };
  
  const getThemeBgStyle = () => {
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();
    return { 
      backgroundColor: `${themeColor}20` 
    };
  };

  return (
    <div className="min-h-screen pb-20">
      <Navbar />
      
      <div className={cn("max-w-3xl mx-auto px-4", isMobile ? "pt-0" : "pt-2")}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 text-theme-color">Settings</h1>
          <p className="text-muted-foreground">Personalize your Feelosophy experience</p>
        </div>
        
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-background rounded-xl p-6 shadow-sm border"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-theme-color">Your Profile</h2>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
              <ProfilePictureUpload />
              
              <div className="flex-1 space-y-4 text-center sm:text-left">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">{user?.user_metadata?.full_name || 'User'}</h3>
                  <p className="text-muted-foreground">{user?.email}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary rounded-lg p-3">
                    <p className="text-muted-foreground text-sm">Journal Entries</p>
                    <p className="text-xl font-medium text-foreground">{entries.length}</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-3">
                    <p className="text-muted-foreground text-sm">Current Streak</p>
                    <p className="text-xl font-medium text-foreground">{streakDays} days</p>
                  </div>
                </div>
                
                <Button variant="destructive" className="gap-2" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-background rounded-xl p-6 shadow-sm border"
          >
            <h2 className="text-xl font-semibold mb-4 text-theme-color">Appearance</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-foreground">Theme Mode</label>
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
                    <Monitor className="h-4 w-4 mr-1" />
                    <span>System {theme === 'system' && `(${systemTheme})`}</span>
                  </button>
                </div>
                {theme === 'system' && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Using your device's {systemTheme} theme preference
                  </p>
                )}
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block text-theme-color">Color Theme</label>
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
                      <span className={cn(
                        "text-xs",
                        colorTheme === themeOption.name 
                          ? "text-theme-color font-medium" 
                          : "text-foreground"
                      )}>
                        {themeOption.name}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-2"
                    onClick={() => setShowColorPicker(true)}
                  >
                    <Palette className="h-4 w-4" />
                    Customize Your Color
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-background rounded-xl p-6 shadow-sm border"
          >
            <h2 className="text-xl font-semibold mb-4 text-theme-color">Preferences</h2>
            
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
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="bg-background rounded-xl p-6 shadow-sm border"
          >
            <h2 className="text-xl font-semibold mb-4 text-theme-color">Help & Support</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                size="lg" 
                className="h-auto py-6 rounded-xl justify-start"
                onClick={() => setShowFAQ(true)}
              >
                <div className="flex flex-col items-start text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <HelpCircle className="h-4 w-4 text-theme-color" />
                    <span className="font-medium text-foreground">FAQ</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Frequently asked questions</p>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                size="lg" 
                className="h-auto py-6 rounded-xl justify-start"
                onClick={() => setShowPrivacyPolicy(true)}
              >
                <div className="flex flex-col items-start text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-theme-color" />
                    <span className="font-medium text-foreground">Privacy Policy</span>
                  </div>
                  <p className="text-xs text-muted-foreground">How we protect your data</p>
                </div>
              </Button>
            </div>
            
            <div className="mt-6 text-center">
              <Button 
                variant="default" 
                className="gap-2 bg-theme-color hover:bg-theme-color/90" 
                onClick={handleContactSupport}
              >
                <Mail className="h-4 w-4" />
                Contact Support
              </Button>
            </div>
          </motion.div>
          
          <div className="py-4 text-center text-sm text-muted-foreground">
            <p className="flex items-center justify-center gap-1">
              <SouloLogo size="small" useColorTheme={true} /> v1.0.0
            </p>
          </div>
        </div>
      </div>
      
      <Dialog open={showFAQ} onOpenChange={setShowFAQ}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl text-theme-color">Frequently Asked Questions</DialogTitle>
            <DialogDescription>
              Find answers to common questions about SOuLO
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6 py-2">
              <div className="space-y-2">
                <h3 className="text-base font-semibold">What is SOuLO?</h3>
                <p className="text-sm text-muted-foreground">
                  SOuLO is an AI-powered journaling app designed to help you track, analyze, and understand your emotions through voice recordings and text entries. Our app creates a safe space for self-reflection and personal growth.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">How do I create a journal entry?</h3>
                <p className="text-sm text-muted-foreground">
                  You can create a journal entry by navigating to the Journal tab and clicking on the "+" button. You can either type your entry or use the voice recording feature, which will automatically transcribe and analyze your spoken thoughts.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Is my data private?</h3>
                <p className="text-sm text-muted-foreground">
                  Yes, your privacy is our top priority. All journal entries are encrypted and only accessible to you. We do not share or sell your personal data with third parties. See our Privacy Policy for more details.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">How does the emotion analysis work?</h3>
                <p className="text-sm text-muted-foreground">
                  Our AI technology analyzes the text and tone of your journal entries to identify emotions and themes. It recognizes patterns in your writing or speech to provide insights about your emotional state and recurring topics.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Can I export my journal entries?</h3>
                <p className="text-sm text-muted-foreground">
                  Currently, we're working on an export feature. In the meantime, you can access all your entries through the Journal tab, where they're organized chronologically.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">What is a journal streak?</h3>
                <p className="text-sm text-muted-foreground">
                  A journal streak represents the number of consecutive days you've created at least one journal entry. It's a way to track your consistency and build a regular journaling habit.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">How do I set up daily reminders?</h3>
                <p className="text-sm text-muted-foreground">
                  You can enable daily reminders by toggling on the Notifications option in the Settings page. You'll need to grant notification permissions to the app for this feature to work.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Can I use SOuLO offline?</h3>
                <p className="text-sm text-muted-foreground">
                  Some features of SOuLO require an internet connection, especially voice recording and AI analysis. However, you can view your past entries and create text entries offline. They'll sync once you're back online.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">How do I delete my account?</h3>
                <p className="text-sm text-muted-foreground">
                  If you wish to delete your account, please contact our support team through the "Contact Support" button in the Settings page. We'll process your request and permanently delete all your data within 30 days.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Is SOuLO available on all devices?</h3>
                <p className="text-sm text-muted-foreground">
                  SOuLO is available as a web application that works on all modern browsers. We're currently developing native mobile applications for iOS and Android to provide an enhanced experience on mobile devices.
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showPrivacyPolicy} onOpenChange={setShowPrivacyPolicy}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl text-theme-color">Privacy Policy</DialogTitle>
            <DialogDescription>
              How we protect your data and respect your privacy
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6 py-2">
              <p className="text-sm text-muted-foreground">Last Updated: April 5, 2025</p>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Introduction</h3>
                <p className="text-sm text-muted-foreground">
                  Welcome to SOuLO ("we," "our," or "us"). We are committed to protecting your privacy and handling your data with transparency and care. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our journaling application.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Information We Collect</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>Account Information:</strong> When you create an account, we collect your email address, name, and password.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Journal Entries:</strong> We store the content of your journal entries, including text and voice recordings.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Usage Data:</strong> We collect information about how you interact with our application, such as features used, time spent, and actions taken.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Device Information:</strong> We collect information about your device, including IP address, browser type, and operating system.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">How We Use Your Information</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>Provide and Improve Services:</strong> We use your information to deliver our journaling features, analyze your entries, and generate insights.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Personalization:</strong> We personalize your experience based on your preferences and usage patterns.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Communication:</strong> We may send you notifications, updates, and support messages.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Research and Development:</strong> We use anonymized data to improve our AI algorithms and develop new features.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Data Security</h3>
                <p className="text-sm text-muted-foreground">
                  We implement appropriate technical and organizational measures to protect your personal information:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground ml-4 space-y-1">
                  <li>Encryption of sensitive data at rest and in transit</li>
                  <li>Regular security assessments and audits</li>
                  <li>Access controls and authentication mechanisms</li>
                  <li>Regular backups to prevent data loss</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Data Sharing</h3>
                <p className="text-sm text-muted-foreground">
                  We do not sell your personal information. We may share your information in the following limited circumstances:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground ml-4 space-y-1">
                  <li>With service providers who help us deliver our services</li>
                  <li>When required by law or government authorities</li>
                  <li>To protect our rights, property, or safety</li>
                  <li>In connection with a business transaction (e.g., merger or acquisition)</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Your Choices and Rights</h3>
                <p className="text-sm text-muted-foreground">
                  You have several rights regarding your personal information:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground ml-4 space-y-1">
                  <li>Access and download your data</li>
                  <li>Correct inaccurate information</li>
                  <li>Delete your account and associated data</li>
                  <li>Object to certain data processing activities</li>
                  <li>Opt out of marketing communications</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  To exercise these rights, please contact us using the information provided at the end of this policy.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Cookies and Tracking Technologies</h3>
                <p className="text-sm text-muted-foreground">
                  We use cookies and similar technologies to improve your experience, understand usage patterns, and deliver personalized content. You can manage your cookie preferences through your browser settings.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Children's Privacy</h3>
                <p className="text-sm text-muted-foreground">
                  Our service is not intended for individuals under the age of 13. We do not knowingly collect personal information from children. If we discover that we have collected personal information from a child, we will delete it promptly.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Changes to This Policy</h3>
                <p className="text-sm text-muted-foreground">
                  We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the updated policy on our website or through the application.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Contact Us</h3>
                <p className="text-sm text-muted-foreground">
                  If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
                </p>
                <p className="text-sm text-muted-foreground">
                  Email: verma.yashaswi@gmail.com
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showColorPicker} onOpenChange={setShowColorPicker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-theme-color">Customize Your Color</DialogTitle>
            <DialogDescription>
              Select a custom color for your app theme
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <ColorPicker
              value={customColor}
              onChange={(color) => {
                setCustomColor(color);
                setColorTheme('Custom');
              }}
            />
          </div>
          
          <div className="flex justify-end mt-2">
            <Button 
              onClick={() => {
                setShowColorPicker(false);
                toast.success('Custom color applied');
              }}
              className="bg-theme-color hover:bg-theme-color/90"
            >
              Apply Color
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
