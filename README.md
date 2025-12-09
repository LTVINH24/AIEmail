# AI Email Dashboard

A modern, responsive email dashboard built with React, TypeScript, and Tailwind CSS.

## Features

### Three-Column Layout

- **Left Column (20%)**: Mailbox/folder navigation
  - Inbox with unread count
  - Starred emails
  - Sent, Drafts, Archive, Trash
  - Custom folders (Work, Personal)
- **Middle Column (40%)**: Email list

  - Paginated/virtualized email list
  - Email preview with sender, subject, snippet, timestamp
  - Star/important indicators
  - Checkbox selection for bulk actions
  - Actions: Compose, Refresh, Select All, Delete, Mark Read/Unread

- **Right Column (40%)**: Email detail view
  - Full email display with from, to, cc, subject, date, body
  - HTML email rendering
  - Attachment display with download buttons
  - Actions: Reply, Reply All, Forward, Delete, Mark as Unread, Toggle Star

### Responsive Design

- **Desktop**: Full three-column layout
- **Tablet/Mobile**:
  - Collapsible sidebar menu for mailboxes
  - Toggle between list and detail views
  - Back button for navigation

### Accessibility

- Keyboard navigation support
- ARIA labels on interactive elements
- Proper semantic HTML structure

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **React Router DOM** - Routing
- **Tailwind CSS v4** - Styling
- **shadcn/ui** - UI components
- **Lucide React** - Icons
- **Vite** - Build tool

## Project Structure

```
src/
├── api/
│   └── mockData.ts          # Mock email data
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── ComposeEmailModal.tsx
│   ├── EmailDetail.tsx
│   ├── EmailList.tsx
│   └── MailboxList.tsx
├── pages/
│   └── InboxPage.tsx        # Main dashboard page
├── services/
│   └── emailService.ts      # Mock API service
├── types/
│   └── email.ts             # TypeScript types
├── App.tsx                  # Router setup
└── main.tsx                 # Entry point
```

## Mock API

The application uses a mock API with simulated endpoints:

- `GET /mailboxes` - List all mailboxes
- `GET /mailboxes/:id/emails` - List emails in a mailbox
- `GET /emails/:id` - Get email detail
- `PATCH /emails/:id` - Toggle read/star status
- `DELETE /emails/:id` - Move to trash
- `POST /emails` - Send email

All data is stored in `src/api/mockData.ts` with realistic sample emails.

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open your browser to the URL shown in the terminal (typically http://localhost:5173)

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Usage

### Navigation

- Click on mailbox folders to view emails
- Click on an email to view details
- Use checkboxes to select multiple emails for bulk actions

### Composing Emails

1. Click the "Compose" button
2. Fill in recipient, subject, and message
3. Click "Send"

### Email Actions

- **Star**: Click the star icon to mark important
- **Delete**: Select emails and click Delete
- **Mark Read/Unread**: Toggle read status
- **Reply/Forward**: Use action buttons in detail view

### Mobile Navigation

- Tap menu icon to access mailbox list
- Tap email to view details
- Use back button to return to list

## Components

### MailboxList

Displays folder navigation with unread counts and icons.

### EmailList

Shows paginated email list with bulk actions and selection.

### EmailDetail

Renders full email content with HTML support and attachments.

### ComposeEmailModal

Modal dialog for composing new emails.

### InboxPage

Main page component that orchestrates all three columns with responsive behavior.

## Styling

The project uses:

- Tailwind CSS for utility-first styling
- shadcn/ui for pre-built accessible components
- Custom CSS for email body rendering (prose styles)

## Future Enhancements

- [ ] Real authentication
- [ ] Backend API integration
- [ ] Email search functionality
- [ ] Filters and sorting
- [ ] Labels and categories
- [ ] Email composition with rich text editor
- [ ] Drag and drop attachments
- [ ] Keyboard shortcuts
- [ ] Dark mode toggle
- [ ] Email threading/conversations

## Snooze (Deferral) — Frontend usage and developer notes

User-facing behavior

- A `Snooze` action is available in the email detail view. When triggered, a modal offers quick options (e.g. In 1 hour, In 3 hours, Tomorrow 8:00, Next week, Next month) and a custom datetime picker.
- When the user confirms a snooze time, the frontend sends a request to the backend to create/update a workflow record for the email's `threadId` and sets `snoozedUntil` accordingly. The UI moves the email to the `Snoozed` mailbox or column and hides it from the inbox until the snooze expires.

API call (frontend)

- `POST /api/emails/thread/{threadId}/snooze` with body `{"snoozeTime":"<ISO-8601 timestamp>"}` — requested by the snooze modal.
- The frontend also uses `GET /api/emails?status=SNOOZED` to populate the Snoozed column.

Developer notes / integration

- The `SnoozeModal` component (`src/components/dashboard/SnoozeModal.tsx`) provides quick options and a `datetime-local` input for custom times.
- Frontend merge logic: the UI merges Gmail/proxy email data with workflow DB records. To avoid console 404 spam and incorrect state overwrites, prefer a batch fetch of workflow items and merge by `threadId` at list load, and avoid per-thread GET calls during prefetch.
- The UI implements optimistic updates for toggles (star/read) and will roll back on error; ensure the backend has the appropriate `PATCH` endpoints or a create-workflow endpoint for persisting toggles when no workflow record exists.

## Google OAuth Credentials (optional — Track A)

To enable Google OAuth login (if you implement Track A), create OAuth 2.0 credentials:

1. In Google Cloud Console go to APIs & Services → Credentials.
2. Configure the OAuth consent screen for your project.
3. Create OAuth client ID (Web application).

- Add Authorized JavaScript origins (e.g. `http://localhost:5173`).
- Add Authorized redirect URIs (match backend callback route, e.g. `http://localhost:8080/auth/google/callback`).

4. Store the `CLIENT_ID` and `CLIENT_SECRET` as environment variables.

On the backend, use these credentials to complete the OAuth exchange and issue application tokens.

## Token storage & security

This project uses a secure token strategy for real deployments:

- Use a short-lived access token (JWT) for API calls and a long-lived refresh token stored server-side.
- Store tokens in secure, HttpOnly cookies with `SameSite` set to reduce XSS/CSRF exposure.
- Rotate and revoke refresh tokens on use to prevent replay attacks.

## License

MIT
