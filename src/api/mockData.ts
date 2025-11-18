import type { Mailbox, Email } from '../types/email';

export const mockMailboxes: Mailbox[] = [
  {
    id: 'inbox',
    name: 'Inbox',
    icon: 'Inbox',
    unreadCount: 8,
    type: 'inbox',
  },
  {
    id: 'starred',
    name: 'Starred',
    icon: 'Star',
    unreadCount: 3,
    type: 'starred',
  },
  {
    id: 'sent',
    name: 'Sent',
    icon: 'Send',
    type: 'sent',
  },
  {
    id: 'drafts',
    name: 'Drafts',
    icon: 'FileEdit',
    unreadCount: 1,
    type: 'drafts',
  },
  {
    id: 'archive',
    name: 'Archive',
    icon: 'Archive',
    type: 'archive',
  },
  {
    id: 'trash',
    name: 'Trash',
    icon: 'Trash2',
    type: 'trash',
  },
  {
    id: 'work',
    name: 'Work',
    icon: 'Briefcase',
    unreadCount: 1,
    type: 'custom',
  },
  {
    id: 'personal',
    name: 'Personal',
    icon: 'User',
    unreadCount: 0,
    type: 'custom',
  },
];

export const mockEmails: Email[] = [
  {
    id: '1',
    from: {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@company.com',
    },
    to: [
      {
        name: 'You',
        email: 'you@example.com',
      },
    ],
    cc: [
      {
        name: 'Team',
        email: 'team@company.com',
      },
    ],
    subject: 'Q4 Project Review Meeting',
    preview: 'Hi team, I wanted to schedule our quarterly project review for next week...',
    body: `<p>Hi team,</p>
    <p>I wanted to schedule our quarterly project review for next week. Please let me know your availability for the following time slots:</p>
    <ul>
      <li>Monday, 2:00 PM - 3:30 PM</li>
      <li>Wednesday, 10:00 AM - 11:30 AM</li>
      <li>Friday, 3:00 PM - 4:30 PM</li>
    </ul>
    <p>We'll be discussing:</p>
    <ol>
      <li>Project milestones achieved</li>
      <li>Budget review</li>
      <li>Q1 planning</li>
    </ol>
    <p>Looking forward to hearing from you!</p>
    <p>Best regards,<br/>Sarah Johnson<br/>Project Manager</p>`,
    timestamp: '2025-11-18T09:30:00Z',
    isRead: false,
    isStarred: true,
    hasAttachments: true,
    attachments: [
      {
        id: 'att1',
        name: 'Q4_Report.pdf',
        size: 2457600,
        type: 'application/pdf',
        url: '#',
      },
    ],
    mailboxId: 'inbox',
  },
  {
    id: '2',
    from: {
      name: 'Marketing Team',
      email: 'marketing@company.com',
    },
    to: [
      {
        name: 'All Staff',
        email: 'all@company.com',
      },
    ],
    subject: 'New Brand Guidelines Available',
    preview: 'We are excited to announce that our updated brand guidelines are now available...',
    body: `<p>Dear colleagues,</p>
    <p>We are excited to announce that our updated brand guidelines are now available for download.</p>
    <p>The new guidelines include:</p>
    <ul>
      <li>Updated logo variations</li>
      <li>Color palette specifications</li>
      <li>Typography standards</li>
      <li>Social media templates</li>
    </ul>
    <p>Please ensure all future marketing materials comply with these guidelines.</p>
    <p>Thanks,<br/>Marketing Team</p>`,
    timestamp: '2025-11-18T08:15:00Z',
    isRead: false,
    isStarred: false,
    hasAttachments: false,
    mailboxId: 'inbox',
  },
  {
    id: '3',
    from: {
      name: 'John Smith',
      email: 'john.smith@partner.com',
    },
    to: [
      {
        name: 'You',
        email: 'you@example.com',
      },
    ],
    subject: 'Re: Partnership Proposal',
    preview: 'Thank you for your proposal. After reviewing it with our team, we would like to move forward...',
    body: `<p>Hi,</p>
    <p>Thank you for your proposal. After reviewing it with our team, we would like to move forward with the partnership.</p>
    <p>Can we schedule a call this week to discuss the next steps?</p>
    <p>Best,<br/>John Smith<br/>Business Development Manager</p>`,
    timestamp: '2025-11-17T16:45:00Z',
    isRead: true,
    isStarred: true,
    hasAttachments: false,
    mailboxId: 'work',
  },
  {
    id: '4',
    from: {
      name: 'IT Support',
      email: 'support@company.com',
    },
    to: [
      {
        name: 'You',
        email: 'you@example.com',
      },
    ],
    subject: 'System Maintenance Scheduled',
    preview: 'This is to inform you that we will be performing system maintenance on Saturday...',
    body: `<p>Dear user,</p>
    <p>This is to inform you that we will be performing system maintenance on Saturday, November 23rd, from 2:00 AM to 6:00 AM.</p>
    <p>During this time, the following services will be unavailable:</p>
    <ul>
      <li>Email access</li>
      <li>File sharing</li>
      <li>VPN connections</li>
    </ul>
    <p>We apologize for any inconvenience.</p>
    <p>IT Support Team</p>`,
    timestamp: '2025-11-17T14:20:00Z',
    isRead: true,
    isStarred: false,
    hasAttachments: false,
    mailboxId: 'inbox',
  },
  {
    id: '5',
    from: {
      name: 'Newsletter',
      email: 'newsletter@tech.com',
    },
    to: [
      {
        name: 'You',
        email: 'you@example.com',
      },
    ],
    subject: 'Weekly Tech Digest - AI Trends 2025',
    preview: "This week's highlights: Latest developments in AI, cloud computing updates...",
    body: `<h2>Weekly Tech Digest</h2>
    <p>This week's highlights:</p>
    <h3>AI Trends 2025</h3>
    <p>Discover the latest developments in artificial intelligence and machine learning.</p>
    <h3>Cloud Computing Updates</h3>
    <p>Major cloud providers announce new features and pricing changes.</p>
    <h3>Cybersecurity Alert</h3>
    <p>Important security patches released for popular frameworks.</p>
    <p>Read more on our website.</p>`,
    timestamp: '2025-11-17T10:00:00Z',
    isRead: false,
    isStarred: false,
    hasAttachments: false,
    mailboxId: 'inbox',
  },
  {
    id: '6',
    from: {
      name: 'Emily Chen',
      email: 'emily.chen@company.com',
    },
    to: [
      {
        name: 'You',
        email: 'you@example.com',
      },
    ],
    subject: 'Design Review Feedback',
    preview: "I've reviewed the latest designs and have some feedback to share...",
    body: `<p>Hi,</p>
    <p>I've reviewed the latest designs and have some feedback to share:</p>
    <p><strong>Overall:</strong> Great work! The design direction is solid.</p>
    <p><strong>Suggestions:</strong></p>
    <ul>
      <li>Consider increasing the contrast ratio for better accessibility</li>
      <li>The mobile layout needs some refinement</li>
      <li>Navigation could be more intuitive</li>
    </ul>
    <p>Let's discuss these points in our next meeting.</p>
    <p>Emily</p>`,
    timestamp: '2025-11-16T15:30:00Z',
    isRead: true,
    isStarred: true,
    hasAttachments: true,
    attachments: [
      {
        id: 'att2',
        name: 'design_mockup.fig',
        size: 5242880,
        type: 'application/octet-stream',
        url: '#',
      },
    ],
    mailboxId: 'inbox',
  },
  {
    id: '7',
    from: {
      name: 'HR Department',
      email: 'hr@company.com',
    },
    to: [
      {
        name: 'All Employees',
        email: 'all@company.com',
      },
    ],
    subject: 'Holiday Schedule 2026',
    preview: 'Please find attached the official holiday schedule for 2026...',
    body: `<p>Dear team,</p>
    <p>Please find attached the official holiday schedule for 2026.</p>
    <p>Remember to submit your vacation requests at least two weeks in advance.</p>
    <p>Best regards,<br/>HR Department</p>`,
    timestamp: '2025-11-16T09:00:00Z',
    isRead: false,
    isStarred: false,
    hasAttachments: true,
    attachments: [
      {
        id: 'att3',
        name: 'Holiday_Schedule_2026.pdf',
        size: 102400,
        type: 'application/pdf',
        url: '#',
      },
    ],
    mailboxId: 'inbox',
  },
  {
    id: '8',
    from: {
      name: 'Michael Brown',
      email: 'michael@client.com',
    },
    to: [
      {
        name: 'You',
        email: 'you@example.com',
      },
    ],
    subject: 'Project Deliverables - Action Required',
    preview: 'Could you please provide an update on the project deliverables?',
    body: `<p>Hi,</p>
    <p>Could you please provide an update on the project deliverables? We need to review them before the end of this week.</p>
    <p>Specifically, we're looking for:</p>
    <ol>
      <li>Technical documentation</li>
      <li>Test results</li>
      <li>Deployment plan</li>
    </ol>
    <p>Thanks,<br/>Michael</p>`,
    timestamp: '2025-11-15T11:20:00Z',
    isRead: false,
    isStarred: false,
    hasAttachments: false,
    mailboxId: 'inbox',
  },
  {
    id: '9',
    from: {
      name: 'You',
      email: 'you@example.com',
    },
    to: [
      {
        name: 'Client Team',
        email: 'team@client.com',
      },
    ],
    subject: 'Meeting Notes - November 14',
    preview: 'Thank you for attending the meeting. Here are the key points discussed...',
    body: `<p>Hi team,</p>
    <p>Thank you for attending the meeting. Here are the key points discussed:</p>
    <ul>
      <li>Project timeline approved</li>
      <li>Budget allocation finalized</li>
      <li>Next milestone: December 1st</li>
    </ul>
    <p>Please let me know if I missed anything.</p>
    <p>Best regards</p>`,
    timestamp: '2025-11-14T16:00:00Z',
    isRead: true,
    isStarred: false,
    hasAttachments: false,
    mailboxId: 'inbox',
  },
  {
    id: '10',
    from: {
      name: 'You',
      email: 'you@example.com',
    },
    to: [
      {
        name: 'Manager',
        email: 'manager@company.com',
      },
    ],
    subject: 'Draft: Budget Proposal for Q1',
    preview: 'I am working on the budget proposal and wanted to get your input...',
    body: `<p>Hi,</p>
    <p>I am working on the budget proposal and wanted to get your input before finalizing it.</p>
    <p>Draft attached.</p>`,
    timestamp: '2025-11-18T07:30:00Z',
    isRead: true,
    isStarred: false,
    hasAttachments: true,
    attachments: [
      {
        id: 'att4',
        name: 'Q1_Budget_Draft.xlsx',
        size: 307200,
        type: 'application/vnd.ms-excel',
        url: '#',
      },
    ],
    mailboxId: 'drafts',
  },
];
