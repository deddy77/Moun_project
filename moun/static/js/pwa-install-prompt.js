// PWA Install Prompt Handler
class PWAInstallPrompt {
    constructor() {
        this.deferredPrompt = null;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        this.isAndroid = /Android/.test(navigator.userAgent);
        this.isMobile = this.isIOS || this.isAndroid || window.innerWidth <= 768;
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           window.navigator.standalone || 
                           document.referrer.includes('android-app://');
        
        this.init();
    }

    init() {
        if (this.isStandalone) {
            console.log('App is running in standalone mode - no install prompt needed');
            return;
        }

        console.log('PWA Install Check:', {
            isIOS: this.isIOS,
            isAndroid: this.isAndroid,
            isMobile: this.isMobile,
            isStandalone: this.isStandalone
        });

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            console.log('beforeinstallprompt event captured');
            
            // Show prompt immediately when native prompt is available (Android)
            if (this.isAndroid && this.isMobile) {
                setTimeout(() => {
                    console.log('Showing install prompt with native support...');
                    this.showInstallPrompt();
                }, 2000);
            }
        });

        window.addEventListener('load', () => {
            setTimeout(() => {
                if (this.isMobile) {
                    // For iOS, show immediately
                    // For Android, wait a bit for beforeinstallprompt, then show fallback
                    if (this.isIOS) {
                        console.log('Showing iOS install prompt...');
                        this.showInstallPrompt();
                    } else if (this.isAndroid && !this.deferredPrompt) {
                        // Fallback for Android if native prompt not available
                        setTimeout(() => {
                            if (!this.deferredPrompt) {
                                console.log('Showing Android fallback install prompt...');
                                this.showInstallPrompt();
                            }
                        }, 3000);
                    }
                } else {
                    console.log('Not mobile device - skipping install prompt');
                }
            }, 2000);
        });

        window.addEventListener('appinstalled', () => {
            console.log('PWA installed successfully');
            this.hideInstallPrompt();
            localStorage.setItem('pwa-installed', 'true');
        });
    }

    showInstallPrompt() {
        const overlay = this.createOverlay();
        const banner = this.createBanner();
        
        document.body.appendChild(overlay);
        document.body.appendChild(banner);
        
        setTimeout(() => {
            overlay.classList.add('show');
            banner.classList.add('show');
        }, 100);
        
        document.body.style.overflow = 'hidden';
    }

    createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'pwa-install-overlay';
        overlay.id = 'pwa-install-overlay';
        return overlay;
    }

    createBanner() {
        const banner = document.createElement('div');
        banner.className = 'pwa-install-banner mandatory';
        banner.id = 'pwa-install-banner';

        const content = this.isIOS ? this.getIOSContent() : this.getAndroidContent();
        
        banner.innerHTML = '<div class="pwa-banner-content"><div class="pwa-banner-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg></div><div class="pwa-banner-text"><h3>Install Together App</h3>' + content + '</div>' + (!this.isIOS ? '<button class="pwa-banner-install" onclick="pwaInstallPromptInstance.installApp()">Install Now</button>' : '') + '</div>';

        return banner;
    }

    getIOSContent() {
        return '<p><strong>To continue, please install the app:</strong></p><ol><li>Tap the Share button <strong>Share Icon</strong></li><li>Scroll and tap <strong>"Add to Home Screen"</strong></li><li>Tap <strong>"Add"</strong> to finish</li></ol><p style="margin-top: 1rem; opacity: 0.9; font-size: 0.9rem;">Then open the app from your home screen</p>';
    }

    getAndroidContent() {
        if (this.deferredPrompt) {
            return '<p><strong>Install Together to continue</strong></p><p style="opacity: 0.9; margin-top: 0.5rem;">Get the full app experience on your home screen</p>';
        }
        return '<p><strong>To continue, please install the app:</strong></p><ol><li>Tap the menu button <strong>⋮</strong> at the top right</li><li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></li></ol><p style="margin-top: 1rem; opacity: 0.9; font-size: 0.9rem;">Then open the app from your home screen</p>';
    }

    async installApp() {
        if (!this.deferredPrompt) {
            return;
        }

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }

        this.deferredPrompt = null;
        this.hideInstallPrompt();
    }

    dismissPrompt() {
    }

    hideInstallPrompt() {
        const overlay = document.getElementById('pwa-install-overlay');
        const banner = document.getElementById('pwa-install-banner');
        
        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
        }
        
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => banner.remove(), 300);
        }
        
        document.body.style.overflow = '';
    }

    static resetDismissal() {
        localStorage.removeItem('pwa-install-dismissed');
        location.reload();
    }
}

let pwaInstallPromptInstance;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        pwaInstallPromptInstance = new PWAInstallPrompt();
    });
} else {
    pwaInstallPromptInstance = new PWAInstallPrompt();
}
