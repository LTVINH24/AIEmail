export interface LabelResponse {
  id: string;
  name: string;
  type?: string;
  messageListVisibility?: string;
  labelListVisibility?: string;
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
}

export interface LabelDetailResponse extends LabelResponse {
  color?: {
    backgroundColor?: string;
    textColor?: string;
  };
}

export interface ThreadSummary {
  id: string;
  snippet: string;
  labelIds?: string[];
}

export interface ListThreadResponse {
  threads?: ThreadSummary[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface Attachment {
  filename: string;
  mimeType: string;
  attachmentId: string | null;
}

export interface MessageDetailResponse {
  id: string;
  threadId: string;
  messageId: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  date: string;
  snippet: string;
  textBody?: string;
  htmlBody?: string;
  attachments: Attachment[];
}

export interface ThreadDetailResponse {
  id: string;
  snippet: string;
  messages: MessageDetailResponse[];
  labelIds?: string[];
}

export interface GmailSendResponse {
  id: string;
  threadId: string;
  labelIds?: string[];
}

export interface Mailbox {
  id: string;
  name: string;
  icon: string;
  unreadCount?: number;
  type: 'inbox' | 'starred' | 'snoozed' | 'sent' | 'drafts' | 'archive' | 'trash' | 'spam' | 'custom' | 'system' | 'user';
  isMain?: boolean;
}

export interface EmailAttachment {
  id: string;
  name: string;
  size?: number;
  type: string;
  url?: string;
  attachmentId?: string;
}

export interface Email {
  id: string;
  threadId: string;
  from: {
    name: string;
    email: string;
  };
  to: Array<{
    name: string;
    email: string;
  }>;
  cc?: Array<{
    name: string;
    email: string;
  }>;
  bcc?: Array<{
    name: string;
    email: string;
  }>;
  subject: string;
  preview: string;
  body: string;
  htmlBody?: string;
  timestamp: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  attachments?: EmailAttachment[];
  mailboxId: string;
  messageId?: string;
  snoozedUntil?: string;
  workflowEmailId?: number; 
  messages?: Array<{
    id: string;
    messageId: string;
    from: { name: string; email: string };
    to: Array<{ name: string; email: string }>;
    subject: string;
    date: string;
    snippet: string;
    textBody?: string;
    htmlBody?: string;
    attachments: EmailAttachment[];
  }>; 
}

export interface EmailListResponse {
  emails: Email[];
  total: number;
  page: number;
  pageSize: number;
  nextPageToken?: string;
}

export interface SendEmailRequest {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  content: string;
  isHtml?: boolean;
  threadId?: string;
  inReplyToMessageId?: string;
  attachments?: File[];
}

export interface ModifyEmailRequest {
  threadId: string;
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

export type EmailStatus = 'INBOX' | 'TODO' | 'IN_PROGRESS' | 'DONE' | 'SNOOZED' | 'ARCHIVED';

export interface SnoozeEmailRequest {
  snoozeUntil: string; 
  note?: string;
}

export interface UpdateEmailStatusRequest {
  status: EmailStatus;
}

export interface EmailWorkflowResponse {
  id: number;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body?: string;
  summary?: string;
  status: EmailStatus;
  snoozedUntil?: string;
  isRead: boolean;
  isStarred: boolean;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

