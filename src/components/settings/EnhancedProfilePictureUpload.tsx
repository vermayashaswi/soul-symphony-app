/**
 * Enhanced Profile Picture Upload component that integrates with the avatar manager
 */
import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from '@/lib/utils';

interface EnhancedProfilePictureUploadProps {
  onAvatarUpdate?: () => void;
  className?: string;
}

export function EnhancedProfilePictureUpload({ 
  onAvatarUpdate,
  className 
}: EnhancedProfilePictureUploadProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadError(null);
      
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('File size must be less than 5MB');
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setUploadError('Please select an image file');
        return;
      }

      const fileUrl = URL.createObjectURL(file);
      setSelectedImage(fileUrl);
      setShowEditor(true);
      setPosition({ x: 0, y: 0 });
      setZoom(1);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error selecting image';
      console.error('[EnhancedProfilePictureUpload] Error selecting image:', error);
      setUploadError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const uploadAvatar = async () => {
    if (!selectedImage || !user) return;

    setIsUploading(true);
    setUploadError(null);
    
    try {
      console.log('[EnhancedProfilePictureUpload] Starting avatar upload...');
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      const img = new Image();
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = selectedImage;
      });

      const size = 300;
      canvas.width = size;
      canvas.height = size;

      // Clear canvas and create circular clipping path
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
      ctx.clip();

      // Calculate draw parameters with zoom and position
      const scale = zoom;
      const drawSize = size * scale;
      const drawX = (size - drawSize) / 2 + position.x * scale;
      const drawY = (size - drawSize) / 2 + position.y * scale;

      // Draw the image
      ctx.drawImage(img, drawX, drawY, drawSize, drawSize);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create image blob'));
        }, 'image/png', 0.95);
      });

      const file = new File([blob], `avatar-${Date.now()}.png`, { type: 'image/png' });
      
      console.log('[EnhancedProfilePictureUpload] Uploading to storage...');
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(`${user.id}/${file.name}`, file, {
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path);

      console.log('[EnhancedProfilePictureUpload] New avatar URL:', publicUrl);

      // Update both user metadata and profiles table for consistency
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (metadataError) {
        console.warn('[EnhancedProfilePictureUpload] User metadata update failed:', metadataError);
      }

      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('[EnhancedProfilePictureUpload] Profile update failed:', profileError);
        throw new Error('Failed to update profile');
      }

      // Clean up
      setSelectedImage(null);
      setShowEditor(false);
      setUploadError(null);
      
      // Trigger avatar refresh in parent component
      onAvatarUpdate?.();
      
      toast.success('Profile picture updated successfully!');

    } catch (error) {
      console.error('[EnhancedProfilePictureUpload] Upload error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to upload profile picture';
      setUploadError(errorMsg);
      toast.error(`${errorMsg}. Please try again.`);
    } finally {
      setIsUploading(false);
    }
  };

  const cancelUpload = () => {
    setSelectedImage(null);
    setShowEditor(false);
    setUploadError(null);
  };

  // Mouse and touch handlers for image manipulation
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    
    const deltaX = e.clientX - startPosRef.current.x;
    const deltaY = e.clientY - startPosRef.current.y;
    
    setPosition(prev => ({
      x: prev.x + deltaX / zoom,
      y: prev.y + deltaY / zoom
    }));
    
    startPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className={cn("flex flex-col items-center space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="gap-2"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        Change Photo
      </Button>

      {uploadError && (
        <div className="text-xs text-destructive text-center">
          {uploadError}
        </div>
      )}

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile Picture</DialogTitle>
            <DialogDescription>
              Drag to reposition and use the slider to zoom your photo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedImage && (
              <div 
                ref={containerRef}
                className="relative w-64 h-64 mx-auto bg-muted rounded-full overflow-hidden cursor-move border-2 border-border"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  src={selectedImage}
                  alt="Selected avatar"
                  className="absolute inset-0 w-full h-full object-cover select-none"
                  style={{
                    transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`,
                    transformOrigin: 'center'
                  }}
                  draggable={false}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Zoom</label>
              <Slider
                value={[zoom]}
                onValueChange={(value) => setZoom(value[0])}
                min={0.5}
                max={3}
                step={0.1}
                className="w-full"
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={cancelUpload}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={uploadAvatar}
                disabled={isUploading}
                className="gap-2"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Save Photo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}