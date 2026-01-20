# AI Email Dashboard - Frontend

**Team:** 22120376-22120433-22120434

A modern, responsive email dashboard built with React 19, TypeScript, and Tailwind CSS v4. It serves as the interface for the AI-powered mail client, featuring a Kanban-style workflow, AI summarization, and seamless Gmail integration.

## Contributors

| Student ID   | Full Name       |
| :----------- | :-------------- |
| **22120376** | Nguyễn Đức Toàn |
| **22120433** | Lê Quang Vinh   |
| **22120434** | Lê Thành Vinh   |

---

## Key Features

### Three-Column Layout

- **Mailbox List**: Customizable navigation/folders with unread counts.
- **Email List**: Virtualized scroll for performance, bulk actions, and rich previews.
- **Detail View**: Full HTML rendering, attachment preview, and conversation actions.

### Kanban Board View

- **Workflow Management**: Organize emails into "Inbox", "To Do", "Doing", "Done".
- **Drag & Drop**: Smooth interactions to change email status.
- **Custom Columns**: Create, rename, and delete columns to fit your workflow.

### AI Integration

- **Smart Summaries**: One-click generation of concise email summaries using Gemini LLM.
- **Semantic Search**: Search by meaning (e.g., "travel plans") rather than just keywords.
- **Smart Suggestions**: Auto-complete and suggestion dropdowns.

### Snooze & Deferral

- **Snooze Modal**: Defer emails to a later time (Tomorrow, Next Week, Custom Date).
- **Auto-Return**: Snoozed emails disappear from the inbox and reappear automatically when due.

### Advanced Search & Filter

- **Fuzzy Search**: Tolerates typos in sender names or subjects.
- **Filters**: Filter by Unread, Has Attachments, or specific labels.
- **Sorting**: Sort by Date, Sender, etc.

---

## Technology Stack

- **Core**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4, shadcn/ui
- **State/Logic**: React Router DOM, Axios
- **Performance**: react-window (Virtualization for long lists)
- **Icons**: Lucide React

---

## Setup and Installation

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm or yarn

### 1. Installation

```bash
git clone https://github.com/LTVINH24/AIEmail.git
cd AIEmail
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# URL of the Spring Boot Backend
VITE_API_BASE_URL=http://localhost:8080/api

# Google OAuth Callback URL (must match Google Console)
VITE_GOOGLE_REDIRECT_URI=http://localhost:5174/auth/google/callback
```

### 3. Run Development Server

```bash
npm run dev
```

The application will start at `http://localhost:5174`.

---

## User Flows

1. **Login**: User clicks "Login with Google" -> Redirects to Google -> Returns with Code -> Backend exchanges for JWT & Google Tokens.
2. **AI Summary**: User opens email -> Backend fetches content -> Sends to Gemini API -> Returns concise summary.
3. **Semantic Search**: User searches "receipts" -> Backend converts query to vector -> Compares with email embedding vectors -> Returns semantically related emails (e.g., invoices).
4. **Snooze**: User snoozes email -> Backend marks status as 'SNOOZED' -> Scheduled task checks periodically -> Restores email to Inbox when time expires.

---

## License

MIT
