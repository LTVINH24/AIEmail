import { useState, useEffect } from 'react';
import type { Email, Mailbox } from '@/types/email';
import { KanbanColumn } from './KanbanColumn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { emailService } from '@/services/emailService';
import { toast } from 'sonner';

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
  onRefresh: () => void;
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
  onRefresh,
}: KanbanBoardProps) {
  const [draggedEmailId, setDraggedEmailId] = useState<string | null>(null);
  const [draggedSourceColumn, setDraggedSourceColumn] = useState<string | null>(null);
  const [newLabelName, setNewLabelName] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
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
      const response = await emailService.getEmailsByMailbox(columnId, 3, pageToken);
      
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

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;

    setIsCreatingLabel(true);
    try {
      const newLabel = await emailService.createLabel(newLabelName.trim());
      toast.success(`Label "${newLabelName}" created successfully`);
      
      // Add new column
      const newColumn: KanbanColumn = {
        id: newLabel.id,
        name: newLabel.name,
        icon: 'Tag'
      };
      setColumns(prev => [...prev, newColumn]);
      
      setNewLabelName('');
      setIsCreateDialogOpen(false);
      onRefresh();
    } catch (error) {
      console.error('Failed to create label:', error);
      toast.error('Failed to create label');
    } finally {
      setIsCreatingLabel(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Column
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Label</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Input
                  placeholder="Label name (e.g., To Do, Done)"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateLabel();
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setNewLabelName('');
                  }}
                  disabled={isCreatingLabel}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateLabel}
                  disabled={!newLabelName.trim() || isCreatingLabel}
                >
                  {isCreatingLabel ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-4 p-4 min-w-max">
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
