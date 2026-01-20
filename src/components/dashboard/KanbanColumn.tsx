import { useState, useEffect } from "react";
import type { Email } from "@/types/email";
import { KanbanCard } from "./KanbanCard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { EmailFilters, type EmailFilterOptions } from "./EmailFilters";

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
  onRename?: (columnId: string, newName: string) => Promise<void>;
  filters?: EmailFilterOptions;
  onFiltersChange?: (filters: EmailFilterOptions) => void;
  onFilterClear?: () => void;
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
  onRename,
  filters,
  onFiltersChange,
  onFilterClear,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(column.name);

  // Reset rename value when column name changes from props
  useEffect(() => {
    setRenameValue(column.name);
  }, [column.name]);

  const handleRenameSubmit = async () => {
    if (!onRename || !renameValue.trim() || renameValue === column.name) {
      setIsRenaming(false);
      return;
    }

    try {
      await onRename(column.id, renameValue.trim());
      setIsRenaming(false);
    } catch (error) {
      toast.error("Failed to rename column");
      console.error("Error renaming column:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setIsRenaming(false);
      setRenameValue(column.name);
    }
  };

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
  const isSnoozed = column.name === "SNOOZED";
  const canRename = onRename && !isSnoozed && canRemove;

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-background/60 backdrop-blur-sm transition-all duration-300 shadow-sm hover:shadow-md",
        "w-full md:w-[calc((100%-48px)/3)] shrink-0",
        "h-fit md:h-full",
        isDragOver && "border-primary ring-1 ring-primary/20 bg-primary/5",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/20 shrink-0 h-[64px]">
        <div
          className={cn(
            "p-2 rounded-lg bg-background shadow-sm border",
            isSnoozed ? "text-orange-500" : "text-primary",
          )}
        >
          <IconComponent className="h-4 w-4" />
        </div>

        {isRenaming ? (
          <div className="flex-1 mr-2">
            <input
              autoFocus
              className="w-full px-2 py-1 text-sm font-semibold bg-background border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleKeyDown}
            />
          </div>
        ) : (
          <h3
            className={cn(
              "font-semibold text-base flex-1 truncate text-foreground/90",
              canRename &&
                "cursor-pointer hover:text-primary transition-colors",
            )}
            onClick={() => {
              if (canRename) {
                setRenameValue(column.name);
                setIsRenaming(true);
              }
            }}
            title={canRename ? "Double click or click to rename" : column.name}
          >
            {column.name}
          </h3>
        )}

        <div className="flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-muted text-xs font-medium text-muted-foreground ml-1">
          {emails.length}
        </div>

        {/* Filters */}
        {filters && onFiltersChange && !isSnoozed && (
          <div className="mr-1">
            <EmailFilters
              filters={filters}
              onFiltersChange={onFiltersChange}
              onClear={onFilterClear}
              className="scale-90 origin-right"
              compact={true}
            />
          </div>
        )}

        {canRemove && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 ml-1 hover:bg-destructive/10 hover:text-destructive rounded-full"
            onClick={() => onRemove(column.id)}
            title="Remove column"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 md:overflow-y-auto overflow-y-visible p-3 space-y-3 min-h-0 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
        <div className="space-y-3">
          {emails.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              {isLoading ? "Loading..." : "No emails"}
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
                  {isLoading ? "Loading..." : "Load More"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
