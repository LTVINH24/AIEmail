import { useState, useEffect, useRef } from "react";
import { Search, X, Clock, Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { searchHistoryManager } from "@/utils/searchHistory";
import type { Email } from "@/types/email";

interface SearchBarProps {
  emails: Email[];
  onSearch: (query: string, isSemantic: boolean) => void;
  isSearching?: boolean;
  className?: string;
  value?: string;
}

interface Suggestion {
  type: "sender" | "subject" | "history";
  value: string;
  label: string;
}

export function SearchBar({
  emails,
  onSearch,
  isSearching = false,
  className,
  value,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSemantic, setIsSemantic] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      setQuery(value);
    }
  }, [value]);

  // Generate suggestions based on query
  useEffect(() => {
    if (!query.trim()) {
      // Show recent search history when input is empty
      const recentQueries = searchHistoryManager.getRecentQueries(5);
      setSuggestions(
        recentQueries.map((q) => ({
          type: "history",
          value: q,
          label: q,
        })),
      );
      return;
    }

    const queryLower = query.toLowerCase();
    const newSuggestions: Suggestion[] = [];

    // Get unique senders that match the query
    const senderMap = new Map<string, { name: string; email: string }>();
    emails.forEach((email) => {
      const senderKey = email.from.email.toLowerCase();
      if (
        !senderMap.has(senderKey) &&
        (email.from.name.toLowerCase().includes(queryLower) ||
          email.from.email.toLowerCase().includes(queryLower))
      ) {
        senderMap.set(senderKey, email.from);
      }
    });

    // Add sender suggestions (limit to 3)
    Array.from(senderMap.values())
      .slice(0, 3)
      .forEach((sender) => {
        // Use name for search if available, otherwise use email
        const searchValue = sender.name || sender.email;
        newSuggestions.push({
          type: "sender",
          value: searchValue,
          label: sender.name || sender.email,
        });
      });

    // Get subject keywords that match the query
    const subjectKeywords = new Set<string>();
    emails.forEach((email) => {
      const words = email.subject.toLowerCase().split(/\s+/);
      words.forEach((word) => {
        if (
          word.length > 3 &&
          word.includes(queryLower) &&
          !subjectKeywords.has(word)
        ) {
          subjectKeywords.add(word);
        }
      });
    });

    // Add subject suggestions (limit to 2)
    Array.from(subjectKeywords)
      .slice(0, 2)
      .forEach((keyword) => {
        newSuggestions.push({
          type: "subject",
          value: keyword,
          label: keyword,
        });
      });

    // Add matching search history
    const recentQueries = searchHistoryManager.getRecentQueries(10);
    recentQueries
      .filter((q) => q.toLowerCase().includes(queryLower))
      .slice(0, 2)
      .forEach((q) => {
        if (!newSuggestions.find((s) => s.value === q)) {
          newSuggestions.push({
            type: "history",
            value: q,
            label: q,
          });
        }
      });

    setSuggestions(newSuggestions.slice(0, 5));
  }, [query, emails]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (searchQuery: string) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    // Add to search history
    searchHistoryManager.addToHistory(trimmedQuery);

    // Trigger search
    onSearch(trimmedQuery, isSemantic);

    // Close suggestions
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowSuggestions(true);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        // Use selected suggestion
        const suggestion = suggestions[selectedIndex];
        setQuery(suggestion.value);
        handleSearch(suggestion.value);
      } else {
        // Use current query
        handleSearch(query);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setQuery(suggestion.value);
    handleSearch(suggestion.value);
  };

  const handleClear = () => {
    setQuery("");
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const getSuggestionIcon = (type: Suggestion["type"]) => {
    switch (type) {
      case "history":
        return <Clock className="h-4 w-4 text-gray-400" />;
      case "sender":
        return <span className="text-sm text-gray-400">👤</span>;
      case "subject":
        return <span className="text-sm text-gray-400">📧</span>;
      default:
        return null;
    }
  };

  const getSuggestionLabel = (suggestion: Suggestion) => {
    switch (suggestion.type) {
      case "history":
        return "Recent search";
      case "sender":
        return "From";
      case "subject":
        return "Subject";
      default:
        return "";
    }
  };

  return (
    <div className={cn("relative flex gap-2", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={
            isSemantic
              ? "Describe what to search (Semantic AI)..."
              : "Search emails..."
          }
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          disabled={isSearching}
          className="pl-10 pr-10"
        />
        {query && !isSearching && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>

      <Button
        variant={isSemantic ? "default" : "outline"}
        size="sm"
        onClick={() => setIsSemantic(!isSemantic)}
        title={
          isSemantic ? "Switch to Fuzzy Search" : "Switch to Semantic AI Search"
        }
        className={cn(
          "transition-colors gap-2 min-w-[120px]",
          isSemantic && "bg-purple-600 hover:bg-purple-700",
        )}
      >
        <Sparkles
          className={cn("h-4 w-4", isSemantic ? "text-white" : "text-gray-500")}
        />
        <span className={isSemantic ? "text-white" : "text-gray-700"}>
          {isSemantic ? "Semantic AI" : "Fuzzy Search"}
        </span>
      </Button>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 top-full left-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.type}-${suggestion.value}-${index}`}
              onClick={() => handleSuggestionClick(suggestion)}
              className={cn(
                "w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left",
                selectedIndex === index && "bg-gray-100",
              )}
            >
              {getSuggestionIcon(suggestion.type)}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {suggestion.label}
                </div>
                <div className="text-xs text-gray-500">
                  {getSuggestionLabel(suggestion)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
