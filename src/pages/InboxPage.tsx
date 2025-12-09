import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { Mailbox, Email } from '@/types/email';
import { emailService } from '@/services/emailService';
import { MailboxList } from '@/components/dashboard/MailboxList';
import { EmailList } from '@/components/dashboard/EmailList';
import { EmailDetail } from '@/components/dashboard/EmailDetail';
import { ComposeEmailModal } from '@/components/dashboard/ComposeEmailModal';
import { KanbanBoard } from '@/components/dashboard/KanbanBoard';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, ArrowLeft, LogOut, LayoutGrid, List, Plus } from 'lucide-react';

export function InboxPage() {
  const navigate = useNavigate();
  const { mailboxId: urlMailboxId, emailId: urlEmailId } = useParams<{ mailboxId: string; emailId?: string }>();
  const { user, logout } = useAuth();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>(urlMailboxId || 'INBOX');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(urlEmailId || null);
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
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [isAddColumnDialogOpen, setIsAddColumnDialogOpen] = useState(false);
  const [selectedLabelForColumn, setSelectedLabelForColumn] = useState('');
  
  const [isLoadingMailboxes, setIsLoadingMailboxes] = useState(true);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadMailboxes();
  }, []);

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
    loadEmails(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMailboxId]);

  const prefetchEmailDetails = async (emailsToPrefetch: Email[], mailboxIdForPrefetch: string) => {
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
          console.log('Prefetching email detail:', { id: current.id, threadId: current.threadId, workflowEmailId: current.workflowEmailId });
          const detail = await emailService.getEmailById(current.threadId);
          if (detail) {
            setEmails(prev => {
              if (mailboxIdForPrefetch !== selectedMailboxId) return prev;
              return prev.map(e => {
                if (e.id === detail.id) {
                  return { 
                    ...detail, 
                    preview: e.preview || detail.preview,
                    isRead: e.workflowEmailId !== undefined ? e.isRead : detail.isRead,
                    isStarred: e.workflowEmailId !== undefined ? e.isStarred : detail.isStarred,
                    workflowEmailId: e.workflowEmailId, 
                    snoozedUntil: e.snoozedUntil, 
                  };
                }
                return e;
              });
            });
          }
        } catch (error) {
          console.error('Prefetch detail failed for', current.threadId, error);
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, emailsToPrefetch.length) }, () => worker());
    await Promise.all(workers);
  };

  const loadMailboxes = async () => {
    setIsLoadingMailboxes(true);
    try {
      const data = await emailService.getMailboxes();
      setMailboxes(data);
    } catch (error) {
      console.error('Failed to load mailboxes:', error);
      toast.error('Failed to load mailboxes');
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
        pageToken
      );
      
      console.log(`Loaded emails for ${selectedMailboxId}:`, response.emails);
      
      if (reset) {
        setEmails(response.emails);
      } else {
        setEmails(prev => [...prev, ...response.emails]);
      }

      prefetchEmailDetails(response.emails, selectedMailboxId).catch(err => console.error('Background prefetch error', err));
      
      setNextPageToken(response.nextPageToken);
      setHasMore(!!response.nextPageToken);
      
      if (reset) {
        setSelectedEmailId(null);
        setShowEmailDetail(false);
      }
      
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < minLoadingTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime));
      }
    } catch (error) {
      console.error('Failed to load emails:', error);
      toast.error('Failed to load emails');
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

  const handleSelectEmail = (emailId: string) => {
    setSelectedEmailId(emailId);
    setShowEmailDetail(true);
    navigate(`/mailbox/${selectedMailboxId}/${emailId}`);

    const email = emails.find(e => e.id === emailId);
    if (email && !email.messages) {
      (async () => {
        try {
          console.log('Fetching email detail on select:', { id: email.id, threadId: email.threadId, workflowEmailId: email.workflowEmailId });
          const detail = await emailService.getEmailById(email.threadId);
          if (detail) {
            setEmails(prev => prev.map(e => {
              if (e.id === detail.id) {
                return { 
                  ...detail, 
                  preview: e.preview || detail.preview,
                  isRead: e.workflowEmailId !== undefined ? e.isRead : detail.isRead,
                  isStarred: e.workflowEmailId !== undefined ? e.isStarred : detail.isStarred,
                  workflowEmailId: e.workflowEmailId, 
                  snoozedUntil: e.snoozedUntil, 
                };
              }
              return e;
            }));
          }
        } catch (error) {
          console.error('Failed to fetch email detail on select:', error);
        }
      })();
    }

    if (email && !email.isRead) {
      handleToggleRead([emailId]);
    }
  };

  const handleToggleStar = async (emailId: string) => {
    try {
      const email = emails.find(e => e.id === emailId);
      if (!email) return;
      
      const newStarred = !email.isStarred;
      
      setEmails(emails.map(e => 
        e.id === emailId 
          ? { ...e, isStarred: newStarred }
          : e
      ));
      
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
            await emailService.updateEmailStatus(workflowId, 'INBOX');
            
            setEmails(prev => prev.map(e =>
              e.id === emailId ? { ...e, workflowEmailId: workflowId } : e
            ));
          }
          
          await emailService.updateEmailStarred(workflowId, newStarred);
        } catch (error) {
          console.warn('Failed to sync star status with workflow DB:', error);
        }
        
        toast.success(email.isStarred ? 'Removed star' : 'Added star');
      } catch (error) {
        setEmails(emails.map(e => 
          e.id === emailId 
            ? { ...e, isStarred: email.isStarred }
            : e
        ));
        throw error;
      }
    } catch (error) {
      console.error('Failed to toggle star:', error);
      toast.error('Failed to update star');
    }
  };

  const handleDelete = async (emailIds: string[]) => {
    const emailsToDelete = emails.filter(e => emailIds.includes(e.id));
    
    setEmails(prev => prev.filter(email => !emailIds.includes(email.id)));
    if (emailIds.includes(selectedEmailId || '')) {
      setSelectedEmailId(null);
      setShowEmailDetail(false);
      navigate(`/mailbox/${selectedMailboxId}`);
    }

    try {
      await Promise.all(emailsToDelete.map(email => 
        emailService.moveToTrash(email.threadId)
      ));
      toast.success(`Moved ${emailIds.length} email(s) to trash`);
    } catch (error) {
      console.error('Failed to move to trash:', error);
      toast.error('Failed to move to trash');
      await loadEmails(true);
    }
  };

  const handlePermanentDelete = async (emailIds: string[]) => {
    const emailsToDelete = emails.filter(e => emailIds.includes(e.id));
    
    setEmails(prev => prev.filter(email => !emailIds.includes(email.id)));
    if (emailIds.includes(selectedEmailId || '')) {
      setSelectedEmailId(null);
      setShowEmailDetail(false);
      navigate(`/mailbox/${selectedMailboxId}`);
    }

    try {
      await Promise.all(emailsToDelete.map(email => 
        emailService.deleteEmail(email.threadId)
      ));
      toast.success(`Permanently deleted ${emailIds.length} email(s)`);
    } catch (error) {
      console.error('Failed to permanently delete:', error);
      toast.error('Failed to permanently delete');
      await loadEmails(true);
    }
  };

  const handleMoveToInbox = async (emailIds: string[]) => {
    const emailsToMove = emails.filter(e => emailIds.includes(e.id));
    
    setEmails(prev => prev.filter(email => !emailIds.includes(email.id)));
    if (emailIds.includes(selectedEmailId || '')) {
      setSelectedEmailId(null);
      setShowEmailDetail(false);
      navigate(`/mailbox/${selectedMailboxId}`);
    }

    try {
      await Promise.all(emailsToMove.map(email => 
        emailService.modifyLabels({
          threadId: email.threadId,
          addLabelIds: ['INBOX'],
          removeLabelIds: ['TRASH'],
        })
      ));
      toast.success(`Moved ${emailIds.length} email(s) to inbox`);
    } catch (error) {
      console.error('Failed to move to inbox:', error);
      toast.error('Failed to move to inbox');
      await loadEmails(true);
    }
  };

  const handleToggleRead = async (emailIds: string[]) => {
    try {
      const emailsToUpdate = emails.filter(e => emailIds.includes(e.id));
      
      setEmails(emails.map(email => 
        emailIds.includes(email.id)
          ? { ...email, isRead: !email.isRead }
          : email
      ));
      
      try {
        await Promise.all(emailsToUpdate.map(email => {
          if (email.threadId) {
            return email.isRead 
              ? emailService.markAsUnread(email.threadId)
              : emailService.markAsRead(email.threadId);
          }
          return Promise.resolve();
        }));
        
        await Promise.all(emailsToUpdate.map(async email => {
          try {
            let workflowId = email.workflowEmailId;
            
            if (!workflowId) {
              const newEmail = await emailService.snoozeEmailByThreadId(
                email.threadId,
                new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) 
              );
              workflowId = newEmail.id;
              await emailService.updateEmailStatus(workflowId, 'INBOX');
              
              setEmails(prev => prev.map(e =>
                e.id === email.id ? { ...e, workflowEmailId: workflowId } : e
              ));
            }
            
            await emailService.updateEmailRead(workflowId, !email.isRead);
          } catch (error) {
            console.warn('Failed to sync read status with workflow DB:', error);
          }
        }));
        
        toast.success('Updated read status');
      } catch (error) {
        setEmails(emails.map(email => 
          emailIds.includes(email.id)
            ? { ...email, isRead: email.isRead }
            : email
        ));
        throw error;
      }
    } catch (error) {
      console.error('Failed to toggle read status:', error);
      toast.error('Failed to update read status');
    }
  };

  const handleSnooze = async (emailId: string, snoozeDate: Date) => {
    try {
      const email = emails.find(e => e.id === emailId);
      if (!email) return;

      await emailService.snoozeEmailByThreadId(email.threadId, snoozeDate);
      
      setEmails(prev => prev.filter(e => e.id !== emailId));
      
      if (selectedEmailId === emailId) {
        setSelectedEmailId(null);
        setShowEmailDetail(false);
        navigate(`/mailbox/${selectedMailboxId}`);
      }
      
      toast.success(`Email snoozed until ${snoozeDate.toLocaleString('vi-VN', { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
      })}`);
    } catch (error) {
      console.error('Failed to snooze email:', error);
      toast.error('Failed to snooze email. Please try opening the email first.');
    }
  };

  const handleUnsnooze = async (workflowEmailId: number) => {
    // console.log('handleUnsnooze called with workflowEmailId:', workflowEmailId);
    // console.log('Current emails:', emails.map(e => ({ id: e.id, threadId: e.threadId, workflowEmailId: e.workflowEmailId })));
    
    try {
      await emailService.unsnoozeEmail(workflowEmailId);

      const email = emails.find(e => e.workflowEmailId === workflowEmailId);
      // console.log('Found email to remove:', email);
      
      if (email) {
        setEmails(prev => prev.filter(e => e.workflowEmailId !== workflowEmailId));

        if (selectedEmailId === email.id) {
          setSelectedEmailId(null);
          setShowEmailDetail(false);
          navigate(`/mailbox/${selectedMailboxId}`);
        }
      }

      toast.success('Email restored from snooze');
    } catch (error) {
      console.error('Failed to unsnooze email:', error);
      toast.error('Failed to unsnooze email');
    }
  };

  const handleReply = () => {
    const email = emails.find(e => e.id === selectedEmailId);
    if (email) {
      const replySubject = email.subject.startsWith('Re:') 
        ? email.subject 
        : `Re: ${email.subject}`;
      
      const replyBody = `\n\nOn ${new Date(email.timestamp).toLocaleString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      })}, ${email.from.name} <${email.from.email}> wrote:\n\n> ${email.body.replace(/\n/g, '\n> ')}`;
      
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
    const email = emails.find(e => e.id === selectedEmailId);
    if (email) {
      const replySubject = email.subject.startsWith('Re:') 
        ? email.subject 
        : `Re: ${email.subject}`;
      
      const replyBody = `\n\nOn ${new Date(email.timestamp).toLocaleString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      })}, ${email.from.name} <${email.from.email}> wrote:\n\n> ${email.body.replace(/\n/g, '\n> ')}`;
      
      const allRecipients = [
        email.from.email,
        ...email.to.map(r => r.email),
        ...(email.cc?.map(r => r.email) || [])
      ].filter((e, i, arr) => arr.indexOf(e) === i);
      
      setComposeDefaults({
        to: allRecipients.join(', '),
        subject: replySubject,
        body: replyBody,
        threadId: email.threadId,
        messageId: email.messageId,
      });
      setIsComposeOpen(true);
    }
  };

  const handleForward = () => {
    const email = emails.find(e => e.id === selectedEmailId);
    if (email) {
      const forwardSubject = email.subject.startsWith('Fwd:') 
        ? email.subject 
        : `Fwd: ${email.subject}`;
      
      const formattedDate = new Date(email.timestamp).toLocaleString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: false
      });
      
      const toRecipients = email.to.map(r => `${r.name} <${r.email}>`).join(', ');
      
      const forwardBody = `\n\n---------- Forwarded message ---------\nFrom: ${email.from.name} <${email.from.email}>\nDate: ${formattedDate}\nSubject: ${email.subject}\nTo: ${toRecipients}\n\n${email.body}`;
      
      setComposeDefaults({
        to: '',
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
      toast.success('Email sent successfully');
      setIsComposeOpen(false);
      setComposeDefaults({}); 
      if (selectedMailboxId === 'SENT') {
        await loadEmails();
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      toast.error('Failed to send email');
      throw error;
    }
  };

  const handleEmailMove = async (emailId: string, targetMailboxId: string, sourceMailboxId: string) => {
    const email = emails.find(e => e.id === emailId);
    if (!email) return;

    try {
      await emailService.modifyLabels({
        threadId: email.threadId,
        addLabelIds: [targetMailboxId],
        removeLabelIds: [sourceMailboxId],
      });
      
      toast.success('Email moved successfully');
    } catch (error) {
      console.error('Failed to move email:', error);
      toast.error('Failed to move email');
      throw error;
    }
  };

  const handleAddColumn = () => {
    if (!selectedLabelForColumn) return;
    
    if ((window as typeof window & { __kanbanAddColumn?: (id: string) => void }).__kanbanAddColumn) {
      (window as typeof window & { __kanbanAddColumn?: (id: string) => void }).__kanbanAddColumn!(selectedLabelForColumn);
    }
    
    setSelectedLabelForColumn('');
    setIsAddColumnDialogOpen(false);
    toast.success('Column added to Kanban board');
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const selectedEmail = emails.find(e => e.id === selectedEmailId) || null;

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
              {mailboxes.find(m => m.id === selectedMailboxId)?.name || 'Inbox'}
            </h1>
            {/* View Mode Toggle - Mobile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode(viewMode === 'list' ? 'kanban' : 'list')}
              className="h-8 w-8 p-0"
            >
              {viewMode === 'list' ? (
                <LayoutGrid className="h-4 w-4" />
              ) : (
                <List className="h-4 w-4" />
              )}
            </Button>
            {/* User Menu - Mobile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {user ? getUserInitials(user.name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Desktop/Tablet Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Column 1: Mailboxes (Desktop only, hidden in Kanban mode) */}
        {viewMode !== 'kanban' && (
          <div className="hidden lg:block w-64">
            <MailboxList
              mailboxes={mailboxes}
              selectedMailboxId={selectedMailboxId}
              onSelectMailbox={handleSelectMailbox}
              isLoading={isLoadingMailboxes}
            />
          </div>
        )}

        {/* Kanban View (Full width when active) */}
        {viewMode === 'kanban' ? (
          <div className="flex-1 min-w-0 flex flex-col">
            {/* View Toggle Bar */}
            <div className="hidden lg:flex items-center justify-between p-4 border-b bg-background">
              <h2 className="text-lg font-semibold">Kanban Board</h2>
              <div className="flex items-center gap-2">
                <Dialog open={isAddColumnDialogOpen} onOpenChange={setIsAddColumnDialogOpen}>
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
                      <div className="space-y-2">
                        <Label htmlFor="label-select" className="text-sm font-medium">
                          Select a label to add as column
                        </Label>
                        <select
                          id="label-select"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={selectedLabelForColumn}
                          onChange={(e) => setSelectedLabelForColumn(e.target.value)}
                        >
                          <option value="">Choose a column...</option>
                          {[
                            { id: 'TO_DO', name: 'To Do' },
                            { id: 'IN_PROGRESS', name: 'In Progress' },
                            { id: 'DONE', name: 'Done' },
                            { id: 'SNOOZED', name: 'Snoozed' },
                          ].map(column => (
                            <option key={column.id} value={column.id}>
                              {column.name}
                            </option>
                          ))
                          }
                        </select>
                        <p className="text-xs text-muted-foreground">
                          Available workflow columns. INBOX is the default column.
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsAddColumnDialogOpen(false);
                            setSelectedLabelForColumn('');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAddColumn}
                          disabled={!selectedLabelForColumn}
                        >
                          Add Column
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode('list')}
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
              />
            </div>
            {/* Email Detail Modal/Sheet */}
            {selectedEmail && (
              <Sheet open={!!selectedEmailId} onOpenChange={(open) => !open && setSelectedEmailId(null)}>
                <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
                  <EmailDetail
                    email={selectedEmail}
                    mailboxId={selectedMailboxId}
                    onReply={handleReply}
                    onReplyAll={handleReplyAll}
                    onForward={handleForward}
                    onDelete={() => selectedEmailId && handleDelete([selectedEmailId])}
                    onPermanentDelete={() => selectedEmailId && handlePermanentDelete([selectedEmailId])}
                    onMoveToInbox={() => selectedEmailId && handleMoveToInbox([selectedEmailId])}
                    onToggleRead={() => selectedEmailId && handleToggleRead([selectedEmailId])}
                    onToggleStar={() => selectedEmailId && handleToggleStar(selectedEmailId)}
                    onSnooze={handleSnooze}
                    onUnsnooze={handleUnsnooze}
                  />
                </SheetContent>
              </Sheet>
            )}
          </div>
        ) : (
          <>
            {/* Column 2: Email List (Hidden on mobile when detail is shown) */}
            <div className={`${showEmailDetail ? 'hidden lg:block' : 'flex-1 min-w-0'} lg:flex-1 lg:min-w-0 flex flex-col`}>
              {/* View Toggle Bar - Desktop */}
              <div className="hidden lg:flex items-center justify-between p-4 border-b bg-background">
                <h2 className="text-lg font-semibold">
                  {mailboxes.find(m => m.id === selectedMailboxId)?.name || 'Inbox'}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode('kanban')}
                  className="gap-2"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Kanban View
                </Button>
              </div>
              <div className="flex-1 min-h-0">
                <EmailList
                  emails={emails}
                  selectedEmailId={selectedEmailId}
                  mailboxId={selectedMailboxId}
                  onSelectEmail={handleSelectEmail}
                  onToggleStar={handleToggleStar}
                  onRefresh={() => loadEmails(true)}
                  onCompose={() => setIsComposeOpen(true)}
                  onDelete={handleDelete}
                  onPermanentDelete={handlePermanentDelete}
                  onMoveToInbox={handleMoveToInbox}
                  onToggleRead={handleToggleRead}
                  isLoading={isLoadingEmails}
                  hasMore={hasMore}
                  onLoadMore={handleLoadMore}
                />
              </div>
            </div>

            {/* Column 3: Email Detail (Mobile: full screen when shown, Desktop: always visible) */}
            <div className={`${showEmailDetail ? 'flex-1' : 'hidden lg:block lg:flex-1 lg:min-w-0'}`}>
              <EmailDetail
                email={selectedEmail}
                mailboxId={selectedMailboxId}
                onReply={handleReply}
                onReplyAll={handleReplyAll}
                onForward={handleForward}
                onDelete={() => selectedEmailId && handleDelete([selectedEmailId])}
                onPermanentDelete={() => selectedEmailId && handlePermanentDelete([selectedEmailId])}
                onMoveToInbox={() => selectedEmailId && handleMoveToInbox([selectedEmailId])}
                onToggleRead={() => selectedEmailId && handleToggleRead([selectedEmailId])}
                onToggleStar={() => selectedEmailId && handleToggleStar(selectedEmailId)}
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
