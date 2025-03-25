
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';

export default function Settings() {
  const { user, session, refreshSession } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
      
      if (error) {
        console.error('Error loading user profile:', error);
        toast.error('Failed to load profile');
        throw error;
      }
      
      if (data) {
        setProfileData(data);
        setFullName(data.full_name || '');
        setEmail(data.email || '');
        setAvatarUrl(data.avatar_url || null);
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      
      const updates = {
        id: user?.id,
        full_name: fullName,
        email: email,
        updated_at: new Date().toISOString(),
      };
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user?.id);
      
      if (error) {
        toast.error('Failed to update profile');
        throw error;
      }
      
      toast.success('Profile updated successfully');
      
      // Refresh session to update user metadata if needed
      await refreshSession();
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }
      
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user?.id}/${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      setUploading(true);
      
      // Upload the file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('profile_pictures')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) {
        toast.error('Failed to upload avatar');
        throw uploadError;
      }
      
      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('profile_pictures')
        .getPublicUrl(filePath);
      
      // Update the user's profile with the new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user?.id);
      
      if (updateError) {
        toast.error('Failed to update avatar');
        throw updateError;
      }
      
      setAvatarUrl(publicUrl);
      toast.success('Avatar updated successfully');
      
      // Refresh session to update user metadata if needed
      await refreshSession();
    } catch (error) {
      console.error('Error uploading avatar:', error);
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="container px-4 md:px-6 max-w-4xl py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Profile Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarUrl || ''} />
                  <AvatarFallback>{getInitials(fullName || (user?.user_metadata?.full_name || 'User'))}</AvatarFallback>
                </Avatar>
                
                <div className="flex items-center space-x-2">
                  <Label htmlFor="avatar" className="cursor-pointer">
                    <div className="flex items-center space-x-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-md px-3 py-2 transition-colors">
                      <Upload className="h-4 w-4" />
                      <span>{uploading ? 'Uploading...' : 'Change Avatar'}</span>
                    </div>
                    <Input 
                      id="avatar" 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={uploading}
                    />
                  </Label>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    disabled
                  />
                  <p className="text-sm text-muted-foreground">Email cannot be changed</p>
                </div>
                
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={saving || loading}
                  className="w-full md:w-auto"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
