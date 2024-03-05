from django.shortcuts import render

# Create your views here.

rooms =[
    {'id':1, 'name':'Chanm 16'},
    {'id':2, 'name':'Politik'},
    {'id':3, 'name':'HMI'},
]




def home(request):
    context = {
        'rooms': rooms
    }
    return render(request, 'base/home.html', context)


def chanm(request):
    return render(request, 'base/chanm.html', {'name': 'Chanm'})
