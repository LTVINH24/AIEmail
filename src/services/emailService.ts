import type { Mailbox, Email, EmailListResponse } from '../types/email';
import { mockMailboxes, mockEmails } from '../api/mockData';

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const emailService = {
  // GET /mailboxes
  async getMailboxes(): Promise<Mailbox[]> {
    await delay(300);
    return mockMailboxes;
  },

  // GET /mailboxes/:id/emails
  async getEmailsByMailbox(
    mailboxId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<EmailListResponse> {
    await delay(400);
    
    let filteredEmails = mockEmails.filter(email => {
      if (mailboxId === 'starred') {
        return email.isStarred;
      }
      return email.mailboxId === mailboxId;
    });

    const total = filteredEmails.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const emails = filteredEmails.slice(start, end);

    return {
      emails,
      total,
      page,
      pageSize,
    };
  },

  // GET /emails/:id
  async getEmailById(emailId: string): Promise<Email | null> {
    await delay(200);
    return mockEmails.find(email => email.id === emailId) || null;
  },

  // PATCH /emails/:id - Mark as read/unread
  async toggleReadStatus(emailId: string): Promise<Email | null> {
    await delay(200);
    const email = mockEmails.find(e => e.id === emailId);
    if (email) {
      email.isRead = !email.isRead;
    }
    return email || null;
  },

  // PATCH /emails/:id - Toggle star
  async toggleStar(emailId: string): Promise<Email | null> {
    await delay(200);
    const email = mockEmails.find(e => e.id === emailId);
    if (email) {
      email.isStarred = !email.isStarred;
    }
    return email || null;
  },

  // DELETE /emails/:id
  async deleteEmail(emailId: string): Promise<boolean> {
    await delay(300);
    const index = mockEmails.findIndex(e => e.id === emailId);
    if (index !== -1) {
      const email = mockEmails[index];
      email.mailboxId = 'trash';
      return true;
    }
    return false;
  },

  // POST /emails/:id/reply
  async replyToEmail(emailId: string, body: string): Promise<boolean> {
    await delay(500);
    console.log(`Reply to email ${emailId}:`, body);
    return true;
  },

  // POST /emails
  async sendEmail(email: Partial<Email>): Promise<boolean> {
    await delay(500);
    console.log('Sending email:', email);
    return true;
  },
};
