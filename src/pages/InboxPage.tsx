import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { Mailbox, Email } from "@/types/email";
import { emailService } from "@/services/emailService";
import { MailboxList } from "@/components/dashboard/MailboxList";
import { EmailList } from "@/components/dashboard/EmailList";
import { EmailDetail } from "@/components/dashboard/EmailDetail";
import { ComposeEmailModal } from "@/components/dashboard/ComposeEmailModal";
import { KanbanBoard } from "@/components/dashboard/KanbanBoard";
import { SearchBar } from "@/components/dashboard/SearchBar";
import {
  EmailFilters,
  type EmailFilterOptions,
} from "@/components/dashboard/EmailFilters";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, ArrowLeft, LogOut, LayoutGrid, List, Plus } from "lucide-react";

// Helper function to apply filters and sorting to emails
function applyFiltersAndSort(
  emails: Email[],
  filters: EmailFilterOptions
): Email[] {
  let filtered = [...emails];

  // Apply filters
  if (filters.unreadOnly) {
    filtered = filtered.filter((email) => {
      // Check if email is unread from messages if available
      if (email.messages && email.messages.length > 0) {
        // If messages are loaded, we can check labelIds more accurately
        // For now, use the isRead property
        return !email.isRead;
      }
      return !email.isRead;
    });
  }

  if (filters.hasAttachments) {
    filtered = filtered.filter((email) => {
      // Check if email has attachments from messages if available
      if (email.messages && email.messages.length > 0) {
        return email.messages.some(
          (msg) => msg.attachments && msg.attachments.length > 0
        );
      }
      return email.hasAttachments;
    });
  }

  // Apply sorting - "newest" keeps API order (already sorted by Gmail)
  // Only sort when explicitly changing order
  if (filters.sort === "oldest") {
    // Reverse the order to show oldest first
    filtered.sort((a, b) => {
      const dateA = a.messages?.[0]?.date || a.timestamp;
      const dateB = b.messages?.[0]?.date || b.timestamp;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
  } else if (filters.sort === "sender") {
    // Sort by sender alphabetically
    filtered.sort((a, b) => {
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
    });
  }
  // For "newest", keep the original order from API (already newest first)

  return filtered;
}

export function InboxPage() {
  const navigate = useNavigate();
  const { mailboxId: urlMailboxId, emailId: urlEmailId } = useParams<{
    mailboxId: string;
    emailId?: string;
  }>();
  const { user, logout } = useAuth();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  // Store raw emails without filter/sort applied
  const [rawEmails, setRawEmails] = useState<Email[]>([]);
  // Display emails with filter/sort applied
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>(
    urlMailboxId || "INBOX"
  );
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(
    urlEmailId || null
  );
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeDefaults, setComposeDefaults] = useState<{
    to?: string;
    subject?: string;
    body?: string;
    threadId?: string;
    messageId?: string;
  }>({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showEmailDetail, setShowEmailDetail] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    try {
      const saved = localStorage.getItem("email-view-mode");
      return saved === "kanban" || saved === "list" ? saved : "list";
    } catch (error) {
      console.error("Failed to load view mode from localStorage:", error);
      return "list";
    }
  });

  const smartSnoozeTimerRef = useState<{
    current: ReturnType<typeof setTimeout> | null;
  }>({
    current: null,
  })[0];

  const setupSmartSnoozeTimer = async () => {
    if (smartSnoozeTimerRef.current) {
      clearTimeout(smartSnoozeTimerRef.current);
      smartSnoozeTimerRef.current = null;
    }

    try {
      const { emails } = await emailService.getEmailsByMailbox("SNOOZED");

      const now = Date.now();

      const overdueEmail = emails.find(
        (e) => e.snoozedUntil && new Date(e.snoozedUntil).getTime() <= now
      );

      if (overdueEmail) {
        console.log(
          `Smart Snooze: Waiting for email ${overdueEmail.id} to leave SNOOZED...`
        );

        smartSnoozeTimerRef.current = setTimeout(async () => {
          try {
            const checkString = await emailService.getEmailsByMailbox(
              "SNOOZED"
            );
            const stillThere = checkString.emails.find(
              (e) => e.id === overdueEmail.id
            );

            if (!stillThere) {
              console.log("Smart Snooze: Email restored! Refreshing inbox.");

              if (selectedMailboxId.toUpperCase() === "SNOOZED") {
                setRawEmails((prev) =>
                  prev.filter((e) => String(e.id) !== String(overdueEmail.id))
                );
              }

              console.log("Smart Snooze: Triggering reload...");
              await loadEmails(true);
              setKanbanRefreshTrigger((prev) => prev + 1);
              setupSmartSnoozeTimer();
            } else {
              setupSmartSnoozeTimer();
            }
          } catch (e) {
            setupSmartSnoozeTimer();
          }
        }, 3000);
        return;
      }

      const futureSnoozedEmails = emails.filter(
        (e) => e.snoozedUntil && new Date(e.snoozedUntil).getTime() > now
      );

      if (futureSnoozedEmails.length === 0) return;

      futureSnoozedEmails.sort(
        (a, b) =>
          new Date(a.snoozedUntil!).getTime() -
          new Date(b.snoozedUntil!).getTime()
      );

      const nextEmail = futureSnoozedEmails[0];
      const nextTime = new Date(nextEmail.snoozedUntil!).getTime();
      let delay = nextTime - now;

      delay += 2000;

      console.log(
        `Smart Snooze: Scheduled check in ${Math.round(
          delay / 1000
        )}s for email ${nextEmail.id}`
      );

      smartSnoozeTimerRef.current = setTimeout(() => {
        setupSmartSnoozeTimer();
      }, delay);
    } catch (error) {
      console.error("Smart Snooze: Failed to setup timer", error);
    }
  };

  useEffect(() => {
    setupSmartSnoozeTimer();
    return () => {
      if (smartSnoozeTimerRef.current) {
        clearTimeout(smartSnoozeTimerRef.current);
      }
    };
  }, [selectedMailboxId]);
  const [isAddColumnDialogOpen, setIsAddColumnDialogOpen] = useState(false);
  const [selectedLabelForColumn, setSelectedLabelForColumn] = useState("");
  const [isCreatingNewLabel, setIsCreatingNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");

  const [isLoadingMailboxes, setIsLoadingMailboxes] = useState(true);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(
    undefined
  );
  const [hasMore, setHasMore] = useState(false);
  const [kanbanRefreshTrigger, setKanbanRefreshTrigger] = useState(0);

  // Search state
  const [_searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<EmailFilterOptions>(() => {
    try {
      const saved = localStorage.getItem("email-filters");
      return saved
        ? JSON.parse(saved)
        : { sort: "newest", unreadOnly: false, hasAttachments: false };
    } catch {
      return { sort: "newest", unreadOnly: false, hasAttachments: false };
    }
  });

  useEffect(() => {
    loadMailboxes();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("email-view-mode", viewMode);
    } catch (error) {
      console.error("Failed to save view mode to localStorage:", error);
    }
  }, [viewMode]);

  useEffect(() => {
    try {
      localStorage.setItem("email-filters", JSON.stringify(filters));
    } catch (error) {
      console.error("Failed to save filters to localStorage:", error);
    }

    // Apply filters and sort to raw emails whenever filters change
    const filtered = applyFiltersAndSort(rawEmails, filters);
    setEmails(filtered);
  }, [filters, rawEmails]);

  useEffect(() => {
    if (urlMailboxId && urlMailboxId !== selectedMailboxId) {
      setSelectedMailboxId(urlMailboxId);
    }
    if (urlEmailId !== undefined) {
      setSelectedEmailId(urlEmailId || null);
      setShowEmailDetail(!!urlEmailId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlMailboxId, urlEmailId]);

  useEffect(() => {
    // Only load emails in list view, KanbanBoard loads its own data
    if (viewMode === "list") {
      loadEmails(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMailboxId, viewMode]);

  const prefetchEmailDetails = async (
    emailsToPrefetch: Email[],
    mailboxIdForPrefetch: string
  ) => {
    const concurrency = 4;
    let index = 0;

    const worker = async () => {
      while (true) {
        let current: Email | undefined;
        if (index < emailsToPrefetch.length) {
          current = emailsToPrefetch[index++];
        } else {
          break;
        }

        if (!current) break;

        if (mailboxIdForPrefetch !== selectedMailboxId) return;

        if (current.messages && current.messages.length > 0) continue;

        try {
          console.log("Prefetching email detail:", {
            id: current.id,
            threadId: current.threadId,
            workflowEmailId: current.workflowEmailId,
          });
          const detail = await emailService.getEmailById(
            current.threadId,
            mailboxIdForPrefetch
          );
          if (detail) {
            setRawEmails((prev) => {
              if (mailboxIdForPrefetch !== selectedMailboxId) return prev;

              // Update rawEmails with detail data - preserve order
              const updated = prev.map((e) => {
                if (e.id === detail.id) {
                  return {
                    ...detail,
                    preview: e.preview || detail.preview,
                    // Always use detail.isRead from labelIds (source of truth from Gmail)
                    isRead: detail.isRead,
                    isStarred: detail.isStarred,
                    workflowEmailId: e.workflowEmailId,
                    snoozedUntil: e.snoozedUntil,
                  };
                }
                return e;
              });

              return updated;
            });
          }
        } catch (error) {
          console.error("Prefetch detail failed for", current.threadId, error);
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, emailsToPrefetch.length) },
      () => worker()
    );
    await Promise.all(workers);
  };

  const loadMailboxes = async () => {
    setIsLoadingMailboxes(true);
    try {
      const data = await emailService.getMailboxes();
      setMailboxes(data);
    } catch (error) {
      console.error("Failed to load mailboxes:", error);
      toast.error("Failed to load mailboxes");
    } finally {
      setIsLoadingMailboxes(false);
    }
  };

  const loadEmails = async (reset: boolean = false) => {
    setIsLoadingEmails(true);

    const startTime = Date.now();
    const minLoadingTime = 500;

    try {
      const pageToken = reset ? undefined : nextPageToken;
      const response = await emailService.getEmailsByMailbox(
        selectedMailboxId,
        50,
        pageToken,
        undefined
      );

      console.log(`Loaded emails for ${selectedMailboxId}:`, response.emails);

      if (reset) {
        setRawEmails(response.emails);
      } else {
        setRawEmails((prev) => [...prev, ...response.emails]);
      }

      prefetchEmailDetails(response.emails, selectedMailboxId).catch((err) =>
        console.error("Background prefetch error", err)
      );

      setNextPageToken(response.nextPageToken);
      setHasMore(!!response.nextPageToken);

      if (reset) {
        setSelectedEmailId(null);
        setShowEmailDetail(false);
      }

      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < minLoadingTime) {
        await new Promise((resolve) =>
          setTimeout(resolve, minLoadingTime - elapsedTime)
        );
      }
    } catch (error) {
      console.error("Failed to load emails:", error);
      toast.error("Failed to load emails");
    } finally {
      setIsLoadingEmails(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingEmails && hasMore) {
      loadEmails(false);
    }
  };

  const handleSelectMailbox = (mailboxId: string) => {
    setSelectedMailboxId(mailboxId);
    setIsMobileMenuOpen(false);
    setIsLoadingEmails(true);
    navigate(`/mailbox/${mailboxId}`);
  };

  const handleSelectEmail = async (emailId: string, mailboxId?: string) => {
    let currentEmails = rawEmails;

    if (mailboxId && mailboxId !== selectedMailboxId) {
      setSelectedMailboxId(mailboxId);
      setIsLoadingEmails(true);
      navigate(`/mailbox/${mailboxId}/${emailId}`);

      try {
        // Force fresh fetch with timestamp to avoid cache
        const response = await emailService.getEmailsByMailbox(
          mailboxId,
          50,
          undefined,
          undefined
        );
        setRawEmails(response.emails);
        currentEmails = response.emails; // Use fresh data immediately
        setNextPageToken(response.nextPageToken);
        setHasMore(!!response.nextPageToken);
      } catch (error) {
        console.error("Failed to load emails for mailbox on selection:", error);
        toast.error("Failed to load mailbox for selected email");
      } finally {
        setIsLoadingEmails(false);
      }
    } else {
      navigate(`/mailbox/${selectedMailboxId}/${emailId}`);
    }

    setSelectedEmailId(emailId);
    setShowEmailDetail(true);

    const email = currentEmails.find((e) => e.id === emailId);
    if (email && !email.messages) {
      try {
        console.log("Fetching email detail on select:", {
          id: email.id,
          threadId: email.threadId,
          workflowEmailId: email.workflowEmailId,
        });
        const detail = await emailService.getEmailById(
          email.threadId,
          mailboxId || selectedMailboxId
        );
        if (detail) {
          setRawEmails((prev) =>
            prev.map((e) => {
              if (e.id === detail.id) {
                return {
                  ...detail,
                  preview: e.preview || detail.preview,
                  isRead:
                    e.workflowEmailId !== undefined ? e.isRead : detail.isRead,
                  isStarred:
                    e.workflowEmailId !== undefined
                      ? e.isStarred
                      : detail.isStarred,
                  workflowEmailId: e.workflowEmailId,
                  snoozedUntil: e.snoozedUntil,
                };
              }
              return e;
            })
          );
        }
      } catch (error) {
        console.error("Failed to fetch email detail on select:", error);
      }
    }

    if (email && !email.isRead) {
      await handleToggleRead([emailId]);
      // Trigger Kanban refresh to update read status in Kanban view
      if (viewMode === "kanban") {
        setKanbanRefreshTrigger((prev) => prev + 1);
      }
    }
  };

  const handleToggleStar = async (emailId: string) => {
    try {
      const email = rawEmails.find((e) => e.id === emailId);
      if (!email) return;

      const newStarred = !email.isStarred;

      setRawEmails(
        rawEmails.map((e) =>
          e.id === emailId ? { ...e, isStarred: newStarred } : e
        )
      );

      try {
        await emailService.toggleStar(email.threadId, email.isStarred);

        try {
          let workflowId = email.workflowEmailId;

          if (!workflowId) {
            const newEmail = await emailService.snoozeEmailByThreadId(
              email.threadId,
              new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000)
            );
            workflowId = newEmail.id;
            await emailService.updateEmailStatus(workflowId, "INBOX");

            setRawEmails((prev) =>
              prev.map((e) =>
                e.id === emailId ? { ...e, workflowEmailId: workflowId } : e
              )
            );
          }

          await emailService.updateEmailStarred(workflowId, newStarred);
        } catch (error) {
          console.warn("Failed to sync star status with workflow DB:", error);
        }

        toast.success(email.isStarred ? "Removed star" : "Added star");
      } catch (error) {
        setRawEmails(
          rawEmails.map((e) =>
            e.id === emailId ? { ...e, isStarred: email.isStarred } : e
          )
        );
        throw error;
      }
    } catch (error) {
      console.error("Failed to toggle star:", error);
      toast.error("Failed to update star");
    }
  };

  const handleDelete = async (emailIds: string[]) => {
    const emailsToDelete = rawEmails.filter((e) => emailIds.includes(e.id));

    setRawEmails((prev) =>
      prev.filter((email) => !emailIds.includes(email.id))
    );
    if (emailIds.includes(selectedEmailId || "")) {
      setSelectedEmailId(null);
      setShowEmailDetail(false);
      navigate(`/mailbox/${selectedMailboxId}`);
    }

    try {
      await Promise.all(
        emailsToDelete.map((email) => emailService.moveToTrash(email.threadId))
      );
      toast.success(`Moved ${emailIds.length} email(s) to trash`);
    } catch (error) {
      console.error("Failed to move to trash:", error);
      toast.error("Failed to move to trash");
      await loadEmails(true);
    }
  };

  const handlePermanentDelete = async (emailIds: string[]) => {
    const emailsToDelete = rawEmails.filter((e) => emailIds.includes(e.id));

    setRawEmails((prev) =>
      prev.filter((email) => !emailIds.includes(email.id))
    );
    if (emailIds.includes(selectedEmailId || "")) {
      setSelectedEmailId(null);
      setShowEmailDetail(false);
      navigate(`/mailbox/${selectedMailboxId}`);
    }

    try {
      await Promise.all(
        emailsToDelete.map((email) => emailService.deleteEmail(email.threadId))
      );
      toast.success(`Permanently deleted ${emailIds.length} email(s)`);
    } catch (error) {
      console.error("Failed to permanently delete:", error);
      toast.error("Failed to permanently delete");
      await loadEmails(true);
    }
  };

  const handleMoveToInbox = async (emailIds: string[]) => {
    const emailsToMove = rawEmails.filter((e) => emailIds.includes(e.id));

    setRawEmails((prev) =>
      prev.filter((email) => !emailIds.includes(email.id))
    );
    if (emailIds.includes(selectedEmailId || "")) {
      setSelectedEmailId(null);
      setShowEmailDetail(false);
      navigate(`/mailbox/${selectedMailboxId}`);
    }

    try {
      await Promise.all(
        emailsToMove.map((email) =>
          emailService.modifyLabels({
            threadId: email.threadId,
            addLabelIds: ["INBOX"],
            removeLabelIds: ["TRASH"],
          })
        )
      );
      toast.success(`Moved ${emailIds.length} email(s) to inbox`);
    } catch (error) {
      console.error("Failed to move to inbox:", error);
      toast.error("Failed to move to inbox");
      await loadEmails(true);
    }
  };

  const handleToggleRead = async (emailIds: string[]) => {
    try {
      const emailsToUpdate = rawEmails.filter((e) => emailIds.includes(e.id));

      setRawEmails(
        rawEmails.map((email) =>
          emailIds.includes(email.id)
            ? { ...email, isRead: !email.isRead }
            : email
        )
      );

      try {
        await Promise.all(
          emailsToUpdate.map((email) => {
            if (email.threadId) {
              return email.isRead
                ? emailService.markAsUnread(email.threadId)
                : emailService.markAsRead(email.threadId);
            }
            return Promise.resolve();
          })
        );

        await Promise.all(
          emailsToUpdate.map(async (email) => {
            try {
              let workflowId = email.workflowEmailId;

              if (!workflowId) {
                const newEmail = await emailService.snoozeEmailByThreadId(
                  email.threadId,
                  new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000)
                );
                workflowId = newEmail.id;
                await emailService.updateEmailStatus(workflowId, "INBOX");

                setRawEmails((prev) =>
                  prev.map((e) =>
                    e.id === email.id
                      ? { ...e, workflowEmailId: workflowId }
                      : e
                  )
                );
              }

              await emailService.updateEmailRead(workflowId, !email.isRead);
            } catch (error) {
              console.warn(
                "Failed to sync read status with workflow DB:",
                error
              );
            }
          })
        );

        toast.success("Updated read status");
      } catch (error) {
        setRawEmails(
          rawEmails.map((email) =>
            emailIds.includes(email.id)
              ? { ...email, isRead: email.isRead }
              : email
          )
        );
        throw error;
      }
    } catch (error) {
      console.error("Failed to toggle read status:", error);
      toast.error("Failed to update read status");
    }
  };

  const handleSnooze = async (
    emailId: string,
    snoozeDate: Date,
    threadId?: string,
    sourceColumn?: string
  ) => {
    try {
      let targetThreadId = threadId;

      if (!targetThreadId) {
        const email = rawEmails.find(
          (e) => e.id === emailId || e.threadId === emailId
        );
        if (!email) {
          console.error("Email not found for snooze");
          toast.error("Could not find email to snooze");
          return;
        }
        targetThreadId = email.threadId;
      }

      // Step 1: Get real SNOOZED label ID and modify labels (current → SNOOZED)
      try {
        const snoozedLabelId = await emailService.getSnoozedLabelId();
        const removeLabels = sourceColumn ? [sourceColumn] : [];

        await emailService.modifyLabels({
          threadId: targetThreadId!,
          addLabelIds: [snoozedLabelId],
          removeLabelIds: removeLabels,
        });
      } catch (modErr) {
        console.warn("Failed to modify labels when snoozing:", modErr);
      }

      // Step 2: Save to workflow database
      await emailService.snoozeEmailByThreadId(targetThreadId!, snoozeDate);

      // Remove from current list if present
      setRawEmails((prev) => prev.filter((e) => e.id !== emailId));

      if (selectedEmailId === emailId) {
        setSelectedEmailId(null);
        setShowEmailDetail(false);
        navigate(`/mailbox/${selectedMailboxId}`);
      }

      toast.success(
        `Email snoozed until ${snoozeDate.toLocaleString("vi-VN", {
          dateStyle: "medium",
          timeStyle: "short",
        })}`
      );

      // Update timer to catch this new snooze if it's the earliest
      setupSmartSnoozeTimer();
    } catch (error) {
      console.error("Failed to snooze email:", error);
      toast.error(
        "Failed to snooze email. Please try opening the email first."
      );
    }
  };

  const handleUnsnooze = async (workflowEmailId: number) => {
    // console.log('handleUnsnooze called with workflowEmailId:', workflowEmailId);
    // console.log('Current rawEmails:', rawEmails.map(e => ({ id: e.id, threadId: e.threadId, workflowEmailId: e.workflowEmailId })));

    try {
      const email = rawEmails.find(
        (e) => e.workflowEmailId === workflowEmailId
      );
      // console.log('Found email to remove:', email);

      // Step 1: Modify labels (SNOOZED → INBOX)
      if (email?.threadId) {
        try {
          const snoozedLabelId = await emailService.getSnoozedLabelId();
          await emailService.modifyLabels({
            threadId: email.threadId,
            addLabelIds: ["INBOX"],
            removeLabelIds: [snoozedLabelId],
          });
        } catch (modErr) {
          console.warn("Failed to modify labels on unsnooze:", modErr);
        }
      }

      // Step 2: Update workflow database
      await emailService.unsnoozeEmail(workflowEmailId);

      if (email) {
        setRawEmails((prev) =>
          prev.filter((e) => e.workflowEmailId !== workflowEmailId)
        );

        if (selectedEmailId === email.id) {
          setSelectedEmailId(null);
          setShowEmailDetail(false);
          navigate(`/mailbox/${selectedMailboxId}`);
        }
      }

      toast.success("Email restored from snooze");
    } catch (error) {
      console.error("Failed to unsnooze email:", error);
      toast.error("Failed to unsnooze email");
    }
  };

  const handleUnsnoozeInKanban = async (workflowEmailId: number) => {
    try {
      await handleUnsnooze(workflowEmailId);
      // Trigger KanbanBoard refresh
      setKanbanRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to unsnooze in Kanban:", error);
    }
  };

  const handleReply = () => {
    const email = emails.find((e) => e.id === selectedEmailId);
    if (email) {
      const replySubject = email.subject.startsWith("Re:")
        ? email.subject
        : `Re: ${email.subject}`;

      const replyBody = `\n\nOn ${new Date(email.timestamp).toLocaleString(
        "en-US",
        {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }
      )}, ${email.from.name} <${
        email.from.email
      }> wrote:\n\n> ${email.body.replace(/\n/g, "\n> ")}`;

      setComposeDefaults({
        to: email.from.email,
        subject: replySubject,
        body: replyBody,
        threadId: email.threadId,
        messageId: email.messageId,
      });
      setIsComposeOpen(true);
    }
  };

  const handleReplyAll = () => {
    const email = emails.find((e) => e.id === selectedEmailId);
    if (email) {
      const replySubject = email.subject.startsWith("Re:")
        ? email.subject
        : `Re: ${email.subject}`;

      const replyBody = `\n\nOn ${new Date(email.timestamp).toLocaleString(
        "en-US",
        {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }
      )}, ${email.from.name} <${
        email.from.email
      }> wrote:\n\n> ${email.body.replace(/\n/g, "\n> ")}`;

      const allRecipients = [
        email.from.email,
        ...email.to.map((r) => r.email),
        ...(email.cc?.map((r) => r.email) || []),
      ].filter((e, i, arr) => arr.indexOf(e) === i);

      setComposeDefaults({
        to: allRecipients.join(", "),
        subject: replySubject,
        body: replyBody,
        threadId: email.threadId,
        messageId: email.messageId,
      });
      setIsComposeOpen(true);
    }
  };

  const handleForward = () => {
    const email = emails.find((e) => e.id === selectedEmailId);
    if (email) {
      const forwardSubject = email.subject.startsWith("Fwd:")
        ? email.subject
        : `Fwd: ${email.subject}`;

      const formattedDate = new Date(email.timestamp).toLocaleString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
      });

      const toRecipients = email.to
        .map((r) => `${r.name} <${r.email}>`)
        .join(", ");

      const forwardBody = `\n\n---------- Forwarded message ---------\nFrom: ${email.from.name} <${email.from.email}>\nDate: ${formattedDate}\nSubject: ${email.subject}\nTo: ${toRecipients}\n\n${email.body}`;

      setComposeDefaults({
        to: "",
        subject: forwardSubject,
        body: forwardBody,
      });
      setIsComposeOpen(true);
    }
  };

  const handleSendEmail = async (emailData: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
    attachments?: File[];
  }) => {
    try {
      await emailService.sendEmail({
        to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject: emailData.subject,
        content: emailData.body,
        isHtml: false,
        attachments: emailData.attachments,
        threadId: composeDefaults.threadId,
        inReplyToMessageId: composeDefaults.messageId,
      });
      toast.success("Email sent successfully");
      setIsComposeOpen(false);
      setComposeDefaults({});
      if (selectedMailboxId === "SENT") {
        await loadEmails();
      }
    } catch (error) {
      console.error("Failed to send email:", error);
      toast.error("Failed to send email");
      throw error;
    }
  };

  const handleEmailMove = async (
    emailId: string,
    targetMailboxId: string,
    sourceMailboxId: string,
    threadId?: string
  ) => {
    // Try to find email in rawEmails first, otherwise use provided threadId
    const email = rawEmails.find((e) => e.id === emailId);
    const emailThreadId = email?.threadId || threadId || emailId;

    if (!emailThreadId) {
      console.error("Cannot move email: no threadId available");
      toast.error("Failed to move email: invalid email data");
      throw new Error("No threadId available");
    }

    try {
      // Determine which labels to add and remove
      const addLabelIds: string[] = [];
      const removeLabelIds: string[] = [];

      // If moving TO a user-created label (not system label)
      const targetMailbox = mailboxes.find((m) => m.id === targetMailboxId);
      const sourceMailbox = mailboxes.find((m) => m.id === sourceMailboxId);

      console.log("[handleEmailMove] Moving email:", {
        emailId,
        threadId: emailThreadId,
        from: sourceMailboxId,
        to: targetMailboxId,
        targetType: targetMailbox?.type,
        sourceType: sourceMailbox?.type,
      });

      // Add the target label
      if (targetMailboxId && !addLabelIds.includes(targetMailboxId)) {
        addLabelIds.push(targetMailboxId);
      }

      // Remove the source label if it's a user label or specific system label
      if (sourceMailbox?.type === "user" || sourceMailbox?.type === "custom") {
        removeLabelIds.push(sourceMailboxId);
      } else if (sourceMailboxId === "INBOX" && targetMailboxId !== "INBOX") {
        // When moving from INBOX to another label, remove INBOX
        removeLabelIds.push("INBOX");
      }

      console.log("[handleEmailMove] Label modifications:", { addLabelIds, removeLabelIds });

      await emailService.modifyLabels({
        threadId: emailThreadId,
        addLabelIds,
        removeLabelIds,
      });

      console.log("[handleEmailMove] ✅ Email moved successfully via API");
      toast.success("Email moved successfully");
    } catch (error) {
      console.error("[handleEmailMove] ❌ Failed to move email:", error);
      toast.error("Failed to move email");
      throw error;
    }
  };

  const handleAddColumn = async () => {
    try {
      let labelId = selectedLabelForColumn;

      if (isCreatingNewLabel) {
        if (!newLabelName.trim()) {
          toast.error("Please enter a label name");
          return;
        }

        const existingLabel = mailboxes.find(
          (m) => m.name.toLowerCase() === newLabelName.trim().toLowerCase()
        );

        if (existingLabel) {
          toast.error(`Label "${newLabelName}" already exists`);
          return;
        }

        const newLabel = await emailService.createLabel(newLabelName.trim());
        labelId = newLabel.id;

        await loadMailboxes();

        toast.success(`Label "${newLabelName}" created successfully`);
      } else {
        if (!labelId) {
          toast.error("Please select a label");
          return;
        }
      }

      // Add column to Kanban board
      if (
        (
          window as typeof window & {
            __kanbanAddColumn?: (id: string) => boolean;
          }
        ).__kanbanAddColumn
      ) {
        const addResult = (
          window as typeof window & {
            __kanbanAddColumn?: (id: string) => boolean;
          }
        ).__kanbanAddColumn!(labelId);

        if (addResult === false) {
          const labelName =
            mailboxes.find((m) => m.id === labelId)?.name || "This label";
          toast.info(`${labelName} is already in the Kanban board`);
          setSelectedLabelForColumn("");
          setNewLabelName("");
          setIsCreatingNewLabel(false);
          setIsAddColumnDialogOpen(false);
          return;
        }
      }

      setSelectedLabelForColumn("");
      setNewLabelName("");
      setIsCreatingNewLabel(false);
      setIsAddColumnDialogOpen(false);

      toast.success("Column added to Kanban board");
    } catch (error) {
      console.error("Failed to add column:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add column";
      toast.error(errorMessage);
    }
  };

  const handleDeleteLabel = async (labelId: string, labelName: string) => {
    try {
      const loadingToast = toast.loading(
        `Moving emails to Inbox and deleting label "${labelName}"...`
      );

      await emailService.deleteLabel(labelId);

      toast.dismiss(loadingToast);
      toast.success(`Label "${labelName}" deleted. All emails moved to Inbox.`);

      await loadMailboxes();

      if (selectedMailboxId === labelId) {
        setSelectedMailboxId("INBOX");
        navigate("/mailbox/INBOX");
        await loadEmails(true);
      }
    } catch (error) {
      console.error("Failed to delete label:", error);
      toast.error(`Failed to delete label "${labelName}"`);
      throw error;
    }
  };

  const handleSearch = async (query: string, isSemantic: boolean = false) => {
    if (!query.trim()) {
      // Clear search and return to normal mode
      setSearchQuery("");
      setIsSearchMode(false);
      loadEmails(true);
      return;
    }

    setIsSearching(true);
    setSearchQuery(query);

    try {
      let searchResults: Email[] = [];

      if (isSemantic) {
        // toast.loading("Performing semantic search...");
        searchResults = await emailService.searchSemanticEmails(query);
      } else {
        // First, sync emails to ensure search index is up to date (for fuzzy search mostly, or keep existing logic)
        // toast.loading("Syncing emails...");
        await emailService.syncEmails();

        // Then perform the search
        toast.message("Searching..."); // changed from loading to message to avoid conflict or just update text
        searchResults = await emailService.searchEmails(query);
      }

      toast.dismiss();

      setRawEmails(searchResults);
      setIsSearchMode(true);
      setSelectedEmailId(null);

      if (searchResults.length === 0) {
        toast.info(
          isSemantic ? "No emails found matching meaning" : "No emails found"
        );
      } else {
        toast.success(
          `Found ${searchResults.length} email${
            searchResults.length === 1 ? "" : "s"
          }`
        );
      }
    } catch (error) {
      console.error("Search failed:", error);
      toast.dismiss();
      toast.error("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setIsSearchMode(false);
    setSelectedEmailId(null);
    loadEmails(true);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed");
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const selectedEmail = emails.find((e) => e.id === selectedEmailId) || null;

  return (
    <div className="h-screen flex flex-col">
      {/* Mobile Header */}
      <div className="lg:hidden border-b bg-white p-4 flex items-center gap-3">
        {showEmailDetail ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowEmailDetail(false);
                navigate(`/mailbox/${selectedMailboxId}`);
              }}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </>
        ) : (
          <>
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <MailboxList
                  mailboxes={mailboxes}
                  selectedMailboxId={selectedMailboxId}
                  onSelectMailbox={handleSelectMailbox}
                  isLoading={isLoadingMailboxes}
                />
              </SheetContent>
            </Sheet>
            <h1 className="text-lg font-semibold flex-1">
              {isSearchMode
                ? `Search (${emails.length})`
                : mailboxes.find((m) => m.id === selectedMailboxId)?.name ||
                  "Inbox"}
            </h1>
            {isSearchMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSearch}
                className="text-xs"
              >
                Clear
              </Button>
            )}
            {/* View Mode Toggle - Mobile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setViewMode(viewMode === "list" ? "kanban" : "list")
              }
              className="h-8 w-8 p-0"
            >
              {viewMode === "list" ? (
                <LayoutGrid className="h-4 w-4" />
              ) : (
                <List className="h-4 w-4" />
              )}
            </Button>
            {/* User Menu - Mobile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {user ? getUserInitials(user.name) : "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.name}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setViewMode("kanban");
                    setSelectedEmailId(null);
                    setShowEmailDetail(false);
                    navigate(`/mailbox/${selectedMailboxId}`);
                  }}
                >
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  Kanban View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Mobile Search Bar - Always visible on mobile in list view */}
      {viewMode === "list" && !showEmailDetail && (
        <div className="lg:hidden p-3 border-b bg-background">
          <SearchBar
            emails={emails}
            onSearch={handleSearch}
            isSearching={isSearching}
          />
        </div>
      )}

      {/* Desktop/Tablet Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Column 1: Mailboxes (Desktop only, hidden in Kanban mode) */}
        {viewMode !== "kanban" && (
          <div className="hidden lg:block w-64">
            <MailboxList
              mailboxes={mailboxes}
              selectedMailboxId={selectedMailboxId}
              onSelectMailbox={handleSelectMailbox}
              onDeleteLabel={handleDeleteLabel}
              isLoading={isLoadingMailboxes}
            />
          </div>
        )}

        {/* Kanban View (Full width when active) */}
        {viewMode === "kanban" ? (
          <div className="flex-1 min-w-0 flex flex-col">
            {/* View Toggle Bar */}
            <div className="hidden lg:flex items-center justify-between p-4 border-b bg-background">
              <h2 className="text-lg font-semibold">Kanban Board</h2>
              <div className="flex items-center gap-2">
                <Dialog
                  open={isAddColumnDialogOpen}
                  onOpenChange={setIsAddColumnDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Column
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Column to Kanban Board</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={!isCreatingNewLabel ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setIsCreatingNewLabel(false);
                            setNewLabelName("");
                          }}
                          className="flex-1"
                        >
                          Existing Label
                        </Button>
                        <Button
                          type="button"
                          variant={isCreatingNewLabel ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setIsCreatingNewLabel(true);
                            setSelectedLabelForColumn("");
                          }}
                          className="flex-1"
                        >
                          Create New
                        </Button>
                      </div>

                      {!isCreatingNewLabel ? (
                        <div className="space-y-2">
                          <Label
                            htmlFor="label-select"
                            className="text-sm font-medium"
                          >
                            Select a label to add as column
                          </Label>
                          <select
                            id="label-select"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={selectedLabelForColumn}
                            onChange={(e) =>
                              setSelectedLabelForColumn(e.target.value)
                            }
                          >
                            <option value="">Choose a label...</option>
                            {mailboxes
                              .filter((m) => !["INBOX"].includes(m.id))
                              .map((mailbox) => (
                                <option key={mailbox.id} value={mailbox.id}>
                                  {mailbox.name}
                                </option>
                              ))}
                          </select>
                          <p className="text-xs text-muted-foreground">
                            Select an existing label to add as a column
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label
                            htmlFor="new-label-name"
                            className="text-sm font-medium"
                          >
                            New label name
                          </Label>
                          <input
                            id="new-label-name"
                            type="text"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Enter label name..."
                            value={newLabelName}
                            onChange={(e) => setNewLabelName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newLabelName.trim()) {
                                handleAddColumn();
                              }
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            Create a new label and add it as a column
                          </p>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsAddColumnDialogOpen(false);
                            setSelectedLabelForColumn("");
                            setNewLabelName("");
                            setIsCreatingNewLabel(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAddColumn}
                          disabled={
                            !isCreatingNewLabel
                              ? !selectedLabelForColumn
                              : !newLabelName.trim()
                          }
                        >
                          {isCreatingNewLabel ? "Create & Add" : "Add Column"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setViewMode("list");
                    setSelectedEmailId(null);
                    setShowEmailDetail(false);
                    navigate(`/mailbox/${selectedMailboxId}`);
                  }}
                  className="gap-2"
                >
                  <List className="h-4 w-4" />
                  List View
                </Button>
              </div>
            </div>
            {/* Kanban Board */}
            <div className="flex-1 min-h-0">
              <KanbanBoard
                mailboxes={mailboxes}
                selectedEmailId={selectedEmailId}
                onEmailSelect={handleSelectEmail}
                onEmailMove={handleEmailMove}
                onSnooze={handleSnooze}
                onUnsnooze={handleUnsnooze}
                refreshTrigger={kanbanRefreshTrigger}
                filters={filters}
                onLabelRename={loadMailboxes}
              />
            </div>
            {/* Email Detail Modal/Sheet */}
            {selectedEmail && (
              <Sheet
                open={!!selectedEmailId}
                onOpenChange={(open) => !open && setSelectedEmailId(null)}
              >
                <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
                  <div className="hidden">
                    <SheetTitle>Email Details</SheetTitle>
                    <SheetDescription>
                      View and manage email details
                    </SheetDescription>
                  </div>
                  <EmailDetail
                    email={selectedEmail}
                    mailboxId={selectedMailboxId}
                    selectedMailbox={mailboxes.find(
                      (m) => m.id === selectedMailboxId
                    )}
                    onReply={handleReply}
                    onReplyAll={handleReplyAll}
                    onForward={handleForward}
                    onDelete={() =>
                      selectedEmailId && handleDelete([selectedEmailId])
                    }
                    onPermanentDelete={() =>
                      selectedEmailId &&
                      handlePermanentDelete([selectedEmailId])
                    }
                    onMoveToInbox={() =>
                      selectedEmailId && handleMoveToInbox([selectedEmailId])
                    }
                    onToggleRead={() =>
                      selectedEmailId && handleToggleRead([selectedEmailId])
                    }
                    onToggleStar={() =>
                      selectedEmailId && handleToggleStar(selectedEmailId)
                    }
                    onSnooze={handleSnooze}
                    onUnsnooze={handleUnsnoozeInKanban}
                  />
                </SheetContent>
              </Sheet>
            )}
          </div>
        ) : (
          <>
            {/* Column 2: Email List (Hidden on mobile when detail is shown) */}
            <div
              className={`${
                showEmailDetail ? "hidden lg:flex" : "flex-1 min-w-0"
              } lg:flex-1 lg:min-w-0 flex flex-col`}
            >
              {/* View Toggle Bar - Desktop */}
              <div className="hidden lg:flex items-center justify-between p-4 border-b bg-background">
                <h2 className="text-lg font-semibold">
                  {isSearchMode
                    ? `Search Results (${emails.length})`
                    : mailboxes.find((m) => m.id === selectedMailboxId)?.name ||
                      "Inbox"}
                </h2>
                <div className="flex items-center gap-2">
                  {isSearchMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearSearch}
                      className="gap-2"
                    >
                      Clear Search
                    </Button>
                  )}
                  {!isSearchMode && (
                    <EmailFilters
                      filters={filters}
                      onFiltersChange={setFilters}
                      onClear={() => {
                        // Reset filters to default without reloading page
                        const defaultFilters = {
                          sort: "newest" as const,
                          unreadOnly: false,
                          hasAttachments: false,
                        };
                        setFilters(defaultFilters);
                        localStorage.removeItem("email-filters");
                      }}
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setViewMode("kanban");
                      setSelectedEmailId(null);
                      setShowEmailDetail(false);
                      navigate(`/mailbox/${selectedMailboxId}`);
                    }}
                    className="gap-2"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Kanban View
                  </Button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="p-4 border-b bg-background">
                <SearchBar
                  emails={emails}
                  onSearch={handleSearch}
                  isSearching={isSearching}
                />
              </div>

              <div className="flex-1 min-h-0">
                <EmailList
                  emails={emails}
                  selectedEmailId={selectedEmailId}
                  mailboxId={selectedMailboxId}
                  onSelectEmail={handleSelectEmail}
                  onToggleStar={handleToggleStar}
                  onRefresh={() =>
                    isSearchMode ? handleClearSearch() : loadEmails(true)
                  }
                  onCompose={() => setIsComposeOpen(true)}
                  onDelete={handleDelete}
                  onPermanentDelete={handlePermanentDelete}
                  onMoveToInbox={handleMoveToInbox}
                  onToggleRead={handleToggleRead}
                  isLoading={isLoadingEmails || isSearching}
                  hasMore={hasMore && !isSearchMode}
                  onLoadMore={handleLoadMore}
                />
              </div>
            </div>

            {/* Column 3: Email Detail (Mobile: full screen when shown, Desktop: always visible) */}
            <div
              className={`${
                showEmailDetail
                  ? "flex-1"
                  : "hidden lg:block lg:flex-1 lg:min-w-0"
              }`}
            >
              <EmailDetail
                email={selectedEmail}
                mailboxId={selectedMailboxId}
                selectedMailbox={mailboxes.find(
                  (m) => m.id === selectedMailboxId
                )}
                onReply={handleReply}
                onReplyAll={handleReplyAll}
                onForward={handleForward}
                onDelete={() =>
                  selectedEmailId && handleDelete([selectedEmailId])
                }
                onPermanentDelete={() =>
                  selectedEmailId && handlePermanentDelete([selectedEmailId])
                }
                onMoveToInbox={() =>
                  selectedEmailId && handleMoveToInbox([selectedEmailId])
                }
                onToggleRead={() =>
                  selectedEmailId && handleToggleRead([selectedEmailId])
                }
                onToggleStar={() =>
                  selectedEmailId && handleToggleStar(selectedEmailId)
                }
                onSnooze={handleSnooze}
                onUnsnooze={handleUnsnooze}
              />
            </div>
          </>
        )}
      </div>

      <ComposeEmailModal
        isOpen={isComposeOpen}
        onClose={() => {
          setIsComposeOpen(false);
          setComposeDefaults({});
        }}
        onSend={handleSendEmail}
        defaultTo={composeDefaults.to}
        defaultSubject={composeDefaults.subject}
        defaultBody={composeDefaults.body}
      />
    </div>
  );
}
