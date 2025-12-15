const SEARCH_HISTORY_KEY = 'email_search_history';
const MAX_HISTORY_ITEMS = 10;

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

export const searchHistoryManager = {
  /**
   * Get search history from localStorage
   */
  getHistory(): SearchHistoryItem[] {
    try {
      const history = localStorage.getItem(SEARCH_HISTORY_KEY);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Failed to get search history:', error);
      return [];
    }
  },

  /**
   * Add a search query to history
   */
  addToHistory(query: string): void {
    if (!query.trim()) return;

    try {
      const history = this.getHistory();
      
      // Remove duplicate if exists
      const filtered = history.filter(item => item.query.toLowerCase() !== query.toLowerCase());
      
      // Add new item at the beginning
      const newHistory = [
        { query: query.trim(), timestamp: Date.now() },
        ...filtered
      ].slice(0, MAX_HISTORY_ITEMS);
      
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Failed to add to search history:', error);
    }
  },

  /**
   * Clear all search history
   */
  clearHistory(): void {
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  },

  /**
   * Get recent search queries (most recent first)
   */
  getRecentQueries(limit: number = 5): string[] {
    const history = this.getHistory();
    return history.slice(0, limit).map(item => item.query);
  },
};
