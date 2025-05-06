
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProfilePictureUploadProps {
  userId?: string;
  currentImageUrl: string | null;
  onImageUploaded: (url: string) => void;
}

export const ProfilePictureUpload: React.FC<ProfilePictureUploadProps> = ({
  userId,
  currentImageUrl,
  onImageUploaded
}) => {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !userId) return;
    
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-profile-picture.${fileExt}`;
    const filePath = `profiles/${fileName}`;
    
    try {
      setUploading(true);
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
        
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);
        
      if (updateError) throw updateError;
      
      onImageUploaded(publicUrl);
      toast.success('Profile picture updated');
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {currentImageUrl && (
        <div className="rounded-full overflow-hidden border-2 border-primary h-24 w-24">
          <img 
            src={currentImageUrl} 
            alt="Profile" 
            className="h-full w-full object-cover"
          />
        </div>
      )}
      
      <div className="flex flex-col w-full">
        <input
          type="file"
          id="profile-picture"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button 
          asChild
          variant="outline"
          disabled={uploading || !userId}
        >
          <label htmlFor="profile-picture" className="cursor-pointer">
            {uploading ? 'Uploading...' : currentImageUrl ? 'Change Picture' : 'Upload Picture'}
          </label>
        </Button>
      </div>
    </div>
  );
};

// Export as default as well to support existing imports
export default ProfilePictureUpload;
