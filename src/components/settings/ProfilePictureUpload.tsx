
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, Upload, Check, X, Move } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function ProfilePictureUpload() {
  const { user, updateUserProfile } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.user_metadata?.avatar_url || null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsEditing(true);
    
    return () => URL.revokeObjectURL(objectUrl);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setPreviewUrl(null);
    setSelectedFile(null);
    setPosition({ x: 0, y: 0 });
  };

  const saveAvatar = async () => {
    if (!selectedFile || !user?.id) {
      toast.error('No image selected');
      return;
    }

    try {
      // Upload file to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `avatars/${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('avatars')
        .upload(filePath, selectedFile, {
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Save position data with the URL
      const fullAvatarData = {
        url: publicUrl.publicUrl,
        position
      };
      
      // Update user metadata
      await updateUserProfile({ avatar_url: publicUrl.publicUrl, avatar_position: position });
      
      setAvatarUrl(publicUrl.publicUrl);
      setIsEditing(false);
      setPreviewUrl(null);
      setSelectedFile(null);
      
      toast.success('Profile picture updated');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(error.message || 'Error uploading avatar');
    }
  };

  return (
    <div className="flex flex-col items-center">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      
      <div className="relative">
        {isEditing ? (
          <div className="relative w-24 h-24 overflow-hidden rounded-full border-2 border-primary">
            <motion.div
              drag
              dragConstraints={{ left: -50, right: 50, top: -50, bottom: 50 }}
              dragElastic={0.1}
              className="absolute inset-0 cursor-move"
              style={{ x: position.x, y: position.y }}
              onDragEnd={(e, info) => {
                setPosition({
                  x: position.x + info.offset.x,
                  y: position.y + info.offset.y,
                });
              }}
            >
              {previewUrl && (
                <div className="absolute inset-0" style={{ 
                  backgroundImage: `url(${previewUrl})`,
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  width: '150%',
                  height: '150%',
                  left: '-25%',
                  top: '-25%',
                }} />
              )}
            </motion.div>
            <div className="absolute top-0 right-0 p-1 bg-background rounded-full">
              <Move className="h-4 w-4 text-primary" />
            </div>
          </div>
        ) : (
          <Avatar className="h-24 w-24">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="text-lg">
              {user?.email?.slice(0, 2).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        )}
        
        {!isEditing && (
          <button 
            onClick={triggerFileInput}
            className="absolute bottom-0 right-0 h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center border-2 border-background"
          >
            <Edit className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {isEditing && (
        <div className="flex space-x-2 mt-4">
          <Button 
            size="sm" 
            variant="outline"
            onClick={cancelEdit}
            className="flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </Button>
          <Button 
            size="sm"
            onClick={saveAvatar}
            className="flex items-center gap-1"
          >
            <Check className="h-4 w-4" />
            <span>Save</span>
          </Button>
        </div>
      )}
    </div>
  );
}
