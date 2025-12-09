import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (email: { to: string; subject: string; body: string }) => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
}

export function ComposeEmailModal({
  isOpen,
  onClose,
  onSend,
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
}: ComposeEmailModalProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);

  const handleSend = () => {
    if (!to || !subject) {
      alert('Please fill in recipient and subject');
      return;
    }
    onSend({ to, subject, body });
    handleClose();
  };

  const handleClose = () => {
    setTo('');
    setSubject('');
    setBody('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="email"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <textarea
              id="body"
              className="w-full min-h-[200px] px-3 py-2 text-sm border rounded-md resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Write your message here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSend}>Send</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
