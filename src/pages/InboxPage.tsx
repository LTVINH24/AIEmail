import { useState, useEffect } from 'react';
import type { Mailbox, Email } from '@/types/email';
import { emailService } from '@/services/emailService';
import { MailboxList } from '@/components/MailboxList';
import { EmailList } from '@/components/EmailList';
import { EmailDetail } from '@/components/EmailDetail';
import { ComposeEmailModal } from '@/components/ComposeEmailModal';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, ArrowLeft } from 'lucide-react';

export function InboxPage() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('inbox');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showEmailDetail, setShowEmailDetail] = useState(false);

  // Load mailboxes on mount
  useEffect(() => {
    loadMailboxes();
  }, []);

  // Load emails when mailbox changes
  useEffect(() => {
    loadEmails();
  }, [selectedMailboxId]);

  const loadMailboxes = async () => {
    try {
      const data = await emailService.getMailboxes();
      setMailboxes(data);
    } catch (error) {
      console.error('Failed to load mailboxes:', error);
    }
  };

  const loadEmails = async () => {
    try {
      const response = await emailService.getEmailsByMailbox(selectedMailboxId);
      setEmails(response.emails);
      setSelectedEmailId(null);
      setShowEmailDetail(false);
    } catch (error) {
      console.error('Failed to load emails:', error);
    }
  };

  const handleSelectMailbox = (mailboxId: string) => {
    setSelectedMailboxId(mailboxId);
    setIsMobileMenuOpen(false);
  };

  const handleSelectEmail = (emailId: string) => {
    setSelectedEmailId(emailId);
    setShowEmailDetail(true);
    
    // Mark as read when opened
    const email = emails.find(e => e.id === emailId);
    if (email && !email.isRead) {
      handleToggleRead([emailId]);
    }
  };

  const handleToggleStar = async (emailId: string) => {
    try {
      await emailService.toggleStar(emailId);
      setEmails(emails.map(email => 
        email.id === emailId 
          ? { ...email, isStarred: !email.isStarred }
          : email
      ));
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  const handleDelete = async (emailIds: string[]) => {
    try {
      await Promise.all(emailIds.map(id => emailService.deleteEmail(id)));
      await loadEmails();
      if (emailIds.includes(selectedEmailId || '')) {
        setSelectedEmailId(null);
        setShowEmailDetail(false);
      }
    } catch (error) {
      console.error('Failed to delete emails:', error);
    }
  };

  const handleToggleRead = async (emailIds: string[]) => {
    try {
      await Promise.all(emailIds.map(id => emailService.toggleReadStatus(id)));
      setEmails(emails.map(email => 
        emailIds.includes(email.id)
          ? { ...email, isRead: !email.isRead }
          : email
      ));
    } catch (error) {
      console.error('Failed to toggle read status:', error);
    }
  };

  const handleReply = () => {
    const email = emails.find(e => e.id === selectedEmailId);
    if (email) {
      setIsComposeOpen(true);
      // In a real app, we would pre-fill the compose modal
    }
  };

  const handleReplyAll = () => {
    const email = emails.find(e => e.id === selectedEmailId);
    if (email) {
      setIsComposeOpen(true);
      // In a real app, we would pre-fill the compose modal with all recipients
    }
  };

  const handleForward = () => {
    const email = emails.find(e => e.id === selectedEmailId);
    if (email) {
      setIsComposeOpen(true);
      // In a real app, we would pre-fill the compose modal with email content
    }
  };

  const handleSendEmail = async (emailData: { to: string; subject: string; body: string }) => {
    try {
      // In a real app, we would parse the 'to' field and convert to proper format
      await emailService.sendEmail({
        subject: emailData.subject,
        body: emailData.body,
      });
      console.log('Email sent:', emailData);
      // In a real app, we might refresh the sent folder or show a success message
    } catch (error) {
      console.error('Failed to send email:', error);
    }
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
              onClick={() => setShowEmailDetail(false)}
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
                />
              </SheetContent>
            </Sheet>
            <h1 className="text-lg font-semibold">
              {mailboxes.find(m => m.id === selectedMailboxId)?.name || 'Inbox'}
            </h1>
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
          />
        </div>

        {/* Column 2: Email List (Hidden on mobile when detail is shown) */}
        <div className={`${showEmailDetail ? 'hidden lg:block' : 'flex-1 min-w-0'} lg:flex-1 lg:min-w-0`}>
          <EmailList
            emails={emails}
            selectedEmailId={selectedEmailId}
            onSelectEmail={handleSelectEmail}
            onToggleStar={handleToggleStar}
            onRefresh={loadEmails}
            onCompose={() => setIsComposeOpen(true)}
            onDelete={handleDelete}
            onToggleRead={handleToggleRead}
          />
        </div>

        {/* Column 3: Email Detail (Mobile: full screen when shown, Desktop: always visible) */}
        <div className={`${showEmailDetail ? 'flex-1' : 'hidden lg:block lg:flex-1 lg:min-w-0'}`}>
          <EmailDetail
            email={selectedEmail}
            onReply={handleReply}
            onReplyAll={handleReplyAll}
            onForward={handleForward}
            onDelete={() => selectedEmailId && handleDelete([selectedEmailId])}
            onToggleRead={() => selectedEmailId && handleToggleRead([selectedEmailId])}
            onToggleStar={() => selectedEmailId && handleToggleStar(selectedEmailId)}
          />
        </div>
      </div>

      {/* Compose Email Modal */}
      <ComposeEmailModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSend={handleSendEmail}
      />
    </div>
  );
}
