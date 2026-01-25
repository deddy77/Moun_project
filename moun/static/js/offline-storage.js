// IndexedDB Manager for Offline Storage
class OfflineStorage {
    constructor() {
        this.dbName = 'TogetherDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores
                if (!db.objectStoreNames.contains('users')) {
                    const userStore = db.createObjectStore('users', { keyPath: 'id' });
                    userStore.createIndex('username', 'username', { unique: false });
                }

                if (!db.objectStoreNames.contains('rooms')) {
                    const roomStore = db.createObjectStore('rooms', { keyPath: 'id' });
                    roomStore.createIndex('topic', 'topic', { unique: false });
                }

                if (!db.objectStoreNames.contains('messages')) {
                    const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
                    messageStore.createIndex('room_id', 'room_id', { unique: false });
                    messageStore.createIndex('created', 'created', { unique: false });
                }

                if (!db.objectStoreNames.contains('conversations')) {
                    db.createObjectStore('conversations', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('direct_messages')) {
                    const dmStore = db.createObjectStore('direct_messages', { keyPath: 'id' });
                    dmStore.createIndex('conversation_id', 'conversation_id', { unique: false });
                }

                if (!db.objectStoreNames.contains('pending_actions')) {
                    const actionStore = db.createObjectStore('pending_actions', { keyPath: 'id', autoIncrement: true });
                    actionStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('follow_data')) {
                    const followStore = db.createObjectStore('follow_data', { keyPath: 'id' });
                    followStore.createIndex('user_id', 'user_id', { unique: false });
                }
            };
        });
    }

    async saveData(storeName, data) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            if (Array.isArray(data)) {
                data.forEach(item => store.put(item));
            } else {
                store.put(data);
            }

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async getData(storeName, key = null) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            let request;
            if (key) {
                request = store.get(key);
            } else {
                request = store.getAll();
            }

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearStore(storeName) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async savePendingAction(action) {
        const pendingAction = {
            ...action,
            timestamp: Date.now(),
            synced: false
        };
        await this.saveData('pending_actions', pendingAction);
    }

    async getPendingActions() {
        return await this.getData('pending_actions');
    }

    async deletePendingAction(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pending_actions'], 'readwrite');
            const store = transaction.objectStore('pending_actions');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Global instance
const offlineStorage = new OfflineStorage();

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        offlineStorage.init().catch(console.error);
    });
} else {
    offlineStorage.init().catch(console.error);
}

// Network status monitoring
class NetworkMonitor {
    constructor() {
        this.isOnline = navigator.onLine;
        this.isServerOnline = true; // Track server status separately
        this.listeners = [];
        this.serverCheckInterval = null;
        this.init();
    }

    init() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showNotification('Back online! Checking server...', 'success');
            this.notifyListeners(true);
            this.checkServerStatus(); // Check if server is actually working
            this.syncPendingActions();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.isServerOnline = false;
            this.showNotification('You are offline. Some features may be limited.', 'warning');
            this.notifyListeners(false);
            this.stopServerCheck();
        });
        
        // Listen for server offline signals from service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'SERVER_OFFLINE') {
                    this.handleServerOffline();
                }
            });
        }
        
        // Initial server check
        this.checkServerStatus();
        
        // Periodic server check every 30 seconds
        this.serverCheckInterval = setInterval(() => {
            if (this.isOnline && !this.isServerOnline) {
                this.checkServerStatus();
            }
        }, 30000);

        this.updateUI();
    }
    
    async checkServerStatus() {
        try {
            // Try to fetch a lightweight endpoint
            const response = await fetch('/check_user_status/', {
                method: 'GET',
                cache: 'no-store'
            });
            
            const wasServerOffline = !this.isServerOnline;
            
            if (response.ok) {
                this.isServerOnline = true;
                if (wasServerOffline) {
                    this.showNotification('Server is back online! ✅', 'success');
                    this.syncPendingActions();
                }
            } else if (response.status >= 500) {
                this.isServerOnline = false;
                this.showNotification('Server is offline. Showing cached data...', 'warning');
            }
            
            this.updateUI();
        } catch (error) {
            // Network error - already handled by offline event
        }
    }
    
    handleServerOffline() {
        if (this.isServerOnline) {
            this.isServerOnline = false;
            this.showNotification('Server is offline. Showing cached data...', 'warning');
            this.updateUI();
        }
    }
    
    stopServerCheck() {
        if (this.serverCheckInterval) {
            clearInterval(this.serverCheckInterval);
            this.serverCheckInterval = null;
        }
    }

    addListener(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(status) {
        this.listeners.forEach(callback => callback(status));
    }

    updateUI() {
        const indicator = document.getElementById('offline-indicator');
        const showIndicator = !this.isOnline || !this.isServerOnline;
        const message = !this.isOnline ? 'Offline Mode' : 
                       !this.isServerOnline ? 'Server Offline (Using Cache)' : '';
        
        if (!indicator) {
            const div = document.createElement('div');
            div.id = 'offline-indicator';
            div.className = showIndicator ? 'show' : 'hidden';
            div.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                    <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
                    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                    <line x1="12" y1="20" x2="12.01" y2="20"></line>
                </svg>
                <span>${message}</span>
            `;
            document.body.appendChild(div);
        } else {
            indicator.className = showIndicator ? 'show' : 'hidden';
            const span = indicator.querySelector('span');
            if (span) span.textContent = message;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `network-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    async syncPendingActions() {
        const actions = await offlineStorage.getPendingActions();
        
        for (const action of actions) {
            try {
                await this.executeAction(action);
                await offlineStorage.deletePendingAction(action.id);
            } catch (error) {
                console.error('Failed to sync action:', action, error);
            }
        }
    }

    async executeAction(action) {
        const response = await fetch(action.url, {
            method: action.method || 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCookie('csrftoken')
            },
            body: JSON.stringify(action.data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
}

// Global network monitor instance
const networkMonitor = new NetworkMonitor();

// Listen for service worker messages
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_PENDING_ACTIONS') {
            console.log('[OfflineStorage] Received sync request from service worker');
            networkMonitor.syncPendingActions();
        }
    });
}
