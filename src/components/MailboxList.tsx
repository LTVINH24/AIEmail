import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
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
  Mail,
  LogOut,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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
      
      {/* User Profile Section */}
      <div className="p-3 border-t bg-white">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start h-auto p-2 hover:bg-gray-100">
              <div className="flex items-center gap-3 w-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {user ? getUserInitials(user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
