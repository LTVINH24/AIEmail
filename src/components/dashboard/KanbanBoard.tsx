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
  kanbanColumnId?: number; // Backend ID from API
}

interface KanbanColumnMapping {
  labelId: string;
  kanbanColumnId: number;
  name: string;
}

interface KanbanBoardProps {
  mailboxes: Mailbox[];
  selectedEmailId: string | null;
  onEmailSelect: (emailId: string, mailboxId?: string) => void;
  onEmailMove: (
    emailId: string,
    targetMailboxId: string,
    sourceMailboxId: string,
    threadId?: string,
  ) => Promise<void>;
  onSnooze: (
    emailId: string,
    snoozeDate: Date,
    threadId?: string,
    sourceColumn?: string,
  ) => Promise<void>;
  onUnsnooze: (workflowEmailId: number) => Promise<void>;
  onColumnsChange?: (columnIds: string[]) => void;
  refreshTrigger?: number;
  onLabelRename?: () => void;
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "INBOX", name: "Inbox", icon: "Inbox" },
];

const DEFAULT_COLUMN_FILTERS: EmailFilterOptions = {
  sort: "newest",
  unreadOnly: false,
  hasAttachments: false,
};

// Helper function to apply filters to emails
function applyKanbanFilters(
  emails: Email[],
  filters?: EmailFilterOptions,
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
          (msg) => msg.attachments && msg.attachments.length > 0,
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
  onLabelRename,
}: KanbanBoardProps) {
  const [draggedEmailId, setDraggedEmailId] = useState<string | null>(null);
  const [draggedSourceColumn, setDraggedSourceColumn] = useState<string | null>(
    null,
  );
  const [columns, setColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
  // Store raw emails without filters
  const [rawColumnEmails, setRawColumnEmails] = useState<
    Record<string, Email[]>
  >({});
  // Store filtered emails
  const [columnEmails, setColumnEmails] = useState<Record<string, Email[]>>({});
  // Store filters per column
  const [columnFilters, setColumnFilters] = useState<
    Record<string, EmailFilterOptions>
  >({});
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

  const [columnMappings, setColumnMappings] = useState<KanbanColumnMapping[]>(
    [],
  );

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
        const mapping = columnMappings.find((m) => m.labelId === id);
        if (!mailbox) return null;

        const col: KanbanColumn = {
          id: mailbox.id,
          name: mailbox.name,
          icon: mailbox.icon,
          kanbanColumnId: mapping?.kanbanColumnId,
        };
        return col;
      })
      .filter((col) => col !== null) as KanbanColumn[];

    setColumns(selectedColumns);
  }, [mailboxes, selectedColumnIds, columnMappings]);

  // Load kanban columns from API on mount
  useEffect(() => {
    loadKanbanColumnsFromAPI();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload columns when mailboxes change (to map names to labelIds)
  useEffect(() => {
    if (mailboxes.length > 0 && columnMappings.length === 0) {
      loadKanbanColumnsFromAPI();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailboxes]);

  const loadKanbanColumnsFromAPI = async () => {
    try {
      const apiColumns = await emailService.getKanbanColumns();
      console.log("Loaded kanban columns from API:", apiColumns);
      console.log("Available mailboxes:", mailboxes);

      // Map API columns to KanbanColumnMapping
      // API returns {id: number, name: string} where name is the label display name
      // We need to find the matching mailbox by name to get the labelId
      const mappings: KanbanColumnMapping[] = apiColumns
        .map((col) => {
          // Find mailbox by name (case-insensitive)
          const mailbox = mailboxes.find(
            (m) => m.name.toLowerCase() === col.name.toLowerCase(),
          );

          if (!mailbox) {
            console.warn(`No mailbox found for kanban column: ${col.name}`);
            return null;
          }

          return {
            labelId: mailbox.id, // Use the actual Gmail labelId
            kanbanColumnId: col.id,
            name: col.name,
          };
        })
        .filter((m): m is KanbanColumnMapping => m !== null);

      setColumnMappings(mappings);

      // Update selected column IDs based on API response
      const columnIds = mappings.map((m) => m.labelId);
      // Always include INBOX if not present
      if (!columnIds.includes("INBOX")) {
        columnIds.unshift("INBOX");
      }

      console.log("Mapped column IDs:", columnIds);
      setSelectedColumnIds(columnIds);

      // Update localStorage cache
      try {
        localStorage.setItem(
          "kanban-selected-columns",
          JSON.stringify(columnIds),
        );
        localStorage.setItem(
          "kanban-column-mappings",
          JSON.stringify(mappings),
        );
      } catch (error) {
        console.error("Failed to save kanban columns to localStorage:", error);
      }
    } catch (error) {
      console.error("Failed to load kanban columns from API:", error);
      // Try to load from localStorage as fallback
      try {
        const savedMappings = localStorage.getItem("kanban-column-mappings");
        if (savedMappings) {
          const parsedMappings = JSON.parse(savedMappings);
          setColumnMappings(parsedMappings);
        }
      } catch (err) {
        console.error("Failed to load from localStorage:", err);
      }
    }
  };

  useEffect(() => {
    if (onColumnsChange) {
      onColumnsChange(selectedColumnIds);
    }
  }, [selectedColumnIds, onColumnsChange]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "kanban-selected-columns",
        JSON.stringify(selectedColumnIds),
      );
    } catch (error) {
      console.error("Failed to save kanban columns to localStorage:", error);
    }
  }, [selectedColumnIds]);

  const addColumn = async (
    columnId: string,
    _systemLabel: boolean,
  ): Promise<boolean> => {
    if (selectedColumnIds.includes(columnId)) {
      return false;
    }

    // Just update UI - mailboxes API already handles the backend creation
    // No need to call separate kanban API
    setSelectedColumnIds((prev) => [...prev, columnId]);

    // Update localStorage cache
    try {
      const updatedIds = [...selectedColumnIds, columnId];
      localStorage.setItem(
        "kanban-selected-columns",
        JSON.stringify(updatedIds),
      );
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }

    // Reload columns from API to get the kanbanColumnId assigned by backend
    setTimeout(() => {
      loadKanbanColumnsFromAPI();
    }, 500);

    return true;
  };

  useEffect(() => {
    (
      window as typeof window & {
        __kanbanAddColumn?: (
          id: string,
          systemLabel: boolean,
        ) => Promise<boolean>;
      }
    ).__kanbanAddColumn = addColumn;
    return () => {
      delete (
        window as typeof window & {
          __kanbanAddColumn?: (
            id: string,
            systemLabel: boolean,
          ) => Promise<boolean>;
        }
      ).__kanbanAddColumn;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColumnIds, columnMappings]);

  // Expose loadKanbanColumnsFromAPI for external reload
  useEffect(() => {
    (
      window as typeof window & { __kanbanReloadColumns?: () => Promise<void> }
    ).__kanbanReloadColumns = loadKanbanColumnsFromAPI;
    return () => {
      delete (
        window as typeof window & {
          __kanbanReloadColumns?: () => Promise<void>;
        }
      ).__kanbanReloadColumns;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailboxes]);

  // Apply filters to raw emails whenever they change or filters change
  useEffect(() => {
    const filtered: Record<string, Email[]> = {};
    Object.keys(rawColumnEmails).forEach((columnId) => {
      // Get filter for this column or use default
      const columnFilter = columnFilters[columnId] || {
        sort: "newest",
        unreadOnly: false,
        hasAttachments: false,
      };

      filtered[columnId] = applyKanbanFilters(
        rawColumnEmails[columnId],
        columnFilter,
      );
    });
    setColumnEmails(filtered);
  }, [rawColumnEmails, columnFilters]);

  // Handler for column filter changes
  const handleColumnFilterChange = (
    columnId: string,
    newFilters: EmailFilterOptions,
  ) => {
    setColumnFilters((prev) => ({
      ...prev,
      [columnId]: newFilters,
    }));
  };

  const handleColumnFilterClear = (columnId: string) => {
    setColumnFilters((prev) => {
      const updated = { ...prev };
      delete updated[columnId];
      return updated;
    });
  };

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
        undefined,
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
            columnId,
          );
          if (fullEmail) {
            setRawColumnEmails((prev) => {
              const currentEmails = prev[columnId] || [];
              const emailIndex = currentEmails.findIndex(
                (e) => e.threadId === email.threadId,
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
            error,
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

  const handleSelectEmailWithColumn = (emailId: string) => {
    // Determine which column/mailbox this email belongs to
    // Iterate through columnEmails to find the email
    let foundColumnId = "INBOX"; // Default

    for (const [colId, emails] of Object.entries(columnEmails)) {
      if (emails.some((e) => e.id === emailId)) {
        foundColumnId = colId;
        break;
      }
    }

    onEmailSelect(emailId, foundColumnId);
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
        })),
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
        (e) => e.id === draggedEmailId || e.threadId === draggedEmailId,
      );
      console.log("Found email:", email);
      console.log("Email workflowEmailId:", email?.workflowEmailId);

      if (email?.workflowEmailId) {
        try {
          console.log(
            "Calling onUnsnooze with workflowEmailId:",
            email.workflowEmailId,
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
                (e) => e.id !== draggedEmailId && e.threadId !== draggedEmailId,
              ) || [],
          }));

          // Add to target column at the beginning
          setRawColumnEmails((prev) => ({
            ...prev,
            [targetColumnId]: [email, ...(prev[targetColumnId] || [])],
          }));

          // toast.success("Email unsnoozed successfully");
        } catch (error) {
          console.error("Failed to unsnooze email:", error);
          toast.error("Failed to unsnooze email");
        }
      } else {
        console.error("Email does not have workflowEmailId");
        console.error("Email object:", JSON.stringify(email, null, 2));
        console.error(
          "All emails in SNOOZED:",
          JSON.stringify(columnEmails[draggedSourceColumn], null, 2),
        );
        toast.error("Cannot unsnooze: Email data is invalid");
      }
      setDraggedEmailId(null);
      setDraggedSourceColumn(null);
      return;
    }

    const emailToMove = rawColumnEmails[draggedSourceColumn]?.find(
      (e) => e.id === draggedEmailId,
    );

    if (!emailToMove) {
      console.error("[KanbanBoard] Email not found in source column");
      toast.error("Could not find email to move");
      setDraggedEmailId(null);
      setDraggedSourceColumn(null);
      return;
    }

    console.log("[KanbanBoard] 🚀 Starting email move:", {
      emailId: draggedEmailId,
      threadId: emailToMove.threadId,
      from: draggedSourceColumn,
      to: targetColumnId,
    });

    // STEP 1: Optimistic UI update (cập nhật giao diện ngay lập tức)
    console.log("[KanbanBoard] 📱 Updating UI optimistically...");

    // Store the previous state for rollback
    const previousSourceEmails = rawColumnEmails[draggedSourceColumn] || [];
    const previousTargetEmails = rawColumnEmails[targetColumnId] || [];

    // Remove from source column
    setRawColumnEmails((prev) => ({
      ...prev,
      [draggedSourceColumn]:
        prev[draggedSourceColumn]?.filter((e) => e.id !== draggedEmailId) || [],
    }));

    // Add to target column at the beginning
    setRawColumnEmails((prev) => ({
      ...prev,
      [targetColumnId]: [emailToMove, ...(prev[targetColumnId] || [])],
    }));

    console.log("[KanbanBoard] ✅ UI updated");

    // STEP 2: Call API in background (gọi API để cập nhật backend)
    try {
      console.log("[KanbanBoard] 🌐 Calling API to update labels...");
      await onEmailMove(
        draggedEmailId,
        targetColumnId,
        draggedSourceColumn,
        emailToMove.threadId,
      );
      console.log(
        "[KanbanBoard] ✅ API call successful - email moved permanently",
      );
    } catch (error) {
      console.error("[KanbanBoard] ❌ API call failed:", error);

      // STEP 3: Rollback UI if API fails
      console.log("[KanbanBoard] 🔄 Rolling back UI changes...");
      setRawColumnEmails((prev) => ({
        ...prev,
        [draggedSourceColumn]: previousSourceEmails,
        [targetColumnId]: previousTargetEmails,
      }));

      toast.error("Failed to move email - changes reverted");
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
      // Find the kanbanColumnId for this column
      const mapping = columnMappings.find(
        (m) => m.labelId === columnToDelete.id,
      );

      if (mapping?.kanbanColumnId) {
        // Call DELETE API to remove from backend
        await emailService.deleteKanbanColumn(mapping.kanbanColumnId);
        console.log("Deleted kanban column via API:", mapping.kanbanColumnId);

        // Update mappings
        setColumnMappings((prev) =>
          prev.filter((m) => m.labelId !== columnToDelete.id),
        );
      }

      // Update selected column IDs (optimistic UI update)
      setSelectedColumnIds((prev) => {
        const updated = prev.filter((id) => id !== columnToDelete.id);
        // Update localStorage cache
        try {
          localStorage.setItem(
            "kanban-selected-columns",
            JSON.stringify(updated),
          );
          const updatedMappings = columnMappings.filter(
            (m) => m.labelId !== columnToDelete.id,
          );
          localStorage.setItem(
            "kanban-column-mappings",
            JSON.stringify(updatedMappings),
          );
        } catch (error) {
          console.error("Failed to save to localStorage:", error);
        }
        return updated;
      });

      // Remove column from state
      setColumns((prev) => prev.filter((col) => col.id !== columnToDelete.id));

      // Clear emails for this column
      setColumnEmails((prev) => {
        const updated = { ...prev };
        delete updated[columnToDelete.id];
        return updated;
      });

      setRawColumnEmails((prev) => {
        const updated = { ...prev };
        delete updated[columnToDelete.id];
        return updated;
      });

      // toast.success("Column removed from board");
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
        emailToSnooze.sourceColumn,
      );

      // Update UI immediately without reloading
      const emailToMove = rawColumnEmails[emailToSnooze.sourceColumn]?.find(
        (e) => e.id === emailToSnooze.id,
      );

      if (emailToMove) {
        // Remove from source column
        setRawColumnEmails((prev) => ({
          ...prev,
          [emailToSnooze.sourceColumn]:
            prev[emailToSnooze.sourceColumn]?.filter(
              (e) => e.id !== emailToSnooze.id,
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
          m.id !== columnId,
      )
    ) {
      toast.error(`Label "${trimmedName}" already exists`);
      return;
    }

    try {
      // Find the kanbanColumnId for this column
      const mapping = columnMappings.find((m) => m.labelId === columnId);

      // Update Gmail label via mailboxes API - it handles both label and kanban update
      await emailService.updateLabel(
        columnId,
        trimmedName,
        mapping?.kanbanColumnId,
      );

      // Update mappings locally
      setColumnMappings((prev) =>
        prev.map((m) =>
          m.labelId === columnId ? { ...m, name: trimmedName } : m,
        ),
      );

      // Update localStorage cache
      try {
        const updatedMappings = columnMappings.map((m) =>
          m.labelId === columnId ? { ...m, name: trimmedName } : m,
        );
        localStorage.setItem(
          "kanban-column-mappings",
          JSON.stringify(updatedMappings),
        );
      } catch (error) {
        console.error("Failed to save to localStorage:", error);
      }

      // Update UI (optimistic update)
      setColumns((prev) =>
        prev.map((col) =>
          col.id === columnId ? { ...col, name: trimmedName } : col,
        ),
      );

      // toast.success(`Renamed to "${trimmedName}"`);

      onLabelRename?.();
    } catch (error) {
      console.error("Failed to rename column:", error);
      toast.error("Failed to rename column");
      throw error;
    }
  };

  return (
    <div className="flex flex-col h-full bg-linear-to-br from-background to-muted/30">
      <div className="flex-1 md:overflow-x-auto md:overflow-y-hidden overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
        <div
          className="flex flex-col md:flex-row h-auto md:h-full gap-4 md:gap-6 p-4 md:p-6"
          style={{ minWidth: "100%" }}
        >
          {columns.map((column) => {
            const isDefault = ["INBOX"].includes(column.id);
            const currentFilter =
              columnFilters[column.id] || DEFAULT_COLUMN_FILTERS;

            return (
              <KanbanColumn
                key={column.id}
                column={column}
                emails={columnEmails[column.id] || []}
                selectedEmailId={selectedEmailId}
                draggedEmailId={draggedEmailId}
                onEmailSelect={handleSelectEmailWithColumn}
                onDragStart={(emailId) => handleDragStart(emailId, column.id)}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
                hasMore={columnPages[column.id]?.hasMore ?? false}
                isLoading={loadingColumns.has(column.id)}
                onLoadMore={() => loadColumnEmails(column.id)}
                onRemove={isDefault ? undefined : handleRemoveColumn}
                canRemove={!isDefault}
                filters={currentFilter}
                onFiltersChange={(newFilters) =>
                  handleColumnFilterChange(column.id, newFilters)
                }
                onFilterClear={() => handleColumnFilterClear(column.id)}
                onRename={handleRenameColumn}
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
