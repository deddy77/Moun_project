from django.contrib import admin
from django.urls import path
from django.http import HttpResponse


def home(request):
    return HttpResponse('Hello Moun')


def chanm(request):
    return HttpResponse('Chanm 16')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', home),
    path('chanm/', chanm),
]

