import { useState } from "react";
import type { Email } from "@/types/email";
import { Card, CardContent } from "@/components/ui/card";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmailSummaryModal } from "./EmailSummaryModal";
import { cn } from "@/lib/utils";
import { Paperclip, Star, Sparkles } from "lucide-react";

interface KanbanCardProps {
  email: Email;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function KanbanCard({
  email,
  isSelected,
  isDragging,
  onSelect,
  onDragStart,
  onDragEnd,
}: KanbanCardProps) {
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAISummary = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection when clicking AI Summary button
    setShowSummaryModal(true);
  };

  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={cn(
        "group relative cursor-grab active:cursor-grabbing transition-all duration-300 hover:shadow-md mb-2 border hover:border-primary/50 shadow-sm overflow-hidden",
        isSelected
          ? "ring-2 ring-primary border-primary shadow-md"
          : "border-transparent bg-background/50",
        isDragging && "opacity-50",
        !email.isRead ? "bg-background" : "bg-background/40" // More subtle background diff
      )}
    >
      {/* Status Strip - Only for unread */}
      {!email.isRead && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-md" />
      )}

      <CardContent className="p-3 pl-4 space-y-2">
        {/* Header: Sender & Date */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 shrink-0 ring-1 ring-background shadow-sm">
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                {getInitials(email.from.name)}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "text-sm truncate font-medium",
                !email.isRead ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {email.from.name || email.from.email}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
            {formatDate(email.timestamp)}
          </span>
        </div>

        {/* Subject */}
        <h4
          className={cn(
            "text-sm leading-snug line-clamp-2",
            !email.isRead
              ? "font-semibold text-foreground"
              : "text-muted-foreground font-normal"
          )}
        >
          {email.subject || "(No Subject)"}
        </h4>

        {/* Preview */}
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed opacity-90">
          {email.preview}
        </p>

        {/* Footer: Badges & Actions */}
        <div className="flex items-center justify-between pt-1 gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {email.isStarred && (
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            )}
            {email.hasAttachments && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground text-[10px] font-medium border border-border/50">
                <Paperclip className="h-3 w-3" />
                <span>{email.attachments?.length || 1}</span>
              </div>
            )}
          </div>

          <Button
            onClick={handleAISummary}
            variant="ghost"
            size="sm"
            className="h-6 px-2 py-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-full flex items-center gap-1.5 cursor-pointer"
            title="AI Summary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium">AI Summary</span>
          </Button>
        </div>
      </CardContent>

      {/* Email Summary Modal */}
      <EmailSummaryModal
        open={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        messageId={email.messages?.[0]?.id || email.id}
        emailSubject={email.subject}
      />
    </Card>
  );
}
