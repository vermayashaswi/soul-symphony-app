import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ProfilePictureUpload from '@/components/settings/ProfilePictureUpload';

const Settings = () => {
  const { user, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [journalCount, setJournalCount] = useState(0);
  const [formChanged, setFormChanged] = useState(false);
  
  useEffect(() => {
    if (user?.id) {
      const fetchJournalCount = async () => {
        setIsLoading(true);
        try {
          const { count, error } = await supabase
            .from('Journal_Entries') // Updated table name reference
            .select('id', { count: 'exact' })
            .eq('user_id', user.id);
            
          if (error) throw error;
          setJournalCount(count || 0);
        } catch (error) {
          console.error('Error fetching journal count:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchJournalCount();
    }
  }, [user]);
  
  const profileFormSchema = z.object({
    fullName: z.string().min(2, {
      message: "Full name must be at least 2 characters.",
    }),
    email: z.string().email({
      message: "Please enter a valid email address.",
    }),
    isPublic: z.boolean().default(false),
  });
  
  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: user?.user_metadata?.full_name || "",
      email: user?.email || "",
      isPublic: false,
    },
    mode: "onChange",
  });
  
  const [profile, setProfile] = useState<{
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
    is_public: boolean | null;
  }>({
    full_name: null,
    email: null,
    avatar_url: null,
    is_public: null,
  });
  
  useEffect(() => {
    if (user?.id) {
      const fetchProfile = async () => {
        setIsLoading(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('full_name, email, avatar_url, is_public')
            .eq('id', user.id)
            .single();
            
          if (error) throw error;
          
          setProfile({
            full_name: data?.full_name || null,
            email: data?.email || null,
            avatar_url: data?.avatar_url || null,
            is_public: data?.is_public || null,
          });
          
          profileForm.reset({
            fullName: data?.full_name || "",
            email: data?.email || "",
            isPublic: data?.is_public || false,
          });
        } catch (error) {
          console.error('Error fetching profile:', error);
          toast.error('Failed to load profile information.');
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchProfile();
    }
  }, [user]);
  
  async function updateProfile(values: z.infer<typeof profileFormSchema>) {
    setIsLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: values.fullName,
        email: values.email,
        is_public: values.isPublic,
      }).eq('id', user!.id);
      
      if (error) throw error;
      
      // Update auth user metadata
      const { error: userError } = await supabase.auth.updateUser({
        data: {
          full_name: values.fullName,
        },
      });
      
      if (userError) throw userError;
      
      setProfile({
        ...profile,
        full_name: values.fullName,
        email: values.email,
        is_public: values.isPublic,
      });
      
      toast.success('Profile updated successfully!');
      setFormChanged(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile.');
    } finally {
      setIsLoading(false);
    }
  }
  
  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
      toast.success('Signed out successfully!');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAvatarUpload = async (avatarUrl: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({
        avatar_url: avatarUrl,
      }).eq('id', user!.id);
      
      if (error) throw error;
      
      setProfile({
        ...profile,
        avatar_url: avatarUrl,
      });
      
      toast.success('Avatar updated successfully!');
    } catch (error: any) {
      console.error('Error updating avatar:', error);
      toast.error(error.message || 'Failed to update avatar.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Account Settings</CardTitle>
            <CardDescription>
              Manage your account settings and preferences.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Tabs defaultValue="profile" className="w-full">
              <TabsList>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="preferences">Preferences</TabsTrigger>
              </TabsList>
              
              <TabsContent value="profile" className="space-y-4">
                <div className="grid gap-4">
                  <ProfilePictureUpload 
                    avatarUrl={profile.avatar_url}
                    onUploadComplete={handleAvatarUpload}
                    isLoading={isLoading}
                  />
                  
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(updateProfile)} className="space-y-4">
                      <FormField
                        control={profileForm.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="John Doe" 
                                {...field} 
                                onChange={(e) => {
                                  field.onChange(e);
                                  setFormChanged(true);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={profileForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="johndoe@example.com" 
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e);
                                  setFormChanged(true);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={profileForm.control}
                        name="isPublic"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Public Profile</FormLabel>
                              <FormDescription>
                                Make your profile public so others can find you.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch 
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  setFormChanged(true);
                                }}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <Button 
                        type="submit" 
                        disabled={isLoading || !formChanged}
                      >
                        {isLoading ? 'Updating...' : 'Update Profile'}
                      </Button>
                    </form>
                  </Form>
                </div>
              </TabsContent>
              
              <TabsContent value="security" className="space-y-4">
                <Card className="border-none shadow-none">
                  <CardHeader>
                    <CardTitle>Sign Out</CardTitle>
                    <CardDescription>
                      Sign out from your account.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="destructive" 
                      onClick={handleSignOut} 
                      disabled={isLoading}
                    >
                      {isLoading ? 'Signing Out...' : 'Sign Out'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="preferences" className="space-y-4">
                <Card className="border-none shadow-none">
                  <CardHeader>
                    <CardTitle>Journal Statistics</CardTitle>
                    <CardDescription>
                      View your journal statistics.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>
                      You have created <strong>{journalCount}</strong> journal entries.
                      {isLoading && ' (Loading...)'}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
