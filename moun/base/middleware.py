# middleware.py
from django.utils import timezone
from django.shortcuts import redirect
from django.urls import reverse
import re

class ActiveUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            # Update the last activity time of the user
            request.user.last_activity = timezone.now()
            request.user.save(update_fields=['last_activity'])
        response = self.get_response(request)
        return response


class MobileOnlyMiddleware:
    """
    Middleware to redirect desktop users to a landing page promoting the mobile app.
    Mobile users can access the app normally.
    """
    
    # Paths that should be accessible regardless of device
    EXCLUDED_PATHS = [
        '/desktop-landing/',
        '/static/',
        '/admin/',
        '/login/',
        '/logout/',
        '/register/',
        '/api/',  # Allow API calls
        '/ws/',   # Allow WebSocket connections
        '/service-worker.js',
        '/offline/',
    ]
    
    def __init__(self, get_response):
        self.get_response = get_response
        # Common mobile user agent patterns
        self.mobile_agent_re = re.compile(
            r'(android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile)',
            re.IGNORECASE
        )
    
    def __call__(self, request):
        # Get the current path
        path = request.path
        
        # Check if path should be excluded from redirection
        if any(path.startswith(excluded) for excluded in self.EXCLUDED_PATHS):
            response = self.get_response(request)
            return response
        
        # Allow POST requests to go through (don't redirect during form submission)
        # This prevents CSRF issues when submitting forms
        if request.method == 'POST':
            response = self.get_response(request)
            return response
        
        # Get user agent
        user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
        
        # Check if it's a mobile device
        is_mobile = bool(self.mobile_agent_re.search(user_agent))
        
        # If not mobile and not already on landing page, redirect to landing page
        if not is_mobile and path != reverse('desktop-landing'):
            return redirect('desktop-landing')
        
        # If mobile and on landing page, redirect to home
        if is_mobile and path == reverse('desktop-landing'):
            return redirect('home')
        
        response = self.get_response(request)
        return response