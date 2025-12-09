import { useState, useEffect } from 'react';
import type { Email, Mailbox } from '@/types/email';
import { KanbanColumn } from './KanbanColumn';
import { emailService } from '@/services/emailService';

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
  { id: 'INBOX', name: 'Inbox', icon: 'Inbox' },
  { id: 'TODO', name: 'To Do', icon: 'CheckSquare' },
  { id: 'DONE', name: 'Done', icon: 'CheckCircle' },
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

  // Initialize columns from mailboxes
  useEffect(() => {
    const customLabels = mailboxes
      .filter(m => m.type === 'custom' && !['INBOX', 'TODO', 'DONE'].includes(m.id))
      .map(m => ({ id: m.id, name: m.name, icon: m.icon }));
    
      console.log('Custom Labels:', customLabels);
      console.log('Mailboxes:', mailboxes);
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
      
      setColumnEmails(prev => ({
        ...prev,
        [columnId]: reset ? response.emails : [...(prev[columnId] || []), ...response.emails]
      }));

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-4 p-4" style={{ minWidth: '100%' }}>
          {columns.map((column) => (
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
            />
          ))}
        </div>
      </div>
    </div>
  );
}
