from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('chanm/', views.chanm, name='chanm'),
]