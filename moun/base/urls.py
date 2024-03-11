from django.urls import path
from . import views

urlpatterns = [


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



    
]