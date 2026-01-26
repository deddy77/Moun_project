from django.urls import path
from . import views

urlpatterns = [

    # Desktop landing page for non-mobile users
    path('desktop-landing/', views.desktopLanding, name='desktop-landing'),

    path('login/', views.loginPage, name="login"),
    path('logout/', views.lougoutUser, name="logout"),
    path('register/', views.registerPage, name="register"),


    path('', views.home, name='home'),
    path('room/<str:pk>/', views.room, name='room'),
    path('profile/<str:pk>/', views.userProfile, name='user-profile'),


    path('create-room/', views.createRoom, name='create-room'),
    path('update-room/<str:pk>/', views.updateRoom, name='update-room'),
    path('delete-room/<str:pk>/', views.deleteRoom, name='delete-room'),
    path('delete-message/<str:pk>/', views.deleteMessage, name='delete-message'),

    
    path('update-user/', views.updateUser, name='update-user'),

    
    path('topics/', views.topicsPage, name='topics'),

    path('check_user_status/', views.check_user_status),

    path('follow/<int:pk>/', views.follow_user, name='follow-user'),
    path('get_follow_data/<int:pk>/', views.get_follow_data, name='get_follow_data'),    

    path('activity/', views.activityPage, name='activity'),

    # Direct Messaging URLs
    path('inbox/', views.inbox, name='inbox'),
    path('conversation/<str:pk>/', views.conversation_detail, name='conversation'),
    path('start-conversation/<str:user_pk>/', views.start_conversation, name='start-conversation'),
    
    # API endpoint for polling unread messages
    path('api/unread-count/', views.api_unread_count, name='api-unread-count'),

    # Offline page
    path('offline/', views.offline_page, name='offline'),
    
    # Service Worker (must be at root for full site control)
    path('service-worker.js', views.service_worker, name='service-worker'),


    
]