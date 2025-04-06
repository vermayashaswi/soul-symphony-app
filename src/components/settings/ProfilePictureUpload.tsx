
import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function ProfilePictureUpload() {
  const { user, updateUserProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const lastTouchDistance = useRef<number | null>(null);
  
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
      setZoom(1);
    } catch (error: any) {
      console.error('Error selecting image:', error.message);
      toast.error(`Error selecting image: ${error.message}`);
    }
  };

  const uploadAvatar = async () => {
    if (!selectedImage || !user?.id) return;
    
    try {
      setUploading(true);
      
      // Create a canvas to capture the transformed image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx || !imageRef.current || !containerRef.current) {
        throw new Error('Could not create canvas context');
      }
      
      // Set canvas dimensions to match the avatar size (circular crop)
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      canvas.width = containerWidth;
      canvas.height = containerHeight;
      
      // Create a circular clipping path
      ctx.beginPath();
      ctx.arc(containerWidth / 2, containerHeight / 2, containerWidth / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      
      // Draw the transformed image onto the canvas
      ctx.drawImage(
        imageRef.current,
        position.x,
        position.y,
        imageRef.current.width * zoom,
        imageRef.current.height * zoom
      );
      
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else throw new Error('Canvas to Blob conversion failed');
        }, 'image/jpeg', 0.95);
      });
      
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

  // Touch event handlers for image positioning
  useEffect(() => {
    const imageContainer = containerRef.current;
    if (!imageContainer || !showImageEditor) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        // Single touch - move the image
        startPosRef.current = {
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y
        };
      } else if (e.touches.length === 2) {
        // Two touches - pinch to zoom
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        lastTouchDistance.current = dist;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // Prevent scrolling when touching the image

      if (e.touches.length === 1) {
        // Single touch - move the image
        const newX = e.touches[0].clientX - startPosRef.current.x;
        const newY = e.touches[0].clientY - startPosRef.current.y;
        setPosition({ x: newX, y: newY });
      } else if (e.touches.length === 2 && lastTouchDistance.current !== null) {
        // Two touches - pinch to zoom
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        
        const delta = dist - lastTouchDistance.current;
        const newZoom = Math.max(0.5, Math.min(3, zoom + delta * 0.01));
        
        setZoom(newZoom);
        lastTouchDistance.current = dist;
      }
    };

    const handleTouchEnd = () => {
      lastTouchDistance.current = null;
    };

    // Mouse drag support for desktop
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      startX = e.clientX - position.x;
      startY = e.clientY - position.y;
      imageContainer.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - startX;
      const newY = e.clientY - startY;
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDragging = false;
      imageContainer.style.cursor = 'grab';
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * -0.01;
      const newZoom = Math.max(0.5, Math.min(3, zoom + delta));
      setZoom(newZoom);
    };

    imageContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
    imageContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    imageContainer.addEventListener('touchend', handleTouchEnd);
    
    imageContainer.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    imageContainer.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      imageContainer.removeEventListener('touchstart', handleTouchStart);
      imageContainer.removeEventListener('touchmove', handleTouchMove);
      imageContainer.removeEventListener('touchend', handleTouchEnd);
      
      imageContainer.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      imageContainer.removeEventListener('wheel', handleWheel);
    };
  }, [position, zoom, showImageEditor]);

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
              Pinch to zoom and drag to position your profile picture.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4 py-4">
            <div 
              ref={containerRef}
              className="relative h-64 w-64 rounded-full overflow-hidden border-2 border-muted cursor-grab touch-none"
              style={{ touchAction: 'none' }}
            >
              {selectedImage && (
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
                  <img
                    ref={imageRef}
                    src={selectedImage}
                    alt="Profile Preview"
                    className="transition-transform duration-100 ease-in-out pointer-events-none"
                    style={{
                      transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                      maxWidth: 'none',
                      maxHeight: 'none',
                      willChange: 'transform'
                    }}
                  />
                </div>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground text-center">
              <span className="block sm:inline">Use pinch gestures to zoom in/out.</span>{" "}
              <span className="block sm:inline">Drag to position the image.</span>
            </p>
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
