// Enhanced fetch wrapper with offline support
class OfflineFetch {
    constructor() {
        this.storage = window.offlineStorage;
        this.networkMonitor = window.networkMonitor;
    }

    async fetchWithCache(url, options = {}, storeName = null) {
        const isOnline = navigator.onLine;

        // Try network first if online
        if (isOnline) {
            try {
                const response = await fetch(url, options);
                const data = await response.json();

                // Save to IndexedDB if storeName provided
                if (storeName && data && this.storage) {
                    await this.storage.saveData(storeName, data);
                }

                return { data, fromCache: false };
            } catch (error) {
                console.warn('Network request failed, falling back to cache:', error);
            }
        }

        // Fallback to cached data
        if (storeName && this.storage) {
            try {
                const cachedData = await this.storage.getData(storeName);
                if (cachedData) {
                    return { data: cachedData, fromCache: true };
                }
            } catch (error) {
                console.error('Failed to retrieve cached data:', error);
            }
        }

        throw new Error('No network connection and no cached data available');
    }

    async queueAction(url, data, method = 'POST') {
        if (!this.storage) return;

        await this.storage.savePendingAction({
            url,
            method,
            data,
            timestamp: Date.now()
        });
    }
}

// Global instance
window.offlineFetch = new OfflineFetch();

// Enhance existing fetch calls for rooms/messages
document.addEventListener('DOMContentLoaded', async () => {
    const storage = window.offlineStorage;
    const offlineFetch = window.offlineFetch;

    if (!storage) return;

    // Cache room data on home page
    if (window.location.pathname === '/' || window.location.pathname.includes('/home')) {
        cacheHomePageData();
    }

    // Cache conversation data
    if (window.location.pathname.includes('/inbox')) {
        cacheConversationData();
    }

    // Cache user profile data
    if (window.location.pathname.includes('/profile')) {
        cacheProfileData();
    }
});

async function cacheHomePageData() {
    const storage = window.offlineStorage;
    
    try {
        // Cache room elements
        const rooms = [];
        document.querySelectorAll('.roomListRoom').forEach(roomEl => {
            const roomLink = roomEl.querySelector('a[href*="/room/"]');
            if (roomLink) {
                const roomId = roomLink.href.split('/room/')[1]?.replace('/', '');
                const name = roomEl.querySelector('.roomListRoom__header h5')?.textContent;
                const topic = roomEl.querySelector('.roomListRoom__header span')?.textContent?.replace('@', '');
                
                if (roomId && name) {
                    rooms.push({
                        id: parseInt(roomId),
                        name,
                        topic,
                        cached_at: Date.now()
                    });
                }
            }
        });

        if (rooms.length > 0) {
            await storage.saveData('rooms', rooms);
            console.log('[OfflineStorage] Cached', rooms.length, 'rooms');
        }

        // Cache user data
        const users = [];
        document.querySelectorAll('[data-user-id]').forEach(userEl => {
            const userId = userEl.getAttribute('data-user-id');
            const username = userEl.textContent?.trim();
            
            if (userId && username && !users.find(u => u.id === parseInt(userId))) {
                users.push({
                    id: parseInt(userId),
                    username,
                    cached_at: Date.now()
                });
            }
        });

        if (users.length > 0) {
            await storage.saveData('users', users);
            console.log('[OfflineStorage] Cached', users.length, 'users');
        }
    } catch (error) {
        console.error('[OfflineStorage] Failed to cache home page data:', error);
    }
}

async function cacheConversationData() {
    const storage = window.offlineStorage;
    
    try {
        // Cache conversations
        const conversations = [];
        document.querySelectorAll('.conversation-item').forEach(convEl => {
            const convLink = convEl.querySelector('a[href*="/conversation/"]');
            if (convLink) {
                const convId = convLink.href.split('/conversation/')[1]?.replace('/', '');
                const username = convEl.querySelector('.conversation-username')?.textContent;
                const lastMessage = convEl.querySelector('.conversation-last-message')?.textContent;
                
                if (convId) {
                    conversations.push({
                        id: parseInt(convId),
                        username,
                        last_message: lastMessage,
                        cached_at: Date.now()
                    });
                }
            }
        });

        if (conversations.length > 0) {
            await storage.saveData('conversations', conversations);
            console.log('[OfflineStorage] Cached', conversations.length, 'conversations');
        }

        // Cache messages on conversation page
        if (window.location.pathname.includes('/conversation/')) {
            const messages = [];
            document.querySelectorAll('.message').forEach(msgEl => {
                const body = msgEl.querySelector('.message__body')?.textContent;
                const author = msgEl.querySelector('.message__author')?.textContent;
                const created = msgEl.querySelector('.message__created')?.textContent;
                
                if (body) {
                    messages.push({
                        id: Date.now() + Math.random(),
                        body,
                        author,
                        created,
                        cached_at: Date.now()
                    });
                }
            });

            if (messages.length > 0) {
                const convId = window.location.pathname.split('/conversation/')[1]?.replace('/', '');
                await storage.saveData('direct_messages', messages);
                console.log('[OfflineStorage] Cached', messages.length, 'messages');
            }
        }
    } catch (error) {
        console.error('[OfflineStorage] Failed to cache conversation data:', error);
    }
}

async function cacheProfileData() {
    const storage = window.offlineStorage;
    
    try {
        // Cache profile information
        const profileEl = document.querySelector('.profile');
        if (profileEl) {
            const userId = window.location.pathname.split('/profile/')[1]?.replace('/', '');
            const username = document.querySelector('.profile__name')?.textContent;
            const bio = document.querySelector('.profile__bio')?.textContent;
            
            if (userId && username) {
                await storage.saveData('users', {
                    id: parseInt(userId),
                    username,
                    bio,
                    cached_at: Date.now()
                });
                console.log('[OfflineStorage] Cached profile for user', username);
            }
        }

        // Cache follow data
        const followersCount = document.querySelector('[data-followers-count]')?.textContent;
        const followingCount = document.querySelector('[data-following-count]')?.textContent;
        
        if (followersCount || followingCount) {
            const userId = window.location.pathname.split('/profile/')[1]?.replace('/', '');
            await storage.saveData('follow_data', {
                id: parseInt(userId),
                followers_count: followersCount,
                following_count: followingCount,
                cached_at: Date.now()
            });
        }
    } catch (error) {
        console.error('[OfflineStorage] Failed to cache profile data:', error);
    }
}

// Intercept form submissions for offline queueing
document.addEventListener('submit', async (e) => {
    const form = e.target;
    const offlineFetch = window.offlineFetch;
    
    // Only queue if offline
    if (!navigator.onLine && offlineFetch) {
        e.preventDefault();
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        await offlineFetch.queueAction(form.action, data, form.method.toUpperCase());
        
        if (window.networkMonitor) {
            window.networkMonitor.showNotification(
                'Action saved! Will sync when you\'re back online.',
                'warning'
            );
        }
    }
});

console.log('[OfflineIntegration] Offline integration loaded');
