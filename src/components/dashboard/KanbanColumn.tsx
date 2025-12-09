import { useState } from 'react';
import type { Email } from '@/types/email';
import { KanbanCard } from './KanbanCard';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import * as LucideIcons from 'lucide-react';
import { X } from 'lucide-react';

interface KanbanColumn {
  id: string;
  name: string;
  icon: string;
}

interface KanbanColumnProps {
  column: KanbanColumn;
  emails: Email[];
  selectedEmailId: string | null;
  draggedEmailId: string | null;
  onEmailSelect: (emailId: string) => void;
  onDragStart: (emailId: string) => void;
  onDragEnd: () => void;
  onDrop: (targetColumnId: string) => Promise<void>;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  onRemove?: (columnId: string) => void;
  canRemove?: boolean;
}

export function KanbanColumn({
  column,
  emails,
  selectedEmailId,
  draggedEmailId,
  onEmailSelect,
  onDragStart,
  onDragEnd,
  onDrop,
  hasMore,
  isLoading,
  onLoadMore,
  onRemove,
  canRemove = false,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    await onDrop(column.id);
  };

  // Get the icon component dynamically
  const IconComponent = (LucideIcons as any)[column.icon] || LucideIcons.Mail;

  return (
    <div
      className={cn(
        'flex flex-col flex-1 bg-muted/30 rounded-lg border transition-colors h-full max-w-1/3',
        isDragOver && 'border-primary bg-primary/5'
      )}
      style={{ minWidth: '320px'}}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 p-4 border-b bg-background/50 shrink-0">
        <IconComponent className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">{column.name}</h3>
        <span className="ml-auto text-sm text-muted-foreground">
          {emails.length}
        </span>
        {canRemove && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRemove(column.id)}
            title="Remove column"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        <div className="space-y-2">
          {emails.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              {isLoading ? 'Loading...' : 'No emails'}
            </div>
          ) : (
            <>
              {emails.map((email) => (
                <KanbanCard
                  key={email.id}
                  email={email}
                  isSelected={email.id === selectedEmailId}
                  isDragging={email.id === draggedEmailId}
                  onSelect={() => onEmailSelect(email.id)}
                  onDragStart={() => onDragStart(email.id)}
                  onDragEnd={onDragEnd}
                />
              ))}
              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={onLoadMore}
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
