import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";

interface SnoozeModalProps {
  open: boolean;
  onClose: () => void;
  onSnooze: (date: Date) => void;
  emailSubject?: string;
}

const SNOOZE_OPTIONS = [
  { label: "In 1 hour", hours: 1 },
  { label: "In 3 hours", hours: 3 },
  { label: "Tomorrow 8:00", type: "tomorrow" },
  { label: "Next week", type: "next-week" },
  { label: "Next month", type: "next-month" },
] as const;

export function SnoozeModal({
  open,
  onClose,
  onSnooze,
  emailSubject,
}: SnoozeModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [customDateTime, setCustomDateTime] = useState("");
  const [error, setError] = useState<string>("");

  const calculateSnoozeDate = (
    option: (typeof SNOOZE_OPTIONS)[number],
  ): Date => {
    const now = new Date();

    if ("hours" in option) {
      return new Date(now.getTime() + option.hours * 60 * 60 * 1000);
    }

    switch (option.type) {
      case "tomorrow": {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(8, 0, 0, 0);
        return tomorrow;
      }
      case "next-week": {
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(8, 0, 0, 0);
        return nextWeek;
      }
      case "next-month": {
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setHours(8, 0, 0, 0);
        return nextMonth;
      }
      default:
        return now;
    }
  };

  const handleQuickSnooze = (option: (typeof SNOOZE_OPTIONS)[number]) => {
    const date = calculateSnoozeDate(option);
    setSelectedDate(date);
    setError("");
    setCustomDateTime("");
  };

  const handleCustomDateTime = (dateTimeString: string) => {
    setCustomDateTime(dateTimeString);
    if (dateTimeString) {
      const date = new Date(dateTimeString);
      setSelectedDate(date);

      if (date < new Date()) {
        setError("Cannot snooze to a past time");
      } else {
        setError("");
      }
    } else {
      setSelectedDate(null);
      setError("");
    }
  };

  const handleConfirm = () => {
    if (selectedDate) {
      if (selectedDate < new Date()) {
        setError("Cannot snooze to a past time");
        return;
      }
      onSnooze(selectedDate);
      onClose();
      // Reset state
      setSelectedDate(null);
      setCustomDateTime("");
      setError("");
    }
  };

  const handleCancel = () => {
    setSelectedDate(null);
    setCustomDateTime("");
    setError("");
    onClose();
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Snooze Email
          </DialogTitle>
          <DialogDescription>
            {emailSubject ? (
              <>
                Snooze email:{" "}
                <span className="font-medium">{emailSubject}</span>
              </>
            ) : (
              "Choose a time to snooze this email"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick Options */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Quick options
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {SNOOZE_OPTIONS.map((option, idx) => (
                <Button
                  key={idx}
                  type="button"
                  variant={
                    selectedDate &&
                    Math.abs(
                      selectedDate.getTime() -
                        calculateSnoozeDate(option).getTime(),
                    ) < 1000
                      ? "default"
                      : "outline"
                  }
                  className="w-full justify-start"
                  onClick={() => handleQuickSnooze(option)}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom DateTime Picker */}
          <div>
            <Label
              htmlFor="custom-datetime"
              className="text-sm font-medium mb-2 block"
            >
              Or choose a custom time
            </Label>
            <input
              id="custom-datetime"
              type="datetime-local"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={customDateTime}
              onChange={(e) => handleCustomDateTime(e.target.value)}
            />
            {error && <p className="text-sm text-destructive mt-1">{error}</p>}
          </div>

          {/* Selected Time Preview */}
          {selectedDate && !error && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <strong>Will be snoozed until:</strong>{" "}
              <span className="text-primary font-medium">
                {formatDate(selectedDate)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedDate || !!error}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
