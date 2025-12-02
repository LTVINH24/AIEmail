import { apiClient } from '../api/apiClient';
import { cookieManager } from '../utils/tokenManager';
import type {
  Mailbox,
  Email,
  EmailListResponse,
  LabelResponse,
  ListThreadResponse,
  ThreadDetailResponse,
  SendEmailRequest,
  GmailSendResponse,
  ModifyEmailRequest,
  LabelDetailResponse,
} from '../types/email';

const MAIN_LABEL_IDS = [
  'INBOX',
  'STARRED', 
  'SENT',
  'DRAFT',
  'TRASH',
  'SPAM',
  'IMPORTANT',
];

const LABEL_ICON_MAP: Record<string, string> = {
  'INBOX': 'Inbox',
  'STARRED': 'Star',
  'SENT': 'Send',
  'DRAFT': 'FileEdit',
  'TRASH': 'Trash2',
  'SPAM': 'Archive',
  'IMPORTANT': 'Briefcase',
  'CATEGORY_PERSONAL': 'User',
  'CATEGORY_SOCIAL': 'Users',
  'CATEGORY_PROMOTIONS': 'Tag',
  'CATEGORY_UPDATES': 'Bell',
  'CATEGORY_FORUMS': 'MessageSquare',
  'UNREAD': 'Mail',
};

const LABEL_NAME_MAP: Record<string, string> = {
  'INBOX': 'Inbox',
  'STARRED': 'Starred',
  'SENT': 'Sent',
  'DRAFT': 'Drafts',
  'TRASH': 'Trash',
  'SPAM': 'Spam',
  'IMPORTANT': 'Important',
  'CATEGORY_PERSONAL': 'Personal',
  'CATEGORY_SOCIAL': 'Social',
  'CATEGORY_PROMOTIONS': 'Promotions',
  'CATEGORY_UPDATES': 'Updates',
  'CATEGORY_FORUMS': 'Forums',
  'UNREAD': 'Unread',
};

function parseEmailAddress(emailStr: string): { name: string; email: string } {
  if (!emailStr) return { name: '', email: '' };
  
  const match = emailStr.match(/^(?:"?([^"]*)"?\s)?(?:<?([^<>@]+@[^<>]+)>?)$/);
  if (match) {
    const name = match[1]?.trim() || match[2]?.split('@')[0] || '';
    const email = match[2]?.trim() || '';
    return { name, email };
  }
  
  return { name: emailStr.split('@')[0] || '', email: emailStr };
}

function parseEmailAddresses(emailsStr: string): Array<{ name: string; email: string }> {
  if (!emailsStr) return [];
  return emailsStr.split(',').map(e => parseEmailAddress(e.trim())).filter(e => e.email);
}

export const emailService = {
  async getMailboxes(): Promise<Mailbox[]> {
    try {
      // Fetch all labels from API
      const labels = await apiClient.get<LabelResponse[]>('/mailboxes');
      
      const mailboxes: Mailbox[] = [];
      
      // First, add main labels in specific order
      MAIN_LABEL_IDS.forEach(labelId => {
        const label = labels.find(l => l.id === labelId);
        if (label) {
          mailboxes.push({
            id: label.id,
            name: LABEL_NAME_MAP[label.id] || label.name,
            icon: LABEL_ICON_MAP[label.id] || 'Mail',
            type: this.getLabelType(label.id),
            unreadCount: label.messagesUnread || label.threadsUnread || 0,
            isMain: true,
          });
        }
      });
      
      labels.forEach(label => {
        if (MAIN_LABEL_IDS.includes(label.id)) return;
        
        if (label.type === 'system' && !label.id.startsWith('CATEGORY_')) return;
        
        mailboxes.push({
          id: label.id,
          name: LABEL_NAME_MAP[label.id] || label.name,
          icon: LABEL_ICON_MAP[label.id] || 'Tag',
          type: this.getLabelType(label.id),
          unreadCount: label.messagesUnread || label.threadsUnread || 0,
          isMain: false,
        });
      });
      
      return mailboxes;
    } catch (error) {
      console.error('Failed to fetch mailboxes:', error);
      return [];
    }
  },

  getLabelType(labelId: string): Mailbox['type'] {
    if (labelId === 'INBOX') return 'inbox';
    if (labelId === 'STARRED') return 'starred';
    if (labelId === 'SENT') return 'sent';
    if (labelId === 'DRAFT') return 'drafts';
    if (labelId === 'TRASH') return 'trash';
    if (labelId === 'SPAM') return 'spam';
    return 'custom';
  },

  async getMailboxDetails(mailboxId: string): Promise<LabelDetailResponse> {
    return apiClient.get<LabelDetailResponse>(`/mailboxes/${mailboxId}`);
  },

  async getEmailsByMailbox(
    mailboxId: string,
    pageSize: number = 20,
    pageToken?: string,
    query?: string
  ): Promise<EmailListResponse> {
    try {
      const params = new URLSearchParams();
      
      if (pageSize) params.append('maxResults', pageSize.toString());
      if (pageToken) params.append('pageToken', pageToken);
      if (query) params.append('query', query);
      
      if (mailboxId === 'TRASH' || mailboxId === 'SPAM') {
        params.append('includeSpamTrash', 'true');
      }
      const response = await apiClient.get<ListThreadResponse>(
        `/mailboxes/${mailboxId}/emails?${params.toString()}`
      );

      // Build lightweight preview emails from thread summaries.
      // We avoid fetching full thread details here to reduce initial load.
      const emails: Email[] = (response.threads || []).map((thread) => ({
        id: thread.id,
        threadId: thread.id,
        from: { name: '(Unknown)', email: '' },
        to: [],
        subject: thread.snippet || '(No Subject)',
        preview: thread.snippet || '',
        body: '',
        htmlBody: undefined,
        timestamp: new Date().toISOString(),
        isRead: true, // default; will be updated when detail is fetched
        isStarred: false,
        hasAttachments: false,
        attachments: [],
        mailboxId: mailboxId,
        messageId: undefined,
        messages: undefined,
      }));

      return {
        emails,
        total: Number(response.resultSizeEstimate) || emails.length,
        page: 1,
        pageSize,
        nextPageToken: response.nextPageToken,
      };
    } catch (error) {
      console.error('Failed to load emails:', error);
      throw error;
    }
  },

  async getEmailById(threadId: string): Promise<Email | null> {
    try {
      const thread = await apiClient.get<ThreadDetailResponse>(`/emails/${threadId}`);
      
      if (!thread.messages || thread.messages.length === 0) {
        return null;
      }

      const firstMessage = thread.messages[0];
      const from = parseEmailAddress(firstMessage.from);
      const to = parseEmailAddresses(firstMessage.to);
      const cc = firstMessage.cc ? parseEmailAddresses(firstMessage.cc) : undefined;
      const bcc = firstMessage.bcc ? parseEmailAddresses(firstMessage.bcc) : undefined;

      const messages = thread.messages.map(msg => ({
        id: msg.id,
        messageId: msg.messageId,
        from: parseEmailAddress(msg.from),
        to: parseEmailAddresses(msg.to),
        subject: msg.subject,
        date: msg.date,
        snippet: msg.snippet,
        textBody: msg.textBody,
        htmlBody: msg.htmlBody,
        attachments: msg.attachments.map((att, idx) => ({
          id: att.attachmentId || `${msg.id}-${idx}`,
          name: att.filename,
          type: att.mimeType,
          attachmentId: att.attachmentId || undefined,
        })),
      }));

      const labelIds = thread.labelIds || [];
      const isRead = !labelIds.includes('UNREAD');
      const isStarred = labelIds.includes('STARRED');

      return {
        id: thread.id,
        threadId: thread.id,
        messageId: firstMessage.messageId,
        from,
        to,
        cc,
        bcc,
        subject: firstMessage.subject || '(No Subject)',
        preview: thread.snippet || firstMessage.snippet || '',
        body: firstMessage.textBody || firstMessage.snippet || '',
        htmlBody: firstMessage.htmlBody,
        timestamp: firstMessage.date || new Date().toISOString(),
        isRead,
        isStarred,
        hasAttachments: firstMessage.attachments.length > 0,
        attachments: firstMessage.attachments.map((att, idx) => ({
          id: att.attachmentId || `${firstMessage.id}-${idx}`,
          name: att.filename,
          type: att.mimeType,
          attachmentId: att.attachmentId || undefined,
        })),
        mailboxId: 'INBOX',
        messages,
      };
    } catch (error) {
      console.error('Failed to fetch email:', error);
      return null;
    }
  },

  async downloadAttachment(
    messageId: string,
    attachmentId: string,
    filename: string,
    mimeType: string
  ): Promise<Blob> {
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    const params = new URLSearchParams({ filename, mimeType });
    
    const accessToken = cookieManager.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(
      `${baseURL}/emails/${messageId}/attachments/${attachmentId}?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.statusText}`);
    }

    return response.blob();
  },

  async modifyLabels(request: ModifyEmailRequest): Promise<void> {
    try {
      await apiClient.post('/emails/modify', request);
    } catch (error) {
      console.error('Failed to modify labels:', error);
      throw error; 
    }
  },

  async markAsRead(threadId: string): Promise<void> {
    await this.modifyLabels({
      threadId,
      removeLabelIds: ['UNREAD'],
    });
  },

  async markAsUnread(threadId: string): Promise<void> {
    await this.modifyLabels({
      threadId,
      addLabelIds: ['UNREAD'],
    });
  },

  async toggleStar(threadId: string, isStarred: boolean): Promise<void> {
    await this.modifyLabels({
      threadId,
      addLabelIds: isStarred ? [] : ['STARRED'],
      removeLabelIds: isStarred ? ['STARRED'] : [],
    });
  },

  async archiveEmail(threadId: string): Promise<void> {
    await this.modifyLabels({
      threadId,
      removeLabelIds: ['INBOX'],
    });
  },

  async moveToTrash(threadId: string): Promise<void> {
    await this.modifyLabels({
      threadId,
      addLabelIds: ['TRASH'],
      removeLabelIds: ['INBOX'],
    });
  },

  async deleteEmail(threadId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/emails/${threadId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete email:', error);
      return false;
    }
  },

  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/emails/message/${messageId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete message:', error);
      return false;
    }
  },

  async sendEmail(request: SendEmailRequest): Promise<GmailSendResponse> {
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    const formData = new FormData();
    
    formData.append('to', request.to);
    if (request.cc) formData.append('cc', request.cc);
    if (request.bcc) formData.append('bcc', request.bcc);
    formData.append('subject', request.subject);
    formData.append('content', request.content);
    formData.append('html', String(request.isHtml || false));
    
    if (request.threadId) formData.append('threadId', request.threadId);
    if (request.inReplyToMessageId) formData.append('inReplyToMessageId', request.inReplyToMessageId);
    
    if (request.attachments) {
      request.attachments.forEach(file => {
        formData.append('attachment', file);
      });
    }

    const accessToken = cookieManager.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${baseURL}/emails/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to send email: ${error}`);
    }

    return response.json();
  },

  async replyToEmail(
    threadId: string,
    messageId: string,
    to: string,
    subject: string,
    body: string,
    isHtml: boolean = false
  ): Promise<GmailSendResponse> {
    return this.sendEmail({
      to,
      subject,
      content: body,
      isHtml,
      threadId,
      inReplyToMessageId: messageId,
    });
  },
};
