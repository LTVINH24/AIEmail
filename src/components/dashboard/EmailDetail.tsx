import type { Email } from '@/types/email';
import { Reply, ReplyAll, Forward, Trash2, MailOpen, Star, Download, Mail, Inbox, Trash, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { emailService } from '@/services/emailService';
import { toast } from 'sonner';
import { useState } from 'react';
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

interface EmailDetailProps {
  email: Email | null;
  mailboxId: string;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onDelete: () => void;
  onPermanentDelete?: () => void;
  onMoveToInbox?: () => void;
  onToggleRead: () => void;
  onToggleStar: () => void;
}

function RecipientsList({ 
  to, 
  cc,
  bcc, 
  mailboxId 
}: { 
  to: Array<{ name: string; email: string }>; 
  cc?: Array<{ name: string; email: string }>;
  bcc?: Array<{ name: string; email: string }>;
  mailboxId: string;
}) {
  const [showAll, setShowAll] = useState(false);

  const hasMultipleRecipients = to.length > 1 || (cc && cc.length > 0) || (bcc && bcc.length > 0);

  return (
    <div className="text-xs sm:text-sm text-gray-600">
      {!showAll ? (
        <div className="flex items-center gap-1">
          <span className="text-gray-500">
            {mailboxId === 'SENT' ? 'To: ' : 'To: '}
          </span>
          <span>
            {to.length > 0 && `${to[0].name} <${to[0].email}>`}
            {to.length > 1 && `, +${to.length - 1}`}
            {cc && cc.length > 0 && to.length === 1 && `, +${cc.length}`}
            {bcc && bcc.length > 0 && to.length === 1 && !cc && `, +${bcc.length}`}
          </span>
          {hasMultipleRecipients && (
            <button
              onClick={() => setShowAll(true)}
              className="ml-1 hover:bg-gray-200 rounded p-0.5 transition-colors"
            >
              <ChevronDown className="h-3 w-3 text-gray-500" />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">To: </span>
            <button
              onClick={() => setShowAll(false)}
              className="ml-auto hover:bg-gray-200 rounded p-0.5 transition-colors"
            >
              <ChevronDown className="h-3 w-3 text-gray-500 rotate-180" />
            </button>
          </div>
          {to.map((recipient, idx) => (
            <div key={idx} className="pl-6">
              {recipient.name} &lt;{recipient.email}&gt;
            </div>
          ))}
          {cc && cc.length > 0 && (
            <>
              <div className="text-gray-500">Cc: </div>
              {cc.map((recipient, idx) => (
                <div key={idx} className="pl-6">
                  {recipient.name} &lt;{recipient.email}&gt;
                </div>
              ))}
            </>
          )}
          {bcc && bcc.length > 0 && (
            <>
              <div className="text-gray-500">Bcc: </div>
              {bcc.map((recipient, idx) => (
                <div key={idx} className="pl-6">
                  {recipient.name} &lt;{recipient.email}&gt;
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function EmailDetail({
  email,
  mailboxId,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
  onPermanentDelete,
  onMoveToInbox,
  onToggleRead,
  onToggleStar,
}: EmailDetailProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (!email) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50 p-8">
        <Mail className="h-16 w-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">No email selected</h3>
        <p className="text-sm text-gray-500 text-center">
          Select an email from the list to view its contents
        </p>
      </div>
    );
  }

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Action Bar */}
      <div className="p-2 sm:p-4 border-b flex items-center gap-1.5 sm:gap-2 flex-wrap">
        <Button onClick={onReply} variant="outline" size="sm" className="gap-1.5">
          <Reply className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Reply</span>
        </Button>
        <Button onClick={onReplyAll} variant="outline" size="sm" className="gap-1.5">
          <ReplyAll className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden md:inline">Reply All</span>
        </Button>
        <Button onClick={onForward} variant="outline" size="sm" className="gap-1.5">
          <Forward className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden md:inline">Forward</span>
        </Button>
        
        {mailboxId === 'TRASH' ? (
          <>
            <Button onClick={() => setShowDeleteDialog(true)} variant="outline" size="sm" className="gap-1.5 text-red-600 hover:text-red-700">
              <Trash className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden lg:inline">Delete Forever</span>
            </Button>
            <Button onClick={onMoveToInbox} variant="outline" size="sm" className="gap-1.5">
              <Inbox className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden lg:inline">Move to Inbox</span>
            </Button>
          </>
        ) : (
          <Button onClick={onDelete} variant="outline" size="sm" className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden lg:inline">Delete</span>
          </Button>
        )}
        
        <Button onClick={onToggleRead} variant="outline" size="sm" className="gap-1.5">
          <MailOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden lg:inline">{email.isRead ? 'Mark Unread' : 'Mark Read'}</span>
        </Button>
        <button
          onClick={onToggleStar}
          className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-md transition-colors"
          aria-label={email.isStarred ? 'Unstar email' : 'Star email'}
        >
          <Star
            className={cn(
              'h-3.5 w-3.5 sm:h-4 sm:w-4',
              email.isStarred
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-400'
            )}
          />
        </button>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 sm:p-6">
          {/* Subject */}
          <h1 className="text-lg sm:text-2xl font-semibold mb-4 sm:mb-6">{email.subject}</h1>

          {email.messages && email.messages.length > 0 ? (
            <div className="space-y-6">
              {email.messages.map((message, index) => (
                <div key={message.id} className={cn(
                  "border rounded-lg p-4",
                  index === 0 ? "border-blue-200 bg-blue-50/30" : "border-gray-200"
                )}>
                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mb-4">
                    <div className='flex gap-2'>
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-blue-100 text-blue-700 text-xs sm:text-sm">
                          {getInitials(message.from.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-1 sm:gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-sm sm:text-base text-gray-900">{message.from.name}</span>
                          <span className="text-xs sm:text-sm text-gray-500 truncate">&lt;{message.from.email}&gt;</span>
                        </div>
                        <RecipientsList 
                          to={message.to} 
                          cc={email.cc}
                          bcc={email.bcc}
                          mailboxId={mailboxId}
                        />
                      </div>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 whitespace-nowrap shrink-0">
                      {formatDateTime(message.date)}
                    </div>
                  </div>

                  {index > 0 && <Separator className="mb-4" />}

                  <div className="prose prose-sm max-w-none text-sm sm:text-base">
                    {message.htmlBody ? (
                      <div dangerouslySetInnerHTML={{ __html: message.htmlBody }} />
                    ) : message.textBody ? (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{message.textBody}</div>
                    ) : (
                      <div className="text-gray-500 italic">{message.snippet}</div>
                    )}
                  </div>

                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
                        Attachments ({message.attachments.length})
                      </h4>
                      <div className="space-y-2">
                        {message.attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center justify-between p-2 bg-white rounded border"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="shrink-0 w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                <Download className="h-4 w-4 text-blue-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                                  {attachment.name}
                                </p>
                                <p className="text-[10px] sm:text-xs text-gray-500">
                                  {attachment.type}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                try {
                                  if (!attachment.attachmentId || !message.id) {
                                    toast.error('Unable to download attachment');
                                    return;
                                  }
                                  
                                  toast.info('Downloading...');
                                  const blob = await emailService.downloadAttachment(
                                    message.id,
                                    attachment.attachmentId,
                                    attachment.name,
                                    attachment.type
                                  );
                                  
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = attachment.name;
                                  document.body.appendChild(a);
                                  a.click();
                                  window.URL.revokeObjectURL(url);
                                  document.body.removeChild(a);
                                  
                                  toast.success('Downloaded successfully');
                                } catch (error) {
                                  console.error('Download failed:', error);
                                  toast.error('Failed to download attachment');
                                }
                              }}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Sender Info */}
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mb-4 sm:mb-6">
                <div className='flex gap-2'>
                  <Avatar className="h-10 w-10 sm:h-10 sm:w-10">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs sm:text-sm">
                      {getInitials(email.from.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1 sm:gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-sm sm:text-base text-gray-900">{email.from.name}</span>
                      <span className="text-xs sm:text-sm text-gray-500 truncate">&lt;{email.from.email}&gt;</span>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                      <div>
                        <span className="text-gray-500">To: </span>
                        {email.to.map((recipient, idx) => (
                          <span key={idx}>
                            {idx > 0 && ', '}
                            {recipient.name} &lt;{recipient.email}&gt;
                          </span>
                        ))}
                      </div>
                      {email.cc && email.cc.length > 0 && (
                        <div>
                          <span className="text-gray-500">Cc: </span>
                          {email.cc.map((recipient, idx) => (
                            <span key={idx}>
                              {idx > 0 && ', '}
                              {recipient.name} &lt;{recipient.email}&gt;
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-xs sm:text-sm text-gray-500 whitespace-nowrap shrink-0">
                  {formatDateTime(email.timestamp)}
                </div>
              </div>

              <Separator className="mb-4 sm:mb-6" />

              {/* Email Body */}
              <div className="prose prose-sm max-w-none mb-4 sm:mb-6 text-sm sm:text-base">
                {email.htmlBody ? (
                  <div dangerouslySetInnerHTML={{ __html: email.htmlBody }} />
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{email.body}</div>
                )}
              </div>

              {/* Attachments */}
              {email.attachments && email.attachments.length > 0 && (
                <>
                  <Separator className="mb-4 sm:mb-6" />
                  <div>
                    <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
                      Attachments ({email.attachments.length})
                    </h3>
                    <div className="space-y-2">
                      {email.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg border"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded flex items-center justify-center">
                              <Download className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                                {attachment.name}
                              </p>
                              {attachment.size && (
                                <p className="text-[10px] sm:text-xs text-gray-500">
                                  {formatFileSize(attachment.size)}
                                </p>
                              )}
                              {!attachment.size && attachment.type && (
                                <p className="text-[10px] sm:text-xs text-gray-500">
                                  {attachment.type}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 shrink-0 text-xs sm:text-sm"
                            onClick={async () => {
                              try {
                                if (!attachment.attachmentId || !email.id) {
                                  toast.error('Unable to download attachment');
                                  return;
                                }
                                
                                toast.info('Downloading...');
                                const blob = await emailService.downloadAttachment(
                                  email.id,
                                  attachment.attachmentId,
                                  attachment.name,
                                  attachment.type
                                );
                                
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = attachment.name;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                                
                                toast.success('Downloaded successfully');
                              } catch (error) {
                                console.error('Download failed:', error);
                                toast.error('Failed to download attachment');
                              }
                            }}
                          >
                            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">Download</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Forever?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this email. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                onPermanentDelete?.();
                setShowDeleteDialog(false);
              }} 
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
