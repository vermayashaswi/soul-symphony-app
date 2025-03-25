
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Lock, Moon, Sun, Palette, Volume2, HelpCircle, Shield, Edit, Check as CheckIcon } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [aiVoiceFeedback, setAiVoiceFeedback] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [profileData, setProfileData] = useState<{
    fullName: string;
    email: string;
    avatarUrl: string;
  }>({
    fullName: '',
    email: '',
    avatarUrl: '',
  });
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [journalCount, setJournalCount] = useState(0);
  
  const { user } = useAuth();
  
  const colorThemes = [
    { name: 'Default', color: 'bg-primary' },
    { name: 'Calm', color: 'bg-blue-400' },
    { name: 'Soothing', color: 'bg-violet-400' },
    { name: 'Energy', color: 'bg-amber-400' },
    { name: 'Focus', color: 'bg-emerald-400' },
  ];
  
  const [selectedTheme, setSelectedTheme] = useState(colorThemes[0].name);
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      try {
        // Get journal count
        const { data: journalData, error: journalError } = await supabase
          .from('Journal Entries')
          .select('id')
          .eq('user_id', user.id);
          
        if (journalError) {
          console.error('Error fetching journal count:', journalError);
        } else {
          setJournalCount(journalData?.length || 0);
        }
        
        // Get user profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, email, avatar_url')
          .eq('id', user.id)
          .maybeSingle();
          
        if (profileError) {
          console.error('Error fetching profile data:', profileError);
          return;
        }
        
        // Use data from profile if available, otherwise fallback to user object
        setProfileData({
          fullName: profileData?.full_name || user.user_metadata?.full_name || 'User',
          email: profileData?.email || user.email || '',
          avatarUrl: profileData?.avatar_url || user.user_metadata?.avatar_url || '',
        });
      } catch (error) {
        console.error('Error in fetchUserProfile:', error);
      }
    };
    
    fetchUserProfile();
  }, [user]);
  
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    
    try {
      setIsUpdatingAvatar(true);
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      
      // Upload the file to storage
      const { error: uploadError } = await supabase.storage
        .from('profile_pictures')
        .upload(filePath, file);
        
      if (uploadError) {
        toast.error('Failed to upload profile picture');
        console.error('Error uploading avatar:', uploadError);
        return;
      }
      
      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('profile_pictures')
        .getPublicUrl(filePath);
        
      const avatarUrl = urlData.publicUrl;
      
      // Update the profile with the new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);
        
      if (updateError) {
        toast.error('Failed to update profile');
        console.error('Error updating profile:', updateError);
        return;
      }
      
      // Update local state
      setProfileData(prev => ({ ...prev, avatarUrl }));
      toast.success('Profile picture updated successfully');
    } catch (error) {
      console.error('Error in handleAvatarChange:', error);
      toast.error('An error occurred while updating profile picture');
    } finally {
      setIsUpdatingAvatar(false);
    }
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
            className="bg-white rounded-xl p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Your Profile</h2>
              <Button variant="outline" size="sm" className="rounded-full flex items-center gap-1.5">
                <Edit className="h-3.5 w-3.5" />
                <span>Edit</span>
              </Button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profileData.avatarUrl} />
                  <AvatarFallback>{profileData.fullName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <label className="absolute bottom-0 right-0 h-8 w-8 bg-primary text-white rounded-full flex items-center justify-center border-2 border-background cursor-pointer">
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleAvatarChange}
                    disabled={isUpdatingAvatar}
                  />
                  {isUpdatingAvatar ? (
                    <span className="animate-spin h-3 w-3 border-2 border-white rounded-full border-t-transparent" />
                  ) : (
                    <Edit className="h-4 w-4" />
                  )}
                </label>
              </div>
              
              <div className="flex-1 space-y-4 text-center sm:text-left">
                <div>
                  <h3 className="text-xl font-semibold">{profileData.fullName}</h3>
                  <p className="text-muted-foreground">{profileData.email}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary rounded-lg p-3">
                    <p className="text-muted-foreground text-sm">Journal Entries</p>
                    <p className="text-xl font-medium">{journalCount}</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-3">
                    <p className="text-muted-foreground text-sm">Current Streak</p>
                    <p className="text-xl font-medium">0 days</p>
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
            className="bg-white rounded-xl p-6 shadow-sm"
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
                      theme === 'light' ? "bg-white shadow-sm" : "hover:text-foreground text-muted-foreground"
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
                      theme === 'dark' ? "bg-white shadow-sm" : "hover:text-foreground text-muted-foreground"
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
                      theme === 'system' ? "bg-white shadow-sm" : "hover:text-foreground text-muted-foreground"
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
                        setSelectedTheme(themeOption.name);
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
                          selectedTheme === themeOption.name 
                            ? "border-foreground ring-2 ring-background ring-offset-2" 
                            : "border-muted"
                        )}
                      >
                        {selectedTheme === themeOption.name && (
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
            className="bg-white rounded-xl p-6 shadow-sm"
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
              
              <SettingItem
                icon={Volume2}
                title="AI Voice Feedback"
                description="Enable voice responses from your AI assistant"
              >
                <Switch 
                  checked={aiVoiceFeedback}
                  onCheckedChange={setAiVoiceFeedback}
                />
              </SettingItem>
              
              <SettingItem
                icon={Lock}
                title="Privacy Mode"
                description="Hide sensitive content when others might see your screen"
              >
                <Switch 
                  checked={privacyMode}
                  onCheckedChange={setPrivacyMode}
                />
              </SettingItem>
            </div>
          </motion.div>
          
          {/* Support Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="bg-white rounded-xl p-6 shadow-sm"
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
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
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

function Check(props: React.SVGProps<SVGSVGElement>) {
  return (
    <CheckIcon {...props} />
  );
}
