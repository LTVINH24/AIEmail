import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Email } from '@/types/email';
import { Star, Paperclip, RefreshCw, Trash2, Mail, MailOpen, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface EmailListProps {
  emails: Email[];
  selectedEmailId: string | null;
  onSelectEmail: (emailId: string) => void;
  onToggleStar: (emailId: string) => void;
  onRefresh: () => void;
  onCompose: () => void;
  onDelete: (emailIds: string[]) => void;
  onToggleRead: (emailIds: string[]) => void;
}

export function EmailList({
  emails,
  selectedEmailId,
  onSelectEmail,
  onToggleStar,
  onRefresh,
  onCompose,
  onDelete,
  onToggleRead,
}: EmailListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelectAll = () => {
    if (selectedIds.size === emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map(e => e.id)));
    }
  };

  const handleToggleSelect = (emailId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    onDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleBulkToggleRead = () => {
    onToggleRead(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="h-full flex flex-col bg-white border-r">
      {/* Action Bar */}
      <div className="p-2 sm:p-4 border-b space-y-2">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <Button onClick={onCompose} size="sm" className="gap-1.5">
            <Edit className="h-4 w-4" />
            <span className="hidden xs:inline">Compose</span>
          </Button>
          <Button onClick={onRefresh} variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden xs:inline">Refresh</span>
          </Button>
        </div>
        
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="text-xs sm:text-sm text-gray-600">{selectedIds.size} selected</span>
            <Button onClick={handleBulkDelete} variant="outline" size="sm" className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Delete</span>
            </Button>
            <Button onClick={handleBulkToggleRead} variant="outline" size="sm" className="gap-1.5">
              <MailOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Toggle Read</span>
            </Button>
          </div>
        )}
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y">
          {/* Select All Row */}
          <div className="px-2 sm:px-4 py-2 bg-gray-50 border-b flex items-center gap-2 sm:gap-3">
            <Checkbox
              checked={selectedIds.size === emails.length && emails.length > 0}
              onCheckedChange={handleSelectAll}
              aria-label="Select all emails"
            />
            <span className="text-xs sm:text-sm text-gray-600">
              {emails.length} {emails.length === 1 ? 'email' : 'emails'}
            </span>
          </div>

          {/* Email Items */}
          {emails.length === 0 ? (
            <div className="p-4 sm:p-8 text-center text-gray-500">
              <Mail className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
              <p className="text-xs sm:text-sm">No emails in this folder</p>
            </div>
          ) : (
            emails.map((email) => {
              const isSelected = email.id === selectedEmailId;
              const isChecked = selectedIds.has(email.id);

              return (
                <div
                  key={email.id}
                  className={cn(
                    'px-2 sm:px-4 py-2 sm:py-3 cursor-pointer transition-colors hover:bg-gray-50',
                    isSelected && 'bg-blue-50 hover:bg-blue-50',
                    !email.isRead && 'bg-blue-50/30'
                  )}
                  onClick={() => onSelectEmail(email.id)}
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    {/* Checkbox */}
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => handleToggleSelect(email.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select email from ${email.from.name}`}
                    />

                    {/* Star */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(email.id);
                      }}
                      className="mt-0.5 sm:mt-1 shrink-0"
                      aria-label={email.isStarred ? 'Unstar email' : 'Star email'}
                    >
                      <Star
                        className={cn(
                          'h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors',
                          email.isStarred
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-400 hover:text-yellow-400'
                        )}
                      />
                    </button>

                    {/* Email Content */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
                        <span
                          className={cn(
                            'text-xs sm:text-sm truncate flex-1 min-w-0',
                            !email.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'
                          )}
                        >
                          {email.from.name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {email.hasAttachments && (
                            <Paperclip className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gray-400" />
                          )}
                          <span className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">
                            {formatTime(email.timestamp)}
                          </span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'text-xs sm:text-sm truncate mb-0.5 sm:mb-1',
                          !email.isRead ? 'font-medium text-gray-900' : 'text-gray-600'
                        )}
                      >
                        {email.subject}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500 truncate">
                        {email.preview}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
