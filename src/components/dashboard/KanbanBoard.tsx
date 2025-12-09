import { useState, useEffect } from 'react';
import type { Email, Mailbox } from '@/types/email';
import { KanbanColumn } from './KanbanColumn';
import { emailService } from '@/services/emailService';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface KanbanColumn {
  id: string;
  name: string;
  icon: string;
}

interface KanbanBoardProps {
  mailboxes: Mailbox[];
  selectedEmailId: string | null;
  onEmailSelect: (emailId: string) => void;
  onEmailMove: (emailId: string, targetMailboxId: string, sourceMailboxId: string) => Promise<void>;
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'INBOX', name: 'Inbox', icon: 'Inbox' }
];

export function KanbanBoard({
  mailboxes,
  selectedEmailId,
  onEmailSelect,
  onEmailMove,
}: KanbanBoardProps) {
  const [draggedEmailId, setDraggedEmailId] = useState<string | null>(null);
  const [draggedSourceColumn, setDraggedSourceColumn] = useState<string | null>(null);
  const [columns, setColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
  const [columnEmails, setColumnEmails] = useState<Record<string, Email[]>>({});
  const [columnPages, setColumnPages] = useState<Record<string, { pageToken?: string; hasMore: boolean }>>({});
  const [loadingColumns, setLoadingColumns] = useState<Set<string>>(new Set());
  const [columnToDelete, setColumnToDelete] = useState<{ id: string; name: string } | null>(null);

  // Initialize columns from mailboxes
  useEffect(() => {
    const customLabels = mailboxes
      .filter(m => m.type === 'user' && !['INBOX'].includes(m.id))
      .map(m => ({ id: m.id, name: m.name, icon: m.icon }));
    
    setColumns([...DEFAULT_COLUMNS, ...customLabels]);
  }, [mailboxes]);

  // Load emails for each column
  useEffect(() => {
    loadAllColumns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]);

  const loadAllColumns = async () => {
    for (const column of columns) {
      await loadColumnEmails(column.id, true);
    }
  };

  const loadColumnEmails = async (columnId: string, reset: boolean = false) => {
    if (loadingColumns.has(columnId)) return;

    setLoadingColumns(prev => new Set([...prev, columnId]));

    try {
      const pageToken = reset ? undefined : columnPages[columnId]?.pageToken;
      const response = await emailService.getEmailsByMailbox(columnId, 5, pageToken);
      
      // Hiển thị thông tin thread cơ bản ngay lập tức
      setColumnEmails(prev => ({
        ...prev,
        [columnId]: reset ? response.emails : [...(prev[columnId] || []), ...response.emails]
      }));

      // Fetch chi tiết từng email và update progressively
      response.emails.forEach(async (email) => {
        try {
          const fullEmail = await emailService.getEmailById(email.threadId);
          if (fullEmail) {
            setColumnEmails(prev => {
              const currentEmails = prev[columnId] || [];
              const emailIndex = currentEmails.findIndex(e => e.threadId === email.threadId);
              if (emailIndex !== -1) {
                // Update existing email with full details
                const updated = [...currentEmails];
                updated[emailIndex] = fullEmail;
                return {
                  ...prev,
                  [columnId]: updated
                };
              }
              return prev;
            });
          }
        } catch (error) {
          console.error(`Failed to fetch email detail for thread ${email.threadId}:`, error);
        }
      });

      setColumnPages(prev => ({
        ...prev,
        [columnId]: {
          pageToken: response.nextPageToken,
          hasMore: !!response.nextPageToken
        }
      }));
    } catch (error) {
      console.error(`Failed to load emails for ${columnId}:`, error);
    } finally {
      setLoadingColumns(prev => {
        const next = new Set(prev);
        next.delete(columnId);
        return next;
      });
    }
  };

  const handleDragStart = (emailId: string, sourceColumnId: string) => {
    setDraggedEmailId(emailId);
    setDraggedSourceColumn(sourceColumnId);
  };

  const handleDragEnd = () => {
    setDraggedEmailId(null);
    setDraggedSourceColumn(null);
  };

  const handleDrop = async (targetColumnId: string) => {
    if (!draggedEmailId || !draggedSourceColumn) return;
    if (draggedSourceColumn === targetColumnId) {
      setDraggedEmailId(null);
      setDraggedSourceColumn(null);
      return;
    }
    
    try {
      await onEmailMove(draggedEmailId, targetColumnId, draggedSourceColumn);
      // Refresh both columns
      await loadColumnEmails(draggedSourceColumn, true);
      await loadColumnEmails(targetColumnId, true);
    } catch (error) {
      console.error('Failed to move email:', error);
    } finally {
      setDraggedEmailId(null);
      setDraggedSourceColumn(null);
    }
  };

  const handleRemoveColumn = async (columnId: string) => {
    // Prevent removing default columns
    if (['INBOX'].includes(columnId)) {
      toast.error('Cannot remove default columns');
      return;
    }

    const column = columns.find(col => col.id === columnId);
    if (column) {
      setColumnToDelete({ id: column.id, name: column.name });
    }
  };

  const confirmRemoveColumn = async () => {
    if (!columnToDelete) return;

    try {
      await emailService.deleteLabel(columnToDelete.id);
      toast.success('Column removed successfully');
      
      // Remove column from state
      setColumns(prev => prev.filter(col => col.id !== columnToDelete.id));
      
      // Clear emails for this column
      setColumnEmails(prev => {
        const updated = { ...prev };
        delete updated[columnToDelete.id];
        return updated;
      });
    } catch (error) {
      console.error('Failed to remove column:', error);
      toast.error('Failed to remove column');
    } finally {
      setColumnToDelete(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-4 p-4" style={{ minWidth: '100%' }}>
          {columns.map((column) => {
            const isDefaultColumn = ['INBOX', 'TODO', 'DONE'].includes(column.id);
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                emails={columnEmails[column.id] || []}
                selectedEmailId={selectedEmailId}
                draggedEmailId={draggedEmailId}
                onEmailSelect={onEmailSelect}
                onDragStart={(emailId) => handleDragStart(emailId, column.id)}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
                hasMore={columnPages[column.id]?.hasMore || false}
                isLoading={loadingColumns.has(column.id)}
                onLoadMore={() => loadColumnEmails(column.id, false)}
                onRemove={handleRemoveColumn}
                canRemove={!isDefaultColumn}
              />
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!columnToDelete} onOpenChange={(open) => !open && setColumnToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Column</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the column "{columnToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveColumn} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
