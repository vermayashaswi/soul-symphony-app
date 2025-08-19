import React from 'react';
import { Button } from '@/components/ui/button';
import { Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  onEdit: () => void;
  onClose: () => void;
}

export const EditContextMenu: React.FC<EditContextMenuProps> = ({
  isVisible,
  position,
  onEdit,
  onClose
}) => {
  if (!isVisible) return null;

  const handleEdit = () => {
    onEdit();
    onClose();
  };

  return (
    <>
      {/* Backdrop to close menu */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
        onTouchStart={onClose}
      />
      
      {/* Context menu */}
      <div
        className={cn(
          "fixed z-50 bg-popover border rounded-md shadow-lg p-1",
          "animate-in fade-in-0 zoom-in-95 duration-100"
        )}
        style={{
          left: `${Math.min(position.x, window.innerWidth - 80)}px`,
          top: `${Math.max(position.y - 40, 10)}px`,
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleEdit}
          className="w-full justify-start gap-2 h-8"
        >
          <Edit3 className="h-3 w-3" />
          Edit
        </Button>
      </div>
    </>
  );
};