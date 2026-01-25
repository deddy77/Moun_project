// Pre-cache user data for offline access
class UserDataPreCacher {
    constructor() {
        this.isCaching = false;
        this.cachedItems = [];
    }

    async start() {
        if (this.isCaching) {
            console.log('[PreCache] Already caching...');
            return;
        }

        // Check if user is logged in
        const userElement = document.querySelector('[data-user-id]') || 
                           document.querySelector('.profile__name') ||
                           document.querySelector('.header__user');
        
        if (!userElement) {
            console.log('[PreCache] User not logged in, skipping pre-cache');
            return;
        }

        console.log('[PreCache] 🚀 Starting background pre-cache...');
        this.isCaching = true;

        // Wait 2 seconds after page load to not interfere with initial load
        setTimeout(() => {
            this.preCacheUserData();
        }, 2000);
    }

    async preCacheUserData() {
        try {
            // 1. Pre-cache user's profile
            await this.cacheUserProfile();
            
            // 2. Pre-cache all rooms (especially user's own rooms)
            await this.cacheRooms();
            
            // 3. Pre-cache inbox/conversations
            await this.cacheConversations();
            
            // 4. Pre-cache user's own rooms' content
            await this.cacheUserRoomMessages();
            
            // 5. Pre-cache followed users' profiles
            await this.cacheFollowedProfiles();

            console.log(`[PreCache] ✅ Completed! Cached ${this.cachedItems.length} items`);
            console.log('[PreCache] Items cached:', this.cachedItems);
            
            this.isCaching = false;
        } catch (error) {
            console.error('[PreCache] ❌ Error during pre-cache:', error);
            this.isCaching = false;
        }
    }

    async cacheUserProfile() {
        try {
            // Get current user ID from page
            const userId = this.getCurrentUserId();
            if (!userId) return;

            const profileUrl = `/profile/${userId}/`;
            await this.fetchAndCache(profileUrl, 'User Profile');
        } catch (error) {
            console.warn('[PreCache] Failed to cache user profile:', error.message);
        }
    }

    async cacheRooms() {
        try {
            // Cache home page which has all rooms
            await this.fetchAndCache('/', 'Home/Rooms');

            // Cache individual rooms
            const roomLinks = document.querySelectorAll('a[href*="/room/"]');
            for (let i = 0; i < Math.min(roomLinks.length, 10); i++) {
                const roomUrl = roomLinks[i].getAttribute('href');
                if (roomUrl && !roomUrl.includes('#')) {
                    await this.fetchAndCache(roomUrl, `Room ${i + 1}`);
                    await this.delay(100); // Small delay between requests
                }
            }
        } catch (error) {
            console.warn('[PreCache] Failed to cache rooms:', error.message);
        }
    }

    async cacheConversations() {
        try {
            // Cache inbox page
            await this.fetchAndCache('/inbox/', 'Inbox');

            // Try to get and cache individual conversations
            const response = await fetch('/inbox/');
            if (response.ok) {
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                const convLinks = doc.querySelectorAll('a[href*="/conversation/"]');
                for (let i = 0; i < Math.min(convLinks.length, 5); i++) {
                    const convUrl = convLinks[i].getAttribute('href');
                    if (convUrl) {
                        await this.fetchAndCache(convUrl, `Conversation ${i + 1}`);
                        await this.delay(100);
                    }
                }
            }
        } catch (error) {
            console.warn('[PreCache] Failed to cache conversations:', error.message);
        }
    }

    async cacheUserRoomMessages() {
        try {
            // Get rooms created by current user
            const userRoomLinks = document.querySelectorAll('.roomListRoom a[href*="/room/"]');
            
            for (let i = 0; i < Math.min(userRoomLinks.length, 5); i++) {
                const roomUrl = userRoomLinks[i].getAttribute('href');
                if (roomUrl) {
                    await this.fetchAndCache(roomUrl, `User Room ${i + 1}`);
                    await this.delay(150);
                }
            }
        } catch (error) {
            console.warn('[PreCache] Failed to cache user room messages:', error.message);
        }
    }

    async cacheFollowedProfiles() {
        try {
            // Get followed users from page
            const userLinks = document.querySelectorAll('a[href*="/profile/"]');
            const uniqueProfiles = new Set();
            
            userLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href && !href.includes('#')) {
                    uniqueProfiles.add(href);
                }
            });

            let count = 0;
            for (const profileUrl of uniqueProfiles) {
                if (count >= 10) break; // Limit to 10 profiles
                
                await this.fetchAndCache(profileUrl, `Profile ${count + 1}`);
                await this.delay(100);
                count++;
            }
        } catch (error) {
            console.warn('[PreCache] Failed to cache followed profiles:', error.message);
        }
    }

    async fetchAndCache(url, label = '') {
        try {
            // Check if already cached recently
            if (this.cachedItems.includes(url)) {
                return;
            }

            const response = await fetch(url);
            if (response.ok) {
                console.log(`[PreCache] ✓ Cached: ${label || url}`);
                this.cachedItems.push(url);
                
                // Service worker will handle the actual caching
                return true;
            }
        } catch (error) {
            console.warn(`[PreCache] Failed to cache ${label}:`, error.message);
            return false;
        }
    }

    getCurrentUserId() {
        // Try to get user ID from various sources
        const userIdElement = document.querySelector('[data-user-id]');
        if (userIdElement) {
            return userIdElement.getAttribute('data-user-id');
        }

        // Try from profile link in navbar
        const profileLink = document.querySelector('a[href*="/profile/"]');
        if (profileLink) {
            const match = profileLink.href.match(/\/profile\/(\d+)\//);
            if (match) return match[1];
        }

        // Try from URL if on profile page
        const urlMatch = window.location.pathname.match(/\/profile\/(\d+)\//);
        if (urlMatch) return urlMatch[1];

        return null;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStatus() {
        return {
            isCaching: this.isCaching,
            itemsCached: this.cachedItems.length,
            items: this.cachedItems
        };
    }
}

// Global instance
const userDataPreCacher = new UserDataPreCacher();

// Start pre-caching after page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        userDataPreCacher.start();
    });
} else {
    userDataPreCacher.start();
}

// Expose to window for debugging
window.userDataPreCacher = userDataPreCacher;

console.log('[PreCache] Pre-caching script loaded');
console.log('[PreCache] Check status: userDataPreCacher.getStatus()');
