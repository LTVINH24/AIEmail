import { apiClient } from "../api/apiClient";
import { cookieManager } from "../utils/tokenManager";
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
  SnoozeEmailRequest,
  UpdateEmailStatusRequest,
  EmailWorkflowResponse,
  EmailStatus,
  EmailSummaryResponse,
} from "../types/email";

const MAIN_LABEL_IDS = [
  "INBOX",
  "STARRED",
  "SNOOZED",
  "SENT",
  "DRAFT",
  "TRASH",
  "SPAM",
  "IMPORTANT",
];

const LABEL_ICON_MAP: Record<string, string> = {
  INBOX: "Inbox",
  STARRED: "Star",
  SNOOZED: "Clock",
  SENT: "Send",
  DRAFT: "FileEdit",
  TRASH: "Trash2",
  SPAM: "Archive",
  IMPORTANT: "Briefcase",
  CATEGORY_PERSONAL: "User",
  CATEGORY_SOCIAL: "Users",
  CATEGORY_PROMOTIONS: "Tag",
  CATEGORY_UPDATES: "Bell",
  CATEGORY_FORUMS: "MessageSquare",
  UNREAD: "Mail",
};

const LABEL_NAME_MAP: Record<string, string> = {
  INBOX: "Inbox",
  STARRED: "Starred",
  SNOOZED: "Snoozed",
  SENT: "Sent",
  DRAFT: "Drafts",
  TRASH: "Trash",
  SPAM: "Spam",
  IMPORTANT: "Important",
  CATEGORY_PERSONAL: "Personal",
  CATEGORY_SOCIAL: "Social",
  CATEGORY_PROMOTIONS: "Promotions",
  CATEGORY_UPDATES: "Updates",
  CATEGORY_FORUMS: "Forums",
  UNREAD: "Unread",
};

function parseEmailAddress(emailStr: string): { name: string; email: string } {
  if (!emailStr) return { name: "", email: "" };

  const match = emailStr.match(/^(?:"?([^"]*)"?\s)?(?:<?([^<>@]+@[^<>]+)>?)$/);
  if (match) {
    const name = match[1]?.trim() || match[2]?.split("@")[0] || "";
    const email = match[2]?.trim() || "";
    return { name, email };
  }

  return { name: emailStr.split("@")[0] || "", email: emailStr };
}

function parseEmailAddresses(
  emailsStr: string,
): Array<{ name: string; email: string }> {
  if (!emailsStr) return [];
  return emailsStr
    .split(",")
    .map((e) => parseEmailAddress(e.trim()))
    .filter((e) => e.email);
}

export const emailService = {
  async getMailboxes(): Promise<Mailbox[]> {
    try {
      let labels = await apiClient.get<LabelResponse[]>("/mailboxes");
      console.log("Fetched Labels:", labels);

      // Check if SNOOZED label exists, if not try to create it
      let snoozedLabel = labels.find(
        (l) => l.name?.toUpperCase() === "SNOOZED",
      );
      if (!snoozedLabel) {
        try {
          console.log("SNOOZED label not found, creating...");
          const createdLabel = await this.createLabel("SNOOZED");
          console.log("Successfully created SNOOZED label:", createdLabel);
          // Refetch labels to get the newly created one
          labels = await apiClient.get<LabelResponse[]>("/mailboxes");
          snoozedLabel = labels.find(
            (l) => l.name?.toUpperCase() === "SNOOZED",
          );
        } catch (error) {
          console.error("Failed to create SNOOZED label:", error);
          // Don't add SNOOZED to mailboxes if creation failed
          snoozedLabel = undefined;
        }
      }

      const mailboxes: Mailbox[] = [];

      MAIN_LABEL_IDS.forEach((labelId) => {
        if (labelId === "SNOOZED") {
          // Only add SNOOZED mailbox if the label actually exists
          if (snoozedLabel) {
            mailboxes.push({
              id: snoozedLabel.id,
              name: "Snoozed",
              icon: "Clock",
              type: "snoozed",
              unreadCount:
                snoozedLabel.messagesUnread || snoozedLabel.threadsUnread || 0,
              isMain: true,
            });
          } else {
            console.warn("Skipping SNOOZED mailbox - label does not exist");
          }
          return;
        }

        const label = labels.find((l) => l.id === labelId);
        if (label) {
          mailboxes.push({
            id: label.id,
            name: LABEL_NAME_MAP[label.id] || label.name,
            icon: LABEL_ICON_MAP[label.id] || "Mail",
            type: label.type === "user" ? "user" : this.getLabelType(label.id),
            unreadCount: label.messagesUnread || label.threadsUnread || 0,
            isMain: true,
          });
        }
      });

      labels.forEach((label) => {
        if (MAIN_LABEL_IDS.includes(label.id)) return;

        if (label.name?.toUpperCase() === "SNOOZED") return;

        if (label.type === "system" && !label.id.startsWith("CATEGORY_"))
          return;

        mailboxes.push({
          id: label.id,
          name: LABEL_NAME_MAP[label.id] || label.name,
          icon: LABEL_ICON_MAP[label.id] || "Tag",
          type: label.type === "user" ? "user" : this.getLabelType(label.id),
          unreadCount: label.messagesUnread || label.threadsUnread || 0,
          isMain: false,
        });
      });

      return mailboxes;
    } catch (error) {
      console.error("Failed to fetch mailboxes:", error);
      return [];
    }
  },

  getLabelType(labelId: string): Mailbox["type"] {
    if (labelId === "INBOX") return "inbox";
    if (labelId === "STARRED") return "starred";
    if (labelId === "SNOOZED") return "snoozed";
    if (labelId === "SENT") return "sent";
    if (labelId === "DRAFT") return "drafts";
    if (labelId === "TRASH") return "trash";
    if (labelId === "SPAM") return "spam";
    return "custom";
  },

  async getMailboxDetails(mailboxId: string): Promise<LabelDetailResponse> {
    return apiClient.get<LabelDetailResponse>(`/mailboxes/${mailboxId}`);
  },

  async getEmailsByMailbox(
    mailboxId: string,
    pageSize: number = 20,
    pageToken?: string,
    query?: string,
  ): Promise<EmailListResponse> {
    try {
      // Check if this is a SNOOZED mailbox - use workflow API for snoozed emails
      let isSnoozedMailbox = false;
      if (mailboxId === "SNOOZED") {
        isSnoozedMailbox = true;
      } else {
        try {
          const labels = await apiClient.get<LabelResponse[]>("/mailboxes");
          const label = labels.find((l) => l.id === mailboxId);
          if (label && label.name?.toUpperCase() === "SNOOZED") {
            isSnoozedMailbox = true;
          }
        } catch (error) {
          console.warn("Failed to check if mailbox is SNOOZED:", error);
        }
      }

      // Handle SNOOZED mailbox separately using workflow API
      if (isSnoozedMailbox) {
        const params = new URLSearchParams({
          status: "SNOOZED",
        });
        const workflowEmails = await apiClient.get<EmailWorkflowResponse[]>(
          `/api/emails?${params.toString()}`,
        );

        const emails: Email[] = workflowEmails.map((email) => ({
          id: email.threadId,
          threadId: email.threadId,
          from: parseEmailAddress(email.from || ""),
          to: parseEmailAddresses(email.to || ""),
          subject: email.subject || "(No Subject)",
          preview: email.snippet || "",
          body: email.body || "",
          htmlBody: undefined,
          timestamp: email.receivedAt || new Date().toISOString(),
          isRead: email.isRead ?? true,
          isStarred: email.isStarred ?? false,
          hasAttachments: email.hasAttachments ?? false,
          attachments: [],
          mailboxId: "SNOOZED",
          messageId: undefined,
          messages: undefined,
          snoozedUntil: email.snoozedUntil,
          workflowEmailId: email.id,
        }));

        return {
          emails,
          total: emails.length,
          page: 1,
          pageSize,
          nextPageToken: undefined,
        };
      }

      // Handle normal mailboxes - fetch from Gmail API
      const params = new URLSearchParams();
      if (pageSize) params.append("maxResults", pageSize.toString());
      if (pageToken) params.append("pageToken", pageToken);
      if (query) params.append("query", query);
      if (mailboxId === "TRASH" || mailboxId === "SPAM") {
        params.append("includeSpamTrash", "true");
      }

      // Add timestamp to prevent caching
      params.append("_t", Date.now().toString());

      const response = await apiClient.get<ListThreadResponse>(
        `/mailboxes/${mailboxId}/emails?${params.toString()}`,
      );

      // Map threads to Email objects
      const emails: Email[] = (response.threads || []).map((thread) => {
        const labelIds = thread.labelIds || [];
        const isRead = !labelIds.includes("UNREAD");
        const isStarred = labelIds.includes("STARRED");

        return {
          id: thread.id,
          threadId: thread.id,
          from: { name: "(Unknown)", email: "" },
          to: [],
          subject: thread.snippet || "(No Subject)",
          preview: thread.snippet || "",
          body: "",
          htmlBody: undefined,
          timestamp: new Date().toISOString(),
          isRead,
          isStarred,
          hasAttachments: false,
          attachments: [],
          mailboxId: mailboxId,
          messageId: undefined,
          messages: undefined,
        };
      });

      return {
        emails,
        total: Number(response.resultSizeEstimate) || emails.length,
        page: 1,
        pageSize,
        nextPageToken: response.nextPageToken,
      };
    } catch (error) {
      console.error("Failed to load emails:", error);
      throw error;
    }
  },

  async getEmailById(
    threadId: string,
    mailboxId?: string,
  ): Promise<Email | null> {
    try {
      if (!threadId || threadId === "undefined" || threadId === "null") {
        console.error("Invalid threadId:", threadId);
        return null;
      }

      const thread = await apiClient.get<ThreadDetailResponse>(
        `/emails/${threadId}`,
      );

      if (!thread.messages || thread.messages.length === 0) {
        return null;
      }

      const firstMessage = thread.messages[0];
      const from = parseEmailAddress(firstMessage.from);
      const to = parseEmailAddresses(firstMessage.to);
      const cc = firstMessage.cc
        ? parseEmailAddresses(firstMessage.cc)
        : undefined;
      const bcc = firstMessage.bcc
        ? parseEmailAddresses(firstMessage.bcc)
        : undefined;

      const messages = thread.messages.map((msg) => ({
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
      const isRead = !labelIds.includes("UNREAD");
      const isStarred = labelIds.includes("STARRED");

      return {
        id: thread.id,
        threadId: thread.id,
        messageId: firstMessage.messageId,
        from,
        to,
        cc,
        bcc,
        subject: firstMessage.subject || "(No Subject)",
        preview: thread.snippet || firstMessage.snippet || "",
        body: firstMessage.textBody || firstMessage.snippet || "",
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
        mailboxId: mailboxId || "INBOX",
        messages,
      };
    } catch (error) {
      console.error("Failed to fetch email:", error);
      return null;
    }
  },

  async downloadAttachment(
    messageId: string,
    attachmentId: string,
    filename: string,
    mimeType: string,
  ): Promise<Blob> {
    const baseURL =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
    const params = new URLSearchParams({ filename, mimeType });

    const accessToken = cookieManager.getAccessToken();
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(
      `${baseURL}/emails/${messageId}/attachments/${attachmentId}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.statusText}`);
    }

    return response.blob();
  },

  async modifyLabels(request: ModifyEmailRequest): Promise<void> {
    try {
      await apiClient.post("/emails/modify", request);
    } catch (error) {
      console.error("Failed to modify labels:", error);
      throw error;
    }
  },

  async markAsRead(threadId: string): Promise<void> {
    await this.modifyLabels({
      threadId,
      removeLabelIds: ["UNREAD"],
    });
  },

  async markAsUnread(threadId: string): Promise<void> {
    await this.modifyLabels({
      threadId,
      addLabelIds: ["UNREAD"],
    });
  },

  async toggleStar(threadId: string, isStarred: boolean): Promise<void> {
    await this.modifyLabels({
      threadId,
      addLabelIds: isStarred ? [] : ["STARRED"],
      removeLabelIds: isStarred ? ["STARRED"] : [],
    });
  },

  async archiveEmail(threadId: string): Promise<void> {
    await this.modifyLabels({
      threadId,
      removeLabelIds: ["INBOX"],
    });
  },

  async moveToTrash(threadId: string): Promise<void> {
    await this.modifyLabels({
      threadId,
      addLabelIds: ["TRASH"],
      removeLabelIds: ["INBOX"],
    });
  },

  async deleteEmail(threadId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/emails/${threadId}`);
      return true;
    } catch (error) {
      console.error("Failed to delete email:", error);
      return false;
    }
  },

  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/emails/message/${messageId}`);
      return true;
    } catch (error) {
      console.error("Failed to delete message:", error);
      return false;
    }
  },

  async sendEmail(request: SendEmailRequest): Promise<GmailSendResponse> {
    const baseURL =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
    const formData = new FormData();

    formData.append("to", request.to);
    if (request.cc) formData.append("cc", request.cc);
    if (request.bcc) formData.append("bcc", request.bcc);
    formData.append("subject", request.subject);
    formData.append("content", request.content);
    formData.append("isHtml", String(request.isHtml || false));

    if (request.threadId) formData.append("threadId", request.threadId);
    if (request.inReplyToMessageId)
      formData.append("inReplyToMessageId", request.inReplyToMessageId);

    if (request.attachments) {
      request.attachments.forEach((file) => {
        formData.append("attachment", file);
      });
    }

    const accessToken = cookieManager.getAccessToken();
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${baseURL}/emails/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "Unknown error");
      throw new Error(`Failed to send email: ${error}`);
    }

    return response.json();
  },

  // async syncEmails(): Promise<void> {
  //   return apiClient.post<void>('/sync');
  // },

  async replyToEmail(
    threadId: string,
    messageId: string,
    to: string,
    subject: string,
    body: string,
    isHtml: boolean = false,
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

  async createLabel(
    name: string,
    systemLabel: boolean = false,
  ): Promise<LabelResponse> {
    try {
      return await apiClient.post<LabelResponse>("/mailboxes", {
        name,
        systemLabel,
      });
    } catch (error) {
      console.error("Failed to create label:", error);
      throw error;
    }
  },

  /**
   * Get the real SNOOZED label ID from Gmail API
   * Must be called after getMailboxes() which ensures the label exists
   */
  async getSnoozedLabelId(): Promise<string> {
    try {
      const labels = await apiClient.get<LabelResponse[]>("/mailboxes");
      // Case-insensitive search for Snoozed label
      const snoozedLabel = labels.find(
        (l) => l.name?.toUpperCase() === "SNOOZED",
      );

      if (snoozedLabel) {
        console.log("Found Snoozed label ID:", snoozedLabel.id);
        return snoozedLabel.id;
      }

      // If not found, try to create it
      console.warn("Snoozed label not found, attempting to create...");
      try {
        const createdLabel = await this.createLabel("SNOOZED");
        console.log("Created SNOOZED label with ID:", createdLabel.id);
        return createdLabel.id;
      } catch (createError) {
        console.error("Failed to create SNOOZED label:", createError);
        throw new Error(
          "SNOOZED label does not exist and could not be created",
        );
      }
    } catch (error) {
      console.error("Failed to get snoozed label ID:", error);
      throw error;
    }
  },

  async deleteLabel(labelId: string): Promise<void> {
    try {
      try {
        let pageToken: string | undefined = undefined;
        let hasMore = true;

        while (hasMore) {
          const response = await this.getEmailsByMailbox(
            labelId,
            50,
            pageToken,
          );

          const threadIds = response.emails
            .map((e) => e.threadId)
            .filter(Boolean);

          if (threadIds.length > 0) {
            await Promise.all(
              threadIds.map((threadId) =>
                this.modifyLabels({
                  threadId,
                  addLabelIds: ["INBOX"],
                  removeLabelIds: [labelId],
                }),
              ),
            );
          }

          if (response.nextPageToken) {
            pageToken = response.nextPageToken;
          } else {
            hasMore = false;
          }
        }
      } catch (error) {
        console.warn(
          "Failed to move emails to INBOX before deleting label:",
          error,
        );
      }

      await apiClient.delete(`/mailboxes/${labelId}`);
    } catch (error) {
      console.error("Failed to delete label:", error);
      throw error;
    }
  },

  async updateLabel(
    id: string,
    name: string,
    kanbanColumnId?: number,
  ): Promise<LabelResponse> {
    try {
      const body: { name: string; kanbanColumnId?: number } = { name };
      if (kanbanColumnId !== undefined) {
        body.kanbanColumnId = kanbanColumnId;
      }
      return await apiClient.patch<LabelResponse>(`/mailboxes?id=${id}`, body);
    } catch (error) {
      console.error("Failed to update label:", error);
      throw error;
    }
  },

  /**
   * Get all workflow emails (with status and summary)
   */
  async getWorkflowEmails(
    status?: EmailStatus,
  ): Promise<EmailWorkflowResponse[]> {
    try {
      const params = status ? `?status=${status}` : "";
      return await apiClient.get<EmailWorkflowResponse[]>(
        `/api/emails${params}`,
      );
    } catch (error) {
      console.error("Failed to fetch workflow emails:", error);
      throw error;
    }
  },

  /**
   * Update email status (for drag & drop in Kanban)
   */
  async updateEmailStatus(
    emailId: number,
    status: EmailStatus,
  ): Promise<EmailWorkflowResponse> {
    try {
      const request: UpdateEmailStatusRequest = { status };
      return await apiClient.patch<EmailWorkflowResponse>(
        `/api/emails/${emailId}/status`,
        request,
      );
    } catch (error) {
      console.error("Failed to update email status:", error);
      throw error;
    }
  },

  /**
   * Snooze email until specified time
   */
  async snoozeEmail(
    emailId: number,
    snoozeUntil: Date,
    note?: string,
    previousLabelId?: string,
  ): Promise<EmailWorkflowResponse> {
    try {
      const request: SnoozeEmailRequest = {
        snoozeUntil: snoozeUntil.toISOString(),
        note,
        previousLabelId,
      };
      return await apiClient.post<EmailWorkflowResponse>(
        `/api/emails/${emailId}/snooze`,
        request,
      );
    } catch (error) {
      console.error("Failed to snooze email:", error);
      throw error;
    }
  },

  /**
   * Snooze email by thread ID (preferred method - works with Gmail threadId)
   */
  async snoozeEmailByThreadId(
    threadId: string,
    snoozeUntil: Date,
    note?: string,
    previousLabelId?: string,
  ): Promise<EmailWorkflowResponse> {
    try {
      const request: SnoozeEmailRequest = {
        snoozeUntil: snoozeUntil.toISOString(),
        note,
        previousLabelId,
      };
      return await apiClient.post<EmailWorkflowResponse>(
        `/api/emails/thread/${threadId}/snooze`,
        request,
      );
    } catch (error) {
      console.error("Failed to snooze email:", error);
      throw error;
    }
  },

  /**
   * Unsnooze email (restore immediately)
   */
  async unsnoozeEmail(emailId: number): Promise<EmailWorkflowResponse> {
    try {
      return await apiClient.post<EmailWorkflowResponse>(
        `/api/emails/${emailId}/unsnooze`,
        {},
      );
    } catch (error) {
      console.error("Failed to unsnooze email:", error);
      throw error;
    }
  },

  /**
   * Delete workflow email
   */
  async deleteWorkflowEmail(emailId: number): Promise<void> {
    try {
      await apiClient.delete(`/api/emails/${emailId}`);
    } catch (error) {
      console.error("Failed to delete workflow email:", error);
      throw error;
    }
  },

  /**
   * Update email read status in workflow DB
   */
  async updateEmailRead(emailId: number, isRead: boolean): Promise<void> {
    try {
      await apiClient.patch(`/api/emails/${emailId}/read`, { isRead });
    } catch (error) {
      console.error("Failed to update read status:", error);
      throw error;
    }
  },

  /**
   * Update email starred status in workflow DB
   */
  async updateEmailStarred(emailId: number, isStarred: boolean): Promise<void> {
    try {
      await apiClient.patch(`/api/emails/${emailId}/starred`, { isStarred });
    } catch (error) {
      console.error("Failed to update starred status:", error);
      throw error;
    }
  },

  /**
   * Get AI summary for an email message
   */
  async summarizeEmail(messageId: string): Promise<EmailSummaryResponse> {
    try {
      // URL encode the messageId to handle special characters like @, ., etc.
      const encodedMessageId = encodeURIComponent(messageId);
      const response = await apiClient.get<EmailSummaryResponse>(
        `/emails/${encodedMessageId}/summary`,
      );
      return response;
    } catch (error) {
      console.error("Failed to summarize email:", error);
      throw error;
    }
  },

  /**
   * Sync emails to prepare for semantic search
   */
  async syncEmails(): Promise<void> {
    try {
      await apiClient.post<void>("/emails/sync");
    } catch (error) {
      console.error("Failed to sync emails:", error);
      throw error;
    }
  },

  /**
   * Perform semantic search on emails
   */
  async searchEmails(query: string): Promise<Email[]> {
    try {
      const response = await apiClient.get<ThreadDetailResponse[]>(
        `/emails/search?query=${encodeURIComponent(query)}`,
      );

      // Transform ThreadDetailResponse to Email format
      const emails: Email[] = response.map((thread) => {
        const firstMessage = thread.messages[0];
        const lastMessage = thread.messages[thread.messages.length - 1];

        const from = parseEmailAddress(firstMessage.from);
        const to = parseEmailAddresses(firstMessage.to);
        const cc = firstMessage.cc
          ? parseEmailAddresses(firstMessage.cc)
          : undefined;
        const bcc = firstMessage.bcc
          ? parseEmailAddresses(firstMessage.bcc)
          : undefined;

        const hasAttachments = thread.messages.some(
          (m) => m.attachments && m.attachments.length > 0,
        );
        const allAttachments = thread.messages.flatMap((m) =>
          (m.attachments || []).map((att) => ({
            id: att.attachmentId || "",
            name: att.filename,
            type: att.mimeType,
            attachmentId: att.attachmentId || undefined,
          })),
        );

        const isRead = thread.labelIds
          ? !thread.labelIds.includes("UNREAD")
          : true;
        const isStarred = thread.labelIds
          ? thread.labelIds.includes("STARRED")
          : false;

        return {
          id: thread.id,
          threadId: thread.id,
          from,
          to,
          cc,
          bcc,
          subject: firstMessage.subject,
          preview: thread.snippet || firstMessage.snippet || "",
          body: firstMessage.textBody || firstMessage.snippet,
          htmlBody: firstMessage.htmlBody,
          timestamp: lastMessage.date,
          isRead,
          isStarred,
          hasAttachments,
          attachments: allAttachments,
          mailboxId: "SEARCH",
          messageId: firstMessage.messageId,
          messages: thread.messages.map((msg) => ({
            id: msg.id,
            messageId: msg.messageId,
            from: parseEmailAddress(msg.from),
            to: parseEmailAddresses(msg.to),
            subject: msg.subject,
            date: msg.date,
            snippet: msg.snippet,
            textBody: msg.textBody,
            htmlBody: msg.htmlBody,
            attachments: (msg.attachments || []).map((att) => ({
              id: att.attachmentId || "",
              name: att.filename,
              type: att.mimeType,
              attachmentId: att.attachmentId || undefined,
            })),
          })),
        };
      });

      return emails;
    } catch (error) {
      console.error("Failed to search emails:", error);
      throw error;
    }
  },

  /**
   * Sync emails to database for semantic search
   */
  async syncSemanticEmails(): Promise<void> {
    try {
      await apiClient.post<void>("/emails/sematic-sync");
    } catch (error) {
      console.error("Failed to sync semantic emails:", error);
      throw error;
    }
  },

  /**
   * Perform semantic search
   */
  async searchSemanticEmails(query: string): Promise<Email[]> {
    try {
      const response = await apiClient.get<EmailWorkflowResponse[]>(
        `/emails/search-sematic?query=${encodeURIComponent(query)}`,
      );

      // Transform EmailWorkflowResponse to Email format
      return response.map((workflowEmail) => ({
        id: workflowEmail.threadId, // Use threadId as ID for consistency with FE
        threadId: workflowEmail.threadId,
        from: parseEmailAddress(workflowEmail.from || ""),
        to: parseEmailAddresses(workflowEmail.to || ""),
        subject: workflowEmail.subject || "(No Subject)",
        preview:
          workflowEmail.snippet ||
          workflowEmail.summary ||
          (workflowEmail.body
            ? workflowEmail.body
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
              .replace(/<[^>]*>/g, "")
              .replace(/&nbsp;/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 100)
            : ""),
        body: workflowEmail.body || "",
        htmlBody: undefined,
        timestamp: workflowEmail.receivedAt || new Date().toISOString(),
        isRead: workflowEmail.isRead ?? true,
        isStarred: workflowEmail.isStarred ?? false,
        hasAttachments: workflowEmail.hasAttachments ?? false,
        attachments: [], // Attachments detais are not returned in this simple response
        mailboxId: "SEARCH_SEMANTIC",
        messageId: undefined,
        messages: undefined,
        snoozedUntil: workflowEmail.snoozedUntil,
        workflowEmailId: workflowEmail.id,
      }));
    } catch (error) {
      console.error("Failed to semantic search emails:", error);
      throw error;
    }
  },

  /**
   * Kanban API Methods
   */

  /**
   * Get all kanban columns
   */
  async getKanbanColumns(): Promise<Array<{ id: number; name: string }>> {
    try {
      const response =
        await apiClient.get<Array<{ id: number; name: string }>>(
          "/kanban/columns",
        );
      return response;
    } catch (error) {
      console.error("Failed to get kanban columns:", error);
      throw error;
    }
  },

  /**
   * Delete kanban column
   */
  async deleteKanbanColumn(kanbanColumnId: number): Promise<void> {
    try {
      await apiClient.delete<void>(`/kanban/columns/${kanbanColumnId}`);
    } catch (error) {
      console.error("Failed to delete kanban column:", error);
      throw error;
    }
  },
};
