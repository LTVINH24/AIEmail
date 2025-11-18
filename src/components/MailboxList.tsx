import { cn } from '@/lib/utils';
import type { Mailbox } from '@/types/email';
import { 
  Inbox, 
  Star, 
  Send, 
  FileEdit, 
  Archive, 
  Trash2, 
  Briefcase, 
  User,
  Mail 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MailboxListProps {
  mailboxes: Mailbox[];
  selectedMailboxId: string;
  onSelectMailbox: (mailboxId: string) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Inbox,
  Star,
  Send,
  FileEdit,
  Archive,
  Trash2,
  Briefcase,
  User,
  Mail,
};

export function MailboxList({ mailboxes, selectedMailboxId, onSelectMailbox }: MailboxListProps) {
  return (
    <div className="h-full flex flex-col bg-gray-50 border-r">
      <div className="p-4 border-b bg-white">
        <h2 className="font-semibold text-lg">Mailboxes</h2>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {mailboxes.map((mailbox) => {
            const Icon = iconMap[mailbox.icon] || Mail;
            const isSelected = mailbox.id === selectedMailboxId;
            
            return (
              <li key={mailbox.id}>
                <button
                  onClick={() => onSelectMailbox(mailbox.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                    isSelected
                      ? 'bg-blue-100 text-blue-900 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                  aria-label={`${mailbox.name} mailbox${mailbox.unreadCount ? `, ${mailbox.unreadCount} unread` : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{mailbox.name}</span>
                  </div>
                  {mailbox.unreadCount ? (
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        'ml-auto',
                        isSelected ? 'bg-blue-200 text-blue-900' : ''
                      )}
                    >
                      {mailbox.unreadCount}
                    </Badge>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
