
import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, X, MoveHorizontal, MoveVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

export function ProfilePictureUpload() {
  const { user, updateUserProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState([1]);
  const imageRef = useRef<HTMLImageElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Get the avatar URL from the user metadata or default to an empty string
  const avatarUrl = user?.user_metadata?.avatar_url || '';

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      const fileUrl = URL.createObjectURL(file);
      setSelectedImage(fileUrl);
      setShowImageEditor(true);
      // Reset position and zoom for new image
      setPosition({ x: 0, y: 0 });
      setZoom([1]);
    } catch (error: any) {
      console.error('Error selecting image:', error.message);
      toast.error(`Error selecting image: ${error.message}`);
    }
  };

  const uploadAvatar = async () => {
    if (!selectedImage || !user?.id) return;
    
    try {
      setUploading(true);
      
      // Convert the data URL to a blob
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      
      // Create a File object
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      
      const fileExt = 'jpg';
      const fileName = `${user.id}/${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update user metadata with the new avatar URL
      const success = await updateUserProfile({
        avatar_url: publicUrl,
      });

      if (success) {
        toast.success('Profile picture updated');
        setShowImageEditor(false);
        // Release the object URL to free memory
        URL.revokeObjectURL(selectedImage);
        setSelectedImage(null);
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

  const cancelUpload = () => {
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
    }
    setSelectedImage(null);
    setShowImageEditor(false);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handlePositionChange = (direction: 'x' | 'y', value: number) => {
    setPosition(prev => ({
      ...prev,
      [direction]: value
    }));
  };

  const handleZoomChange = (values: number[]) => {
    setZoom(values);
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
          <Input
            ref={inputRef}
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept="image/*"
            onChange={handleImageSelect}
            disabled={uploading}
          />
        </Button>
      </div>

      <Dialog open={showImageEditor} onOpenChange={setShowImageEditor}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Your Profile Picture</DialogTitle>
            <DialogDescription>
              Adjust the position and zoom of your profile picture before saving.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="relative h-64 w-64 rounded-full overflow-hidden border-2 border-muted">
              {selectedImage && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <img
                    ref={imageRef}
                    src={selectedImage}
                    alt="Profile Preview"
                    className="transition-all duration-200 ease-in-out"
                    style={{
                      transform: `translate(${position.x}px, ${position.y}px) scale(${zoom[0]})`,
                      maxWidth: 'none',
                      maxHeight: 'none',
                    }}
                  />
                </div>
              )}
            </div>
            
            <div className="w-full space-y-3">
              <div className="flex items-center space-x-2">
                <MoveHorizontal className="h-4 w-4 text-muted-foreground" />
                <Slider
                  value={[position.x]}
                  min={-100}
                  max={100}
                  step={1}
                  onValueChange={(values) => handlePositionChange('x', values[0])}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <MoveVertical className="h-4 w-4 text-muted-foreground" />
                <Slider
                  value={[position.y]}
                  min={-100}
                  max={100}
                  step={1}
                  onValueChange={(values) => handlePositionChange('y', values[0])}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Zoom</span>
                <Slider
                  value={zoom}
                  min={0.5}
                  max={2}
                  step={0.01}
                  onValueChange={handleZoomChange}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-between">
            <Button variant="outline" onClick={cancelUpload} type="button">
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={uploadAvatar} disabled={uploading} type="button">
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              Save Photo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
