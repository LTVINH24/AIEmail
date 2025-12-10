import { useState, useEffect } from 'react';
import type { Email, Mailbox } from '@/types/email';
import { KanbanColumn } from './KanbanColumn';
import { SnoozeModal } from './SnoozeModal';
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
  onEmailSelect: (emailId: string, mailboxId?: string) => void;
  onEmailMove: (emailId: string, targetMailboxId: string, sourceMailboxId: string) => Promise<void>;
  onSnooze: (emailId: string, snoozeDate: Date, threadId?: string, sourceColumn?: string) => Promise<void>;
  onUnsnooze: (workflowEmailId: number) => Promise<void>;
  onColumnsChange?: (columnIds: string[]) => void;
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'INBOX', name: 'Inbox', icon: 'Inbox' }
];

export function KanbanBoard({
  mailboxes,
  selectedEmailId,
  onEmailSelect,
  onEmailMove,
  onSnooze,
  onUnsnooze,
  onColumnsChange,
}: KanbanBoardProps) {
  const [draggedEmailId, setDraggedEmailId] = useState<string | null>(null);
  const [draggedSourceColumn, setDraggedSourceColumn] = useState<string | null>(null);
  const [columns, setColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
  const [columnEmails, setColumnEmails] = useState<Record<string, Email[]>>({});
  const [columnPages, setColumnPages] = useState<Record<string, { pageToken?: string; hasMore: boolean }>>({});
  const [loadingColumns, setLoadingColumns] = useState<Set<string>>(new Set());
  const [columnToDelete, setColumnToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isSnoozeModalOpen, setIsSnoozeModalOpen] = useState(false);
  const [emailToSnooze, setEmailToSnooze] = useState<{ id: string; subject: string; sourceColumn: string; threadId?: string } | null>(null);
  
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kanban-selected-columns');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : ['INBOX'];
      }
    } catch (error) {
      console.error('Failed to load kanban columns from localStorage:', error);
    }
    return ['INBOX'];
  });

  useEffect(() => {
    const selectedColumns = selectedColumnIds
      .map(id => {
        const mailbox = mailboxes.find(m => m.id === id);
        return mailbox ? { id: mailbox.id, name: mailbox.name, icon: mailbox.icon } : null;
      })
      .filter((col): col is KanbanColumn => col !== null);
    
    setColumns(selectedColumns);
  }, [mailboxes, selectedColumnIds]);

  useEffect(() => {
    if (onColumnsChange) {
      onColumnsChange(selectedColumnIds);
    }
  }, [selectedColumnIds, onColumnsChange]);

  useEffect(() => {
    try {
      localStorage.setItem('kanban-selected-columns', JSON.stringify(selectedColumnIds));
    } catch (error) {
      console.error('Failed to save kanban columns to localStorage:', error);
    }
  }, [selectedColumnIds]);

  const addColumn = (columnId: string): boolean => {
    if (selectedColumnIds.includes(columnId)) {
      return false; 
    }
    
    setSelectedColumnIds(prev => [...prev, columnId]);
    return true;
  };

  useEffect(() => {
    (window as typeof window & { __kanbanAddColumn?: (id: string) => boolean }).__kanbanAddColumn = addColumn;
    return () => {
      delete (window as typeof window & { __kanbanAddColumn?: (id: string) => boolean }).__kanbanAddColumn;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColumnIds]);

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
          const fullEmail = await emailService.getEmailById(email.threadId, columnId);
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
    
    console.log('handleDrop called:', { draggedEmailId, draggedSourceColumn, targetColumnId });
    
    const targetMailbox = mailboxes.find(m => m.id === targetColumnId);
    const isSnoozedTarget = targetMailbox?.type === 'snoozed';
    
    if (isSnoozedTarget) {
      console.log('Dropping into SNOOZED, looking for email:', draggedEmailId);
      console.log('Available emails in columns:', Object.keys(columnEmails).map(col => ({
        column: col,
        emails: columnEmails[col]?.map(e => ({ id: e.id, threadId: e.threadId, subject: e.subject }))
      })));
      
      const email = Object.values(columnEmails)
        .flat()
        .find(e => e.id === draggedEmailId || e.threadId === draggedEmailId);
      
      console.log('Found email:', email);
      
      if (email) {
        setEmailToSnooze({
          id: draggedEmailId,
          subject: email.subject,
          sourceColumn: draggedSourceColumn,
          threadId: email.threadId,
        });
        setIsSnoozeModalOpen(true);
        console.log('Opening snooze modal');
      } else {
        console.error('Email not found for snooze');
        toast.error('Could not find email to snooze');
      }
      setDraggedEmailId(null);
      setDraggedSourceColumn(null);
      return;
    }
    
    const sourceMailbox = mailboxes.find(m => m.id === draggedSourceColumn);
    const isSnoozedSource = sourceMailbox?.type === 'snoozed';
    
    if (isSnoozedSource) {
      console.log('Dragging from SNOOZED to', targetColumnId);
      const email = columnEmails[draggedSourceColumn]?.find(e => e.id === draggedEmailId || e.threadId === draggedEmailId);
      console.log('Found email:', email);
      console.log('Email workflowEmailId:', email?.workflowEmailId);
      
      if (email?.workflowEmailId) {
        try {
          console.log('Calling onUnsnooze with workflowEmailId:', email.workflowEmailId);
          
          // Step 1: Modify labels (SNOOZED → target label)
          try {
            if (email.threadId) {
              const snoozedLabelId = await emailService.getSnoozedLabelId();
              const addLabels = targetColumnId === 'INBOX' ? ['INBOX'] : [targetColumnId];
              await emailService.modifyLabels({
                threadId: email.threadId,
                addLabelIds: addLabels,
                removeLabelIds: [snoozedLabelId],
              });
            }
          } catch (modErr) {
            console.warn('Failed to modify labels when unsnoozing:', modErr);
          }

          // Step 2: Update workflow database
          await onUnsnooze(email.workflowEmailId);

          toast.success('Email unsnoozed successfully');
          await loadColumnEmails(draggedSourceColumn, true);
          await loadColumnEmails(targetColumnId, true);
        } catch (error) {
          console.error('Failed to unsnooze email:', error);
          toast.error('Failed to unsnooze email');
        }
      } else {
        console.error('Email does not have workflowEmailId');
        console.error('Email object:', JSON.stringify(email, null, 2));
        console.error('All emails in SNOOZED:', JSON.stringify(columnEmails[draggedSourceColumn], null, 2));
        toast.error('Cannot unsnooze: Email data is invalid');
      }
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
      const mailbox = mailboxes.find(m => m.id === columnToDelete.id);
      
      if (mailbox?.type === 'user') {
        await emailService.deleteLabel(columnToDelete.id);
        toast.success('Label deleted successfully');
      } else {
        toast.success('Column removed from board');
      }
      
      setSelectedColumnIds(prev => {
        // Remove the deleted column from array
        return prev.filter(id => id !== columnToDelete.id);
      });
      
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

  const handleSnoozeConfirm = async (snoozeDate: Date) => {
    if (!emailToSnooze) return;

    try {
      await onSnooze(emailToSnooze.id, snoozeDate, emailToSnooze.threadId, emailToSnooze.sourceColumn);
      
      await loadColumnEmails(emailToSnooze.sourceColumn, true);
      
      const snoozedColumn = columns.find(col => {
        const mailbox = mailboxes.find(m => m.id === col.id);
        return mailbox?.type === 'snoozed';
      });
      
      if (snoozedColumn) {
        console.log('Reloading SNOOZED column:', snoozedColumn.id);
        await loadColumnEmails(snoozedColumn.id, true);
      }
    } catch (error) {
      console.error('Failed to snooze email:', error);
    } finally {
      setIsSnoozeModalOpen(false);
      setEmailToSnooze(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-4 p-4" style={{ minWidth: '100%' }}>
          {columns.map((column) => {
            const isDefaultColumn = ['INBOX'].includes(column.id);
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                emails={columnEmails[column.id] || []}
                selectedEmailId={selectedEmailId}
                draggedEmailId={draggedEmailId}
                onEmailSelect={(emailId: string) => onEmailSelect(emailId, column.id)}
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
            <AlertDialogAction onClick={confirmRemoveColumn} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-white">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SnoozeModal
        open={isSnoozeModalOpen}
        onClose={() => {
          setIsSnoozeModalOpen(false);
          setEmailToSnooze(null);
        }}
        onSnooze={handleSnoozeConfirm}
        emailSubject={emailToSnooze?.subject}
      />
    </div>
  );
}
