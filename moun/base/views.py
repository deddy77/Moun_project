from django.shortcuts import render
from django.http import HttpResponse

# Create your views here.
def home(request):
    return HttpResponse('Hello Moun')


def chanm(request):
    return HttpResponse('Chanm 16')
