
import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function ProfilePictureUpload() {
  const { user, updateUserProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Get the avatar URL from the user metadata or default to an empty string
  const avatarUrl = user?.user_metadata?.avatar_url || '';

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          // Create a canvas with max dimensions of 400x400 while maintaining aspect ratio
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Determine the target dimensions (max 400px while preserving aspect ratio)
          const maxDimension = 400;
          if (width > height && width > maxDimension) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else if (height > width && height > maxDimension) {
            width = (width / height) * maxDimension;
            height = maxDimension;
          } else if (width > maxDimension && height > maxDimension) {
            width = height = maxDimension;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw the image on the canvas with the new dimensions
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convert canvas to blob with quality 0.8 (80%)
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Canvas to Blob conversion failed'));
              return;
            }
            
            // Create a new file with the compressed blob
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            
            resolve(compressedFile);
          }, 'image/jpeg', 0.8);
        };
        img.onerror = () => {
          reject(new Error('Image loading failed'));
        };
      };
      reader.onerror = () => {
        reject(new Error('File reading failed'));
      };
    });
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      
      // Validate file type
      if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/)) {
        throw new Error('Only JPG, PNG, and WebP images are supported.');
      }
      
      // Compress the image before uploading
      const compressedFile = await compressImage(file);
      
      // Create a unique filename based on user ID and timestamp
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Upload the compressed file to the 'profile-pictures' bucket
      const { error: uploadError, data } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, compressedFile, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      // Update user metadata with the new avatar URL
      const success = await updateUserProfile({
        avatar_url: publicUrl,
      });

      if (success) {
        toast.success('Profile picture updated');
        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        toast.error('Failed to update profile');
      }
    } catch (error: any) {
      console.error('Error uploading avatar:', error.message);
      toast.error(`Error uploading avatar: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <Avatar className="h-24 w-24 mb-4 relative">
        <AvatarImage src={avatarUrl} />
        <AvatarFallback>
          {user?.email?.substring(0, 2).toUpperCase() || "U"}
        </AvatarFallback>
      </Avatar>
      
      <div className="relative">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-2"
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          Change Photo
          <input
            ref={fileInputRef}
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept="image/jpeg,image/png,image/webp"
            onChange={uploadAvatar}
            disabled={uploading}
          />
        </Button>
      </div>
    </div>
  );
}
