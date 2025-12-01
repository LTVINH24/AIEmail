import { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
import { Paperclip, X } from 'lucide-react';

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (email: { to: string; subject: string; body: string; cc?: string; bcc?: string; attachments?: File[] }) => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  defaultCc?: string;
  defaultBcc?: string;
}

export function ComposeEmailModal({
  isOpen,
  onClose,
  onSend,
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
  defaultCc = '',
  defaultBcc = '',
}: ComposeEmailModalProps) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState(defaultCc);
  const [bcc, setBcc] = useState(defaultBcc);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showCc, setShowCc] = useState(!!defaultCc);
  const [showBcc, setShowBcc] = useState(!!defaultBcc);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTo(defaultTo);
      setCc(defaultCc);
      setBcc(defaultBcc);
      setSubject(defaultSubject);
      setBody(defaultBody);
      setShowCc(!!defaultCc);
      setShowBcc(!!defaultBcc);
    }
  }, [isOpen, defaultTo, defaultCc, defaultBcc, defaultSubject, defaultBody]);

  const handleSend = async () => {
    if (!to || !subject) {
      toast.error('Please fill in recipient and subject');
      return;
    }

    setIsSending(true);
    try {
      await onSend({ 
        to, 
        subject, 
        body,
        cc: cc || undefined,
        bcc: bcc || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      handleClose();
    } catch (error) {
      console.log(error)
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setTo('');
    setCc('');
    setBcc('');
    setSubject('');
    setBody('');
    setAttachments([]);
    setShowCc(false);
    setShowBcc(false);
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="to">To</Label>
              <div className="flex gap-2 text-sm">
                {!showCc && (
                  <button
                    onClick={() => setShowCc(true)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button
                    onClick={() => setShowBcc(true)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Bcc
                  </button>
                )}
              </div>
            </div>
            <Input
              id="to"
              type="email"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {showCc && (
            <div className="space-y-2">
              <Label htmlFor="cc">Cc</Label>
              <Input
                id="cc"
                type="email"
                placeholder="cc@example.com"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
              />
            </div>
          )}

          {showBcc && (
            <div className="space-y-2">
              <Label htmlFor="bcc">Bcc</Label>
              <Input
                id="bcc"
                type="email"
                placeholder="bcc@example.com"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
              />
            </div>
          )}
          
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

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              <Label>Attachments</Label>
              <div className="space-y-1">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Paperclip className="h-4 w-4 shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-gray-500 shrink-0">
                        ({formatFileSize(file.size)})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(index)}
                      className="h-6 w-6 p-0 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div>
            <input
              type="file"
              id="attachment-input"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('attachment-input')?.click()}
              className="gap-2"
            >
              <Paperclip className="h-4 w-4" />
              Attach
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isSending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
