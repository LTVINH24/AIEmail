import { useState, useEffect } from "react";
import type { Email, Mailbox } from "@/types/email";
import { KanbanColumn } from "./KanbanColumn";
import { SnoozeModal } from "./SnoozeModal";
import { emailService } from "@/services/emailService";
import { toast } from "sonner";
import type { EmailFilterOptions } from "./EmailFilters";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface KanbanColumn {
  id: string;
  name: string;
  icon: string;
}

interface KanbanBoardProps {
  mailboxes: Mailbox[];
  selectedEmailId: string | null;
  onEmailSelect: (emailId: string, mailboxId?: string) => void;
  onEmailMove: (
    emailId: string,
    targetMailboxId: string,
    sourceMailboxId: string
  ) => Promise<void>;
  onSnooze: (
    emailId: string,
    snoozeDate: Date,
    threadId?: string,
    sourceColumn?: string
  ) => Promise<void>;
  onUnsnooze: (workflowEmailId: number) => Promise<void>;
  onColumnsChange?: (columnIds: string[]) => void;
  refreshTrigger?: number;
  filters?: EmailFilterOptions;
  onLabelRename?: () => void;
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "INBOX", name: "Inbox", icon: "Inbox" },
];

// Helper function to apply filters to emails
function applyKanbanFilters(
  emails: Email[],
  filters?: EmailFilterOptions
): Email[] {
  if (!filters) return emails;

  let filtered = [...emails];

  // Apply filters
  if (filters.unreadOnly) {
    filtered = filtered.filter((email) => {
      if (email.messages && email.messages.length > 0) {
        return !email.isRead;
      }
      return !email.isRead;
    });
  }

  if (filters.hasAttachments) {
    filtered = filtered.filter((email) => {
      if (email.messages && email.messages.length > 0) {
        return email.messages.some(
          (msg) => msg.attachments && msg.attachments.length > 0
        );
      }
      return email.hasAttachments;
    });
  }

  // Apply sorting
  filtered.sort((a, b) => {
    if (filters.sort === "oldest") {
      const dateA = a.messages?.[0]?.date || a.timestamp;
      const dateB = b.messages?.[0]?.date || b.timestamp;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    } else if (filters.sort === "newest") {
      const dateA = a.messages?.[0]?.date || a.timestamp;
      const dateB = b.messages?.[0]?.date || b.timestamp;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    } else if (filters.sort === "sender") {
      const senderA = (
        a.messages?.[0]?.from.name ||
        a.messages?.[0]?.from.email ||
        a.from.name ||
        a.from.email ||
        ""
      ).toLowerCase();
      const senderB = (
        b.messages?.[0]?.from.name ||
        b.messages?.[0]?.from.email ||
        b.from.name ||
        b.from.email ||
        ""
      ).toLowerCase();
      return senderA.localeCompare(senderB);
    }
    return 0;
  });

  return filtered;
}

export function KanbanBoard({
  mailboxes,
  selectedEmailId,
  onEmailSelect,
  onEmailMove,
  onSnooze,
  onUnsnooze,
  onColumnsChange,
  refreshTrigger,
  filters,
  onLabelRename,
}: KanbanBoardProps) {
  const [draggedEmailId, setDraggedEmailId] = useState<string | null>(null);
  const [draggedSourceColumn, setDraggedSourceColumn] = useState<string | null>(
    null
  );
  const [columns, setColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
  // Store raw emails without filters
  const [rawColumnEmails, setRawColumnEmails] = useState<
    Record<string, Email[]>
  >({});
  // Store filtered emails
  const [columnEmails, setColumnEmails] = useState<Record<string, Email[]>>({});
  const [columnPages, setColumnPages] = useState<
    Record<string, { pageToken?: string; hasMore: boolean }>
  >({});
  const [loadingColumns, setLoadingColumns] = useState<Set<string>>(new Set());
  const [columnToDelete, setColumnToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isSnoozeModalOpen, setIsSnoozeModalOpen] = useState(false);
  const [emailToSnooze, setEmailToSnooze] = useState<{
    id: string;
    subject: string;
    sourceColumn: string;
    threadId?: string;
  } | null>(null);

  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("kanban-selected-columns");
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : ["INBOX"];
      }
    } catch (error) {
      console.error("Failed to load kanban columns from localStorage:", error);
    }
    return ["INBOX"];
  });

  useEffect(() => {
    const selectedColumns = selectedColumnIds
      .map((id) => {
        const mailbox = mailboxes.find((m) => m.id === id);
        return mailbox
          ? { id: mailbox.id, name: mailbox.name, icon: mailbox.icon }
          : null;
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
      localStorage.setItem(
        "kanban-selected-columns",
        JSON.stringify(selectedColumnIds)
      );
    } catch (error) {
      console.error("Failed to save kanban columns to localStorage:", error);
    }
  }, [selectedColumnIds]);

  const addColumn = (columnId: string): boolean => {
    if (selectedColumnIds.includes(columnId)) {
      return false;
    }

    setSelectedColumnIds((prev) => [...prev, columnId]);
    return true;
  };

  useEffect(() => {
    (
      window as typeof window & { __kanbanAddColumn?: (id: string) => boolean }
    ).__kanbanAddColumn = addColumn;
    return () => {
      delete (
        window as typeof window & {
          __kanbanAddColumn?: (id: string) => boolean;
        }
      ).__kanbanAddColumn;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColumnIds]);

  // Apply filters to raw emails whenever they change
  useEffect(() => {
    const filtered: Record<string, Email[]> = {};
    Object.keys(rawColumnEmails).forEach((columnId) => {
      filtered[columnId] = applyKanbanFilters(
        rawColumnEmails[columnId],
        filters
      );
    });
    setColumnEmails(filtered);
  }, [rawColumnEmails, filters]);

  // Load emails for each column
  useEffect(() => {
    loadAllColumns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]);

  // Reload all columns when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      console.log("KanbanBoard: refreshTrigger changed, reloading all columns");
      loadAllColumns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  const loadAllColumns = async () => {
    for (const column of columns) {
      await loadColumnEmails(column.id, true);
    }
  };

  const loadColumnEmails = async (columnId: string, reset: boolean = false) => {
    if (loadingColumns.has(columnId)) return;

    setLoadingColumns((prev) => new Set([...prev, columnId]));

    try {
      const pageToken = reset ? undefined : columnPages[columnId]?.pageToken;
      const response = await emailService.getEmailsByMailbox(
        columnId,
        5,
        pageToken,
        undefined
      );

      // Update raw emails
      setRawColumnEmails((prev) => ({
        ...prev,
        [columnId]: reset
          ? response.emails
          : [...(prev[columnId] || []), ...response.emails],
      }));

      // Fetch chi tiết từng email và update progressively
      response.emails.forEach(async (email) => {
        try {
          const fullEmail = await emailService.getEmailById(
            email.threadId,
            columnId
          );
          if (fullEmail) {
            setRawColumnEmails((prev) => {
              const currentEmails = prev[columnId] || [];
              const emailIndex = currentEmails.findIndex(
                (e) => e.threadId === email.threadId
              );
              if (emailIndex !== -1) {
                // Update existing email with full details
                const updated = [...currentEmails];
                updated[emailIndex] = fullEmail;
                return {
                  ...prev,
                  [columnId]: updated,
                };
              }
              return prev;
            });
          }
        } catch (error) {
          console.error(
            `Failed to fetch email detail for thread ${email.threadId}:`,
            error
          );
        }
      });

      setColumnPages((prev) => ({
        ...prev,
        [columnId]: {
          pageToken: response.nextPageToken,
          hasMore: !!response.nextPageToken,
        },
      }));
    } catch (error) {
      console.error(`Failed to load emails for ${columnId}:`, error);
    } finally {
      setLoadingColumns((prev) => {
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

    console.log("handleDrop called:", {
      draggedEmailId,
      draggedSourceColumn,
      targetColumnId,
    });

    const targetMailbox = mailboxes.find((m) => m.id === targetColumnId);
    const isSnoozedTarget = targetMailbox?.type === "snoozed";

    if (isSnoozedTarget) {
      console.log("Dropping into SNOOZED, looking for email:", draggedEmailId);
      console.log(
        "Available emails in columns:",
        Object.keys(columnEmails).map((col) => ({
          column: col,
          emails: columnEmails[col]?.map((e) => ({
            id: e.id,
            threadId: e.threadId,
            subject: e.subject,
          })),
        }))
      );

      const email = Object.values(columnEmails)
        .flat()
        .find((e) => e.id === draggedEmailId || e.threadId === draggedEmailId);

      console.log("Found email:", email);

      if (email) {
        setEmailToSnooze({
          id: draggedEmailId,
          subject: email.subject,
          sourceColumn: draggedSourceColumn,
          threadId: email.threadId,
        });
        setIsSnoozeModalOpen(true);
        console.log("Opening snooze modal");
      } else {
        console.error("Email not found for snooze");
        toast.error("Could not find email to snooze");
      }
      setDraggedEmailId(null);
      setDraggedSourceColumn(null);
      return;
    }

    const sourceMailbox = mailboxes.find((m) => m.id === draggedSourceColumn);
    const isSnoozedSource = sourceMailbox?.type === "snoozed";

    if (isSnoozedSource) {
      console.log("Dragging from SNOOZED to", targetColumnId);
      const email = columnEmails[draggedSourceColumn]?.find(
        (e) => e.id === draggedEmailId || e.threadId === draggedEmailId
      );
      console.log("Found email:", email);
      console.log("Email workflowEmailId:", email?.workflowEmailId);

      if (email?.workflowEmailId) {
        try {
          console.log(
            "Calling onUnsnooze with workflowEmailId:",
            email.workflowEmailId
          );

          // Step 1: Modify labels (SNOOZED → target label)
          try {
            if (email.threadId) {
              const snoozedLabelId = await emailService.getSnoozedLabelId();
              const addLabels =
                targetColumnId === "INBOX" ? ["INBOX"] : [targetColumnId];
              await emailService.modifyLabels({
                threadId: email.threadId,
                addLabelIds: addLabels,
                removeLabelIds: [snoozedLabelId],
              });
            }
          } catch (modErr) {
            console.warn("Failed to modify labels when unsnoozing:", modErr);
          }

          // Step 2: Update workflow database
          await onUnsnooze(email.workflowEmailId);

          // Update UI immediately without reloading
          // Remove from source (SNOOZED) column
          setRawColumnEmails((prev) => ({
            ...prev,
            [draggedSourceColumn]:
              prev[draggedSourceColumn]?.filter(
                (e) => e.id !== draggedEmailId && e.threadId !== draggedEmailId
              ) || [],
          }));

          // Add to target column at the beginning
          setRawColumnEmails((prev) => ({
            ...prev,
            [targetColumnId]: [email, ...(prev[targetColumnId] || [])],
          }));

          toast.success("Email unsnoozed successfully");
        } catch (error) {
          console.error("Failed to unsnooze email:", error);
          toast.error("Failed to unsnooze email");
        }
      } else {
        console.error("Email does not have workflowEmailId");
        console.error("Email object:", JSON.stringify(email, null, 2));
        console.error(
          "All emails in SNOOZED:",
          JSON.stringify(columnEmails[draggedSourceColumn], null, 2)
        );
        toast.error("Cannot unsnooze: Email data is invalid");
      }
      setDraggedEmailId(null);
      setDraggedSourceColumn(null);
      return;
    }

    try {
      // Call API to update labels (backend)
      await onEmailMove(draggedEmailId, targetColumnId, draggedSourceColumn);

      // Update UI immediately without reloading (FE only)
      const emailToMove = rawColumnEmails[draggedSourceColumn]?.find(
        (e) => e.id === draggedEmailId
      );

      if (emailToMove) {
        // Remove from source column
        setRawColumnEmails((prev) => ({
          ...prev,
          [draggedSourceColumn]:
            prev[draggedSourceColumn]?.filter((e) => e.id !== draggedEmailId) ||
            [],
        }));

        // Add to target column at the beginning
        setRawColumnEmails((prev) => ({
          ...prev,
          [targetColumnId]: [emailToMove, ...(prev[targetColumnId] || [])],
        }));
      }

      toast.success("Email moved successfully");
    } catch (error) {
      console.error("Failed to move email:", error);
      // If API call fails, reload both columns to restore correct state
      await loadColumnEmails(draggedSourceColumn, true);
      await loadColumnEmails(targetColumnId, true);
    } finally {
      setDraggedEmailId(null);
      setDraggedSourceColumn(null);
    }
  };

  const handleRemoveColumn = async (columnId: string) => {
    // Prevent removing default columns
    if (["INBOX"].includes(columnId)) {
      toast.error("Cannot remove default columns");
      return;
    }

    const column = columns.find((col) => col.id === columnId);
    if (column) {
      setColumnToDelete({ id: column.id, name: column.name });
    }
  };

  const confirmRemoveColumn = async () => {
    if (!columnToDelete) return;

    try {
      // Just remove from board view, do not delete label from backend
      toast.success("Column removed from board");

      setSelectedColumnIds((prev) => {
        // Remove the deleted column from array
        return prev.filter((id) => id !== columnToDelete.id);
      });

      // Remove column from state
      setColumns((prev) => prev.filter((col) => col.id !== columnToDelete.id));

      // Clear emails for this column
      setColumnEmails((prev) => {
        const updated = { ...prev };
        delete updated[columnToDelete.id];
        return updated;
      });
    } catch (error) {
      console.error("Failed to remove column:", error);
      toast.error("Failed to remove column");
    } finally {
      setColumnToDelete(null);
    }
  };

  const handleSnoozeConfirm = async (snoozeDate: Date) => {
    if (!emailToSnooze) return;

    try {
      await onSnooze(
        emailToSnooze.id,
        snoozeDate,
        emailToSnooze.threadId,
        emailToSnooze.sourceColumn
      );

      // Update UI immediately without reloading
      const emailToMove = rawColumnEmails[emailToSnooze.sourceColumn]?.find(
        (e) => e.id === emailToSnooze.id
      );

      if (emailToMove) {
        // Remove from source column
        setRawColumnEmails((prev) => ({
          ...prev,
          [emailToSnooze.sourceColumn]:
            prev[emailToSnooze.sourceColumn]?.filter(
              (e) => e.id !== emailToSnooze.id
            ) || [],
        }));

        // Find SNOOZED column and add email to it
        const snoozedColumn = columns.find((col) => {
          const mailbox = mailboxes.find((m) => m.id === col.id);
          return mailbox?.type === "snoozed";
        });

        if (snoozedColumn) {
          setRawColumnEmails((prev) => ({
            ...prev,
            [snoozedColumn.id]: [
              { ...emailToMove, snoozedUntil: snoozeDate.toISOString() },
              ...(prev[snoozedColumn.id] || []),
            ],
          }));
        }
      }

      toast.success("Email snoozed successfully");
    } catch (error) {
      console.error("Failed to snooze email:", error);
      // If API call fails, reload columns to restore correct state
      await loadColumnEmails(emailToSnooze.sourceColumn, true);
      const snoozedColumn = columns.find((col) => {
        const mailbox = mailboxes.find((m) => m.id === col.id);
        return mailbox?.type === "snoozed";
      });
      if (snoozedColumn) {
        await loadColumnEmails(snoozedColumn.id, true);
      }
    } finally {
      setIsSnoozeModalOpen(false);
      setEmailToSnooze(null);
    }
  };

  const handleRenameColumn = async (columnId: string, newName: string) => {
    const trimmedName = newName.trim();
    if (!trimmedName) return;

    if (
      mailboxes.some(
        (m) =>
          m.name.toLowerCase() === trimmedName.toLowerCase() &&
          m.id !== columnId
      )
    ) {
      toast.error(`Label "${trimmedName}" already exists`);
      return;
    }

    try {
      await emailService.updateLabel(columnId, trimmedName);

      setColumns((prev) =>
        prev.map((col) =>
          col.id === columnId ? { ...col, name: trimmedName } : col
        )
      );

      toast.success(`Renamed to "${trimmedName}"`);

      onLabelRename?.();
    } catch (error) {
      console.error("Failed to rename column:", error);
      toast.error("Failed to rename column");
      throw error;
    }
  };

  return (
    <div className="flex flex-col h-full bg-linear-to-br from-background to-muted/30">
      <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
        <div className="flex h-full gap-6 p-6" style={{ minWidth: "100%" }}>
          {columns.map((column) => {
            const isDefaultColumn = ["INBOX"].includes(column.id);
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                emails={columnEmails[column.id] || []}
                selectedEmailId={selectedEmailId}
                draggedEmailId={draggedEmailId}
                onEmailSelect={(emailId: string) =>
                  onEmailSelect(emailId, column.id)
                }
                onDragStart={(emailId) => handleDragStart(emailId, column.id)}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
                hasMore={columnPages[column.id]?.hasMore || false}
                isLoading={loadingColumns.has(column.id)}
                onLoadMore={() => loadColumnEmails(column.id, false)}
                onRemove={handleRemoveColumn}
                canRemove={!isDefaultColumn}
                onRename={
                  mailboxes.find((m) => m.id === column.id)?.type === "user"
                    ? handleRenameColumn
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!columnToDelete}
        onOpenChange={(open) => !open && setColumnToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Column</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the column "{columnToDelete?.name}
              " from the board?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveColumn}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-white"
            >
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
