
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Bell, 
  Shield,
  Download,
  Trash2,
  Save,
  Loader2,
  Crown
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import LanguageSelector from '@/components/LanguageSelector';
import { SubscriptionPaywall } from '@/components/subscription/SubscriptionPaywall';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { displayName, timezone, updateDisplayName, updateTimezone } = useUserProfile();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    displayName: '',
    timezone: '',
    notifications: true,
    emailUpdates: false,
    dataExport: false
  });
  const [saving, setSaving] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  useEffect(() => {
    if (displayName || timezone) {
      setFormData(prev => ({
        ...prev,
        displayName: displayName || '',
        timezone: timezone || ''
      }));
    }
  }, [displayName, timezone]);

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      if (formData.displayName !== displayName) {
        await updateDisplayName(formData.displayName);
      }
      
      if (formData.timezone !== timezone) {
        await updateTimezone(formData.timezone);
      }
      
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (showSubscriptionModal) {
    return (
      <SubscriptionPaywall
        onSuccess={() => setShowSubscriptionModal(false)}
        onClose={() => setShowSubscriptionModal(false)}
        showTrialOption={true}
      />
    );
  }

  return (
    <div className="min-h-screen pb-20 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">
            <TranslatableText text="Settings" />
          </h1>
          <p className="text-muted-foreground">
            <TranslatableText text="Manage your account preferences and subscription" />
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">
                <TranslatableText text="Profile" />
              </span>
            </TabsTrigger>
            <TabsTrigger value="subscription" className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              <span className="hidden sm:inline">
                <TranslatableText text="Premium" />
              </span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">
                <TranslatableText text="Preferences" />
              </span>
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">
                <TranslatableText text="Privacy" />
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    <TranslatableText text="Profile Information" />
                  </CardTitle>
                  <CardDescription>
                    <TranslatableText text="Update your personal information and preferences" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Profile Picture */}
                  <div>
                    <Label className="text-base font-medium">
                      <TranslatableText text="Profile Picture" />
                    </Label>
                    <div className="mt-2">
                      <ProfilePictureUpload />
                    </div>
                  </div>

                  <Separator />

                  {/* Email (Read-only) */}
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      <TranslatableText text="Email Address" />
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-sm text-muted-foreground">
                      <TranslatableText text="Email address cannot be changed" />
                    </p>
                  </div>

                  {/* Display Name */}
                  <div className="space-y-2">
                    <Label htmlFor="displayName">
                      <TranslatableText text="Display Name" />
                    </Label>
                    <Input
                      id="displayName"
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="Your display name"
                    />
                  </div>

                  {/* Timezone */}
                  <div className="space-y-2">
                    <Label htmlFor="timezone">
                      <TranslatableText text="Timezone" />
                    </Label>
                    <Input
                      id="timezone"
                      type="text"
                      value={formData.timezone}
                      onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                      placeholder="Your timezone"
                    />
                  </div>

                  {/* Language */}
                  <div className="space-y-2">
                    <Label>
                      <TranslatableText text="Language" />
                    </Label>
                    <LanguageSelector />
                  </div>

                  <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    <TranslatableText text="Save Changes" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-500" />
                    <TranslatableText text="Premium Subscription" />
                  </CardTitle>
                  <CardDescription>
                    <TranslatableText text="Manage your subscription and unlock premium features" />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => setShowSubscriptionModal(true)}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    <TranslatableText text="Manage Subscription" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    <TranslatableText text="Notifications" />
                  </CardTitle>
                  <CardDescription>
                    <TranslatableText text="Manage your notification preferences" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">
                        <TranslatableText text="Push Notifications" />
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        <TranslatableText text="Receive reminders and updates" />
                      </p>
                    </div>
                    <Switch
                      checked={formData.notifications}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, notifications: checked }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">
                        <TranslatableText text="Email Updates" />
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        <TranslatableText text="Get insights and tips via email" />
                      </p>
                    </div>
                    <Switch
                      checked={formData.emailUpdates}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, emailUpdates: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    <TranslatableText text="Privacy & Data" />
                  </CardTitle>
                  <CardDescription>
                    <TranslatableText text="Manage your data and privacy settings" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" className="w-full justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    <TranslatableText text="Export My Data" />
                  </Button>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium text-destructive">
                      <TranslatableText text="Danger Zone" />
                    </h4>
                    
                    <Button
                      variant="outline"
                      className="w-full justify-start border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      <TranslatableText text="Delete Account" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={handleSignOut}
                      className="w-full justify-start"
                    >
                      <TranslatableText text="Sign Out" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
