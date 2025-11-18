export interface Mailbox {
  id: string;
  name: string;
  icon: string;
  unreadCount?: number;
  type: 'inbox' | 'starred' | 'sent' | 'drafts' | 'archive' | 'trash' | 'custom';
}

export interface EmailAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface Email {
  id: string;
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
  subject: string;
  preview: string;
  body: string;
  timestamp: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  attachments?: EmailAttachment[];
  mailboxId: string;
}

export interface EmailListResponse {
  emails: Email[];
  total: number;
  page: number;
  pageSize: number;
}
