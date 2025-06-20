// Session persistence utilities for chat application
// This ensures proper state restoration across page refreshes and reconnections

export class SessionManager {
  static KEYS = {
    SELECTED_USER: 'chatty_selected_user',
    CHAT_PREFERENCES: 'chatty_chat_prefs',
    LAST_ACTIVITY: 'chatty_last_activity'
  };

  // Save selected user to session storage
  static saveSelectedUser(user) {
    try {
      if (user && user._id) {
        const userData = {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          avatar: user.avatar,
          savedAt: Date.now()
        };
        sessionStorage.setItem(this.KEYS.SELECTED_USER, JSON.stringify(userData));
        console.log('Saved selected user to session:', user.fullName);
        return true;
      } else {
        this.clearSelectedUser();
        return false;
      }
    } catch (error) {
      console.error('Failed to save selected user:', error);
      return false;
    }
  }

  // Load selected user from session storage
  static loadSelectedUser() {
    try {
      const stored = sessionStorage.getItem(this.KEYS.SELECTED_USER);
      if (!stored) return null;

      const userData = JSON.parse(stored);
      
      // Check if the stored data is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - userData.savedAt > maxAge) {
        console.log('Stored user data is too old, clearing');
        this.clearSelectedUser();
        return null;
      }

      console.log('Loaded selected user from session:', userData.fullName);
      return userData;
    } catch (error) {
      console.error('Failed to load selected user:', error);
      this.clearSelectedUser();
      return null;
    }
  }

  // Clear selected user from session storage
  static clearSelectedUser() {
    try {
      sessionStorage.removeItem(this.KEYS.SELECTED_USER);
      console.log('Cleared selected user from session');
    } catch (error) {
      console.error('Failed to clear selected user:', error);
    }
  }

  // Save chat preferences
  static saveChatPreferences(preferences) {
    try {
      const prefs = {
        ...preferences,
        savedAt: Date.now()
      };
      localStorage.setItem(this.KEYS.CHAT_PREFERENCES, JSON.stringify(prefs));
      return true;
    } catch (error) {
      console.error('Failed to save chat preferences:', error);
      return false;
    }
  }

  // Load chat preferences
  static loadChatPreferences() {
    try {
      const stored = localStorage.getItem(this.KEYS.CHAT_PREFERENCES);
      if (!stored) return null;

      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to load chat preferences:', error);
      return null;
    }
  }

  // Update last activity timestamp
  static updateLastActivity() {
    try {
      localStorage.setItem(this.KEYS.LAST_ACTIVITY, Date.now().toString());
    } catch (error) {
      console.error('Failed to update last activity:', error);
    }
  }

  // Get last activity timestamp
  static getLastActivity() {
    try {
      const stored = localStorage.getItem(this.KEYS.LAST_ACTIVITY);
      return stored ? parseInt(stored, 10) : null;
    } catch (error) {
      console.error('Failed to get last activity:', error);
      return null;
    }
  }

  // Clear all session data
  static clearAllSessionData() {
    try {
      sessionStorage.removeItem(this.KEYS.SELECTED_USER);
      console.log('Cleared all session data');
    } catch (error) {
      console.error('Failed to clear session data:', error);
    }
  }

  // Validate user data structure
  static validateUserData(user) {
    if (!user || typeof user !== 'object') return false;
    
    const requiredFields = ['_id', 'fullName', 'email'];
    return requiredFields.every(field => user[field] && typeof user[field] === 'string');
  }
}

// Connection state manager for handling reconnections
export class ConnectionManager {
  static listeners = new Set();

  static addListener(callback) {
    this.listeners.add(callback);
  }

  static removeListener(callback) {
    this.listeners.delete(callback);
  }

  static notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  static handleReconnection(authUser) {
    console.log('Handling reconnection for user:', authUser?.fullName);
    
    // Notify all listeners about reconnection
    this.notifyListeners('reconnection', { authUser });
    
    // Update last activity
    SessionManager.updateLastActivity();
  }

  static handleDisconnection() {
    console.log('Handling disconnection');
    
    // Notify all listeners about disconnection
    this.notifyListeners('disconnection', {});
  }
}

// Message sync manager for ensuring message history consistency
export class MessageSyncManager {
  static pendingSync = new Map();
  static syncInProgress = new Set();

  // Queue a message history sync
  static queueSync(userId, priority = 'normal') {
    if (this.syncInProgress.has(userId)) {
      console.log('Sync already in progress for user:', userId);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.pendingSync.set(userId, {
        resolve,
        reject,
        priority,
        timestamp: Date.now()
      });

      // Process queue
      this.processQueue();
    });
  }

  // Process the sync queue
  static async processQueue() {
    if (this.pendingSync.size === 0) return;

    // Sort by priority and timestamp
    const sortedEntries = Array.from(this.pendingSync.entries()).sort((a, b) => {
      const [, dataA] = a;
      const [, dataB] = b;
      
      if (dataA.priority === 'high' && dataB.priority !== 'high') return -1;
      if (dataA.priority !== 'high' && dataB.priority === 'high') return 1;
      
      return dataA.timestamp - dataB.timestamp;
    });

    // Process first item in queue
    const [userId, syncData] = sortedEntries[0];
    this.pendingSync.delete(userId);
    this.syncInProgress.add(userId);

    try {
      // Import chat state and perform sync
      const { chatState } = await import('../state/chatState.js');
      await chatState.getState().history(userId);
      
      syncData.resolve();
      console.log('Message sync completed for user:', userId);
    } catch (error) {
      console.error('Message sync failed for user:', userId, error);
      syncData.reject(error);
    } finally {
      this.syncInProgress.delete(userId);
      
      // Process next item in queue if any
      if (this.pendingSync.size > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  // Clear sync queue for a user
  static clearSync(userId) {
    const syncData = this.pendingSync.get(userId);
    if (syncData) {
      this.pendingSync.delete(userId);
      syncData.reject(new Error('Sync cancelled'));
    }
    this.syncInProgress.delete(userId);
  }

  // Clear all pending syncs
  static clearAllSyncs() {
    this.pendingSync.forEach(syncData => {
      syncData.reject(new Error('All syncs cancelled'));
    });
    this.pendingSync.clear();
    this.syncInProgress.clear();
  }
}

// Error recovery manager
export class ErrorRecoveryManager {
  static retryAttempts = new Map();
  static maxRetries = 3;
  static retryDelay = 1000; // Start with 1 second

  // Attempt to recover from an error with exponential backoff
  static async attemptRecovery(operation, operationName, maxRetries = this.maxRetries) {
    const attemptKey = operationName;
    const currentAttempts = this.retryAttempts.get(attemptKey) || 0;

    if (currentAttempts >= maxRetries) {
      console.error(`Max retry attempts reached for ${operationName}`);
      this.retryAttempts.delete(attemptKey);
      throw new Error(`Operation failed after ${maxRetries} attempts: ${operationName}`);
    }

    try {
      const result = await operation();
      this.retryAttempts.delete(attemptKey); // Reset on success
      return result;
    } catch (error) {
      const newAttemptCount = currentAttempts + 1;
      this.retryAttempts.set(attemptKey, newAttemptCount);
      
      const delay = this.retryDelay * Math.pow(2, newAttemptCount - 1);
      console.log(`Retrying ${operationName} in ${delay}ms (attempt ${newAttemptCount}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.attemptRecovery(operation, operationName, maxRetries);
    }
  }

  // Clear retry state
  static clearRetryState(operationName) {
    if (operationName) {
      this.retryAttempts.delete(operationName);
    } else {
      this.retryAttempts.clear();
    }
  }
}