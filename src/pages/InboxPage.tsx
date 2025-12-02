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
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, ArrowLeft, LogOut } from 'lucide-react';

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
  
  // Loading and pagination states
  const [isLoadingMailboxes, setIsLoadingMailboxes] = useState(true);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  // Load mailboxes on mount
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

  // Load emails when mailbox changes
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
        // get next
        if (index < emailsToPrefetch.length) {
          current = emailsToPrefetch[index++];
        } else {
          break;
        }

        if (!current) break;

        if (mailboxIdForPrefetch !== selectedMailboxId) return;

        if (current.messages && current.messages.length > 0) continue;

        try {
          const detail = await emailService.getEmailById(current.threadId);
          if (detail) {
            setEmails(prev => {
              if (mailboxIdForPrefetch !== selectedMailboxId) return prev;
              return prev.map(e => e.id === detail.id ? { ...detail, preview: e.preview || detail.preview } : e);
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
      
      if (reset) {
        setEmails(response.emails);
      } else {
        setEmails(prev => [...prev, ...response.emails]);
      }

      // Start background prefetch of details (limited concurrency). Do not block UI.
      // We pass the mailbox id so we avoid merging results if user navigates away.
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

    // If we don't have full detail yet, fetch it immediately so detail pane can show.
    const email = emails.find(e => e.id === emailId);
    if (email && !email.messages) {
      (async () => {
        try {
          const detail = await emailService.getEmailById(email.threadId);
          if (detail) {
            setEmails(prev => prev.map(e => e.id === detail.id ? { ...detail, preview: e.preview || detail.preview } : e));
          }
        } catch (error) {
          console.error('Failed to fetch email detail on select:', error);
        }
      })();
    }

    // Mark as read when opened (works with threadId even if detail not present)
    if (email && !email.isRead) {
      handleToggleRead([emailId]);
    }
  };

  const handleToggleStar = async (emailId: string) => {
    try {
      const email = emails.find(e => e.id === emailId);
      if (email) {
        await emailService.toggleStar(email.threadId, email.isStarred);
        setEmails(emails.map(e => 
          e.id === emailId 
            ? { ...e, isStarred: !e.isStarred }
            : e
        ));
        toast.success(email.isStarred ? 'Removed star' : 'Added star');
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
      await Promise.all(emailIds.map(id => {
        const email = emails.find(e => e.id === id);
        if (email) {
          return email.isRead 
            ? emailService.markAsUnread(email.threadId)
            : emailService.markAsRead(email.threadId);
        }
        return Promise.resolve();
      }));
      
      setEmails(emails.map(email => 
        emailIds.includes(email.id)
          ? { ...email, isRead: !email.isRead }
          : email
      ));
      toast.success('Updated read status');
    } catch (error) {
      console.error('Failed to toggle read status:', error);
      toast.error('Failed to update read status');
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
        {/* Column 1: Mailboxes (Desktop only) */}
        <div className="hidden lg:block w-64">
          <MailboxList
            mailboxes={mailboxes}
            selectedMailboxId={selectedMailboxId}
            onSelectMailbox={handleSelectMailbox}
            isLoading={isLoadingMailboxes}
          />
        </div>

        {/* Column 2: Email List (Hidden on mobile when detail is shown) */}
        <div className={`${showEmailDetail ? 'hidden lg:block' : 'flex-1 min-w-0'} lg:flex-1 lg:min-w-0`}>
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
          />
        </div>
      </div>

      {/* Compose Email Modal */}
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
