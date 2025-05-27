
import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Upload, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { TranslatableText } from '@/components/translation/TranslatableText';

export function ProfilePictureUpload() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // In a real implementation, you would upload the file to storage
      // and update the user's profile picture URL
      console.log('Uploading file:', file.name);
      
      // Mock upload delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Show success message or update UI
    } catch (error) {
      console.error('Error uploading profile picture:', error);
    } finally {
      setUploading(false);
    }
  };

  const getInitials = () => {
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="flex items-center space-x-4">
      <Avatar className="h-20 w-20">
        <AvatarImage src={undefined} alt="Profile picture" />
        <AvatarFallback className="text-lg bg-gradient-to-br from-purple-500 to-blue-500 text-white">
          {getInitials()}
        </AvatarFallback>
      </Avatar>
      
      <div className="space-y-2">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => document.getElementById('profile-picture-input')?.click()}
          >
            {uploading ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-spin" />
                <TranslatableText text="Uploading..." />
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                <TranslatableText text="Change" />
              </>
            )}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground">
          <TranslatableText text="PNG, JPG up to 2MB" />
        </p>
        
        <input
          id="profile-picture-input"
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}

export default ProfilePictureUpload;
