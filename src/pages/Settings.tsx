import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';

const Settings = () => {
  const { user, signOut, updateUserProfile } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user?.user_metadata?.full_name || '');
      setAvatarUrl(user?.user_metadata?.avatar_url || '');
    }
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Sign out failed:', error);
      toast.error('Sign out failed');
    }
  };

  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    try {
      await updateUserProfile({ full_name: fullName, avatar_url: avatarUrl });
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Profile update failed:', error);
      toast.error('Profile update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteAllEntries = async () => {
    setIsDeleting(true);
    
    try {
      const { error } = await supabase
        .from('Journal_Entries')
        .delete()
        .eq('user_id', user?.id || '');
        
      if (error) throw error;
      
      toast.success('All journal entries deleted successfully');
      setIsConfirmDialogOpen(false);
    } catch (error) {
      console.error('Error deleting entries:', error);
      toast.error('Failed to delete entries');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-semibold mb-6 text-center">Settings</h1>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your profile details here.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="avatar">Avatar URL</Label>
              <Input
                id="avatar"
                placeholder="Enter your avatar URL"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </div>
            <Button onClick={handleUpdateProfile} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  Updating <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                </>
              ) : (
                'Update Profile'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md mt-6">
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
            <CardDescription>Manage your account settings.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Button variant="destructive" onClick={handleSignOut}>
              Sign Out
            </Button>

            <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  Delete All Journal Entries
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all of your journal entries from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteAllEntries} disabled={isDeleting}>
                    {isDeleting ? (
                      <>
                        Deleting <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      </>
                    ) : (
                      'Delete All'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
