// PWA Debug Helper - Add to console to check offline status
(function() {
    console.log('=== PWA Debug Helper Loaded ===');
    
    window.pwaDebug = {
        // Check if service worker is registered and active
        async checkServiceWorker() {
            try {
                if (!('serviceWorker' in navigator)) {
                    console.log('❌ Service Workers not supported');
                    return false;
                }
                
                // Wait for ready state with timeout
                const readyPromise = navigator.serviceWorker.ready;
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 2000)
                );
                
                try {
                    await Promise.race([readyPromise, timeoutPromise]);
                } catch (e) {
                    // Timeout or error, continue anyway
                }
                
                const registration = await navigator.serviceWorker.getRegistration();
                if (!registration) {
                    console.log('❌ No Service Worker registered');
                    console.log('💡 Tip: Refresh the page to register service worker');
                    return false;
                }
                
                console.log('✅ Service Worker registered');
                console.log('   Scope:', registration.scope);
                console.log('   Active:', !!registration.active);
                console.log('   Waiting:', !!registration.waiting);
                console.log('   Installing:', !!registration.installing);
                
                if (registration.active) {
                    console.log('   State:', registration.active.state);
                    console.log('   Script URL:', registration.active.scriptURL);
                } else if (registration.installing) {
                    console.log('   Status: Installing...');
                } else if (registration.waiting) {
                    console.log('   Status: Waiting to activate');
                }
                
                return true;
            } catch (error) {
                console.error('❌ Error checking service worker:', error.message);
                return false;
            }
        },
        
        // Check what's in cache
        async checkCache() {
            try {
                const cacheNames = await caches.keys();
                console.log('📦 Caches found:', cacheNames.length);
                
                for (const cacheName of cacheNames) {
                    const cache = await caches.open(cacheName);
                    const keys = await cache.keys();
                    console.log(`\n   ${cacheName}: ${keys.length} items`);
                    keys.slice(0, 5).forEach(req => {
                        console.log('   - ' + new URL(req.url).pathname);
                    });
                    if (keys.length > 5) {
                        console.log(`   ... and ${keys.length - 5} more`);
                    }
                }
            } catch (error) {
                console.error('❌ Error checking cache:', error.message);
            }
        },
        
        // Check IndexedDB data
        async checkIndexedDB() {
            try {
                if (!window.offlineStorage) {
                    console.log('❌ OfflineStorage not initialized');
                    return;
                }
                
                await window.offlineStorage.init();
                const stores = ['users', 'rooms', 'conversations', 'messages', 'direct_messages'];
                
                console.log('💾 IndexedDB data:');
                for (const storeName of stores) {
                    try {
                        const data = await window.offlineStorage.getData(storeName);
                        console.log(`   ${storeName}: ${data?.length || 0} items`);
                    } catch (e) {
                        console.log(`   ${storeName}: error - ${e.message}`);
                    }
                }
            } catch (error) {
                console.error('❌ Error checking IndexedDB:', error.message);
            }
        },
        
        // Clear everything and start fresh
        async clearAll() {
            console.log('🗑️ Clearing all caches and storage...');
            
            // Unregister service worker
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                console.log('   ✓ Service Worker unregistered');
            }
            
            // Clear caches
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
                console.log('   ✓ Cache deleted:', cacheName);
            }
            
            // Clear IndexedDB
            try {
                indexedDB.deleteDatabase('TogetherDB');
                console.log('   ✓ IndexedDB deleted');
            } catch (e) {
                console.log('   ⚠️ IndexedDB deletion failed');
            }
            
            console.log('✅ All cleared! Reload the page to start fresh.');
        },
        
        // Force service worker update
        async forceUpdate() {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                console.log('🔄 Forcing service worker update...');
                await registration.update();
                console.log('✅ Update triggered');
            }
        },
        
        // Test offline mode
        testOffline() {
            console.log('📡 Network status:', navigator.onLine ? 'Online' : 'Offline');
            console.log('💡 To test offline:');
            console.log('   1. Open DevTools → Network tab');
            console.log('   2. Check "Offline" checkbox');
            console.log('   3. Refresh the page');
            console.log('   4. You should see cached content');
        },
        
        // Full diagnostic
        async diagnose() {
            try {
                console.log('\n=== PWA DIAGNOSTICS ===\n');
                await this.checkServiceWorker();
                console.log('');
                await this.checkCache();
                console.log('');
                await this.checkIndexedDB();
                console.log('');
                this.checkPreCache();
                console.log('');
                this.testOffline();
                console.log('\n=== END DIAGNOSTICS ===\n');
            } catch (error) {
                console.error('❌ Diagnostic error:', error);
                console.log('\n=== END DIAGNOSTICS (with errors) ===\n');
            }
        },
        
        // Check pre-cache status
        checkPreCache() {
            if (window.userDataPreCacher) {
                const status = window.userDataPreCacher.getStatus();
                console.log('📦 Pre-Cache Status:');
                console.log('   Status:', status.isCaching ? '⏳ Caching...' : '✅ Idle');
                console.log('   Items cached:', status.itemsCached);
                if (status.itemsCached > 0) {
                    console.log('   URLs:', status.items.slice(0, 5).join(', ') + (status.items.length > 5 ? '...' : ''));
                }
            } else {
                console.log('📦 Pre-Cache: Not loaded');
            }
        }
    };
    
    console.log('Available commands:');
    console.log('  pwaDebug.diagnose()        - Full diagnostic check');
    console.log('  pwaDebug.checkServiceWorker() - Check SW status');
    console.log('  pwaDebug.checkCache()      - List cached items');
    console.log('  pwaDebug.checkIndexedDB()  - Check stored data');
    console.log('  pwaDebug.checkPreCache()   - Check pre-cache status');
    console.log('  pwaDebug.clearAll()        - Clear everything');
    console.log('  pwaDebug.forceUpdate()     - Update service worker');
    console.log('  pwaDebug.testOffline()     - Offline testing tips');
    console.log('\n💡 Quick start: await pwaDebug.diagnose()');
})();
