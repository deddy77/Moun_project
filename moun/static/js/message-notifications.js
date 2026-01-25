// WebSocket for real-time message notifications with polling fallback
class MessageNotifications {
    constructor() {
        this.socket = null;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 30000;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.pollingInterval = null;
        this.usingPolling = false;
        
        this.connect();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/notifications/`;
        
        console.log('[MessageNotifications] Connecting to:', wsUrl);
        console.log('[MessageNotifications] Protocol:', protocol);
        console.log('[MessageNotifications] Host:', window.location.host);
        
        try {
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('[MessageNotifications] ✅ WebSocket connected successfully!');
                this.reconnectDelay = 1000;
                this.reconnectAttempts = 0;
                this.usingPolling = false;
                
                // Stop polling if it was active
                if (this.pollingInterval) {
                    clearInterval(this.pollingInterval);
                    this.pollingInterval = null;
                }
            };
            
            this.socket.onmessage = (event) => {
                console.log('[MessageNotifications] Message received:', event.data);
                const data = JSON.parse(event.data);
                
                if (data.type === 'unread_count') {
                    this.updateMessageIcon(data.count);
                }
            };
            
            this.socket.onclose = (event) => {
                console.error('[MessageNotifications] ❌ WebSocket closed!');
                console.error('  Code:', event.code);
                console.error('  Reason:', event.reason || 'No reason provided');
                console.error('  Clean close:', event.wasClean);
                
                if (event.code === 1006) {
                    console.error('  ⚠️ Connection failed - possible ngrok/CORS issue');
                }
                
                this.reconnectAttempts++;
                
                // After 3 failed attempts, switch to polling
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.log('[MessageNotifications] 🔄 Switching to HTTP polling (WebSocket unavailable)');
                    this.startPolling();
                } else {
                    this.reconnect();
                }
            };
            
            this.socket.onerror = (error) => {
                console.error('[MessageNotifications] ❌ WebSocket error:', error);
                console.error('  This usually means connection refused or CORS issue');
            };
        } catch (error) {
            console.error('[MessageNotifications] ❌ Connection error:', error);
            this.reconnectAttempts++;
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.startPolling();
            } else {
                this.reconnect();
            }
        }
    }

    startPolling() {
        if (this.pollingInterval) return; // Already polling
        
        this.usingPolling = true;
        console.log('[MessageNotifications] 📡 Using HTTP polling (checking every 5 seconds)');
        
        // Initial check
        this.checkUnreadCount();
        
        // Poll every 5 seconds
        this.pollingInterval = setInterval(() => {
            this.checkUnreadCount();
        }, 5000);
    }

    async checkUnreadCount() {
        try {
            const response = await fetch('/api/unread-count/', {
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updateMessageIcon(data.count);
            }
        } catch (error) {
            console.error('[MessageNotifications] Polling error:', error);
        }
    }

    reconnect() {
        setTimeout(() => {
            console.log('[MessageNotifications] Attempting to reconnect...');
            this.connect();
            
            // Exponential backoff
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        }, this.reconnectDelay);
    }

    updateMessageIcon(count) {
        const messageLink = document.querySelector('a[href*="inbox"]');
        if (!messageLink) return;

        const hasUnread = count > 0;
        
        // Create new SVG based on count
        const newSvg = hasUnread ? this.getFilledSvg(count) : this.getOutlineSvg();
        
        // Replace the SVG
        const oldSvg = messageLink.querySelector('svg');
        if (oldSvg) {
            oldSvg.outerHTML = newSvg;
        }

        console.log(`[MessageNotifications] Updated icon - ${count} unread messages`);
    }

    getFilledSvg(count) {
        return `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 32 32" class="message-icon has-unread">
            <title>Messages (${count} unread)</title>
            <path d="M16 0c-8.837 0-16 7.163-16 16s7.163 16 16 16 16-7.163 16-16-7.163-16-16-16zM8 8h16c0.286 0 0.563 0.061 0.817 0.177l-8.817 8.817-8.817-8.817c0.254-0.116 0.531-0.177 0.817-0.177zM26 22c0 1.105-0.895 2-2 2h-16c-1.105 0-2-0.895-2-2v-12c0-0.042 0.002-0.084 0.004-0.125l9.996 9.996 9.996-9.996c0.003 0.041 0.004 0.083 0.004 0.125v12z"></path>
        </svg>`;
    }

    getOutlineSvg() {
        return `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 32 32" class="message-icon">
            <title>Messages</title>
            <path d="M16 0c-8.837 0-16 7.163-16 16s7.163 16 16 16 16-7.163 16-16-7.163-16-16-16zM8 8h16c0.286 0 0.563 0.061 0.817 0.177l-8.817 8.817-8.817-8.817c0.254-0.116 0.531-0.177 0.817-0.177zM6 22v-12c0-0.042 0.002-0.084 0.004-0.125l5.864 5.864-5.815 5.815c-0.034-0.179-0.054-0.362-0.054-0.554zM24 24h-16c-0.192 0-0.375-0.019-0.554-0.054l5.815-5.815 2.739 2.739 2.739-2.739 5.815 5.815c-0.179 0.034-0.362 0.054-0.554 0.054zM26 22c0 0.192-0.019 0.375-0.054 0.554l-5.815-5.815 5.865-5.865c0.003 0.042 0.004 0.084 0.004 0.125v12z"></path>
        </svg>`;
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.querySelector('a[href*="inbox"]')) {
            window.messageNotifications = new MessageNotifications();
        }
    });
} else {
    if (document.querySelector('a[href*="inbox"]')) {
        window.messageNotifications = new MessageNotifications();
    }
}

console.log('[MessageNotifications] Script loaded');
