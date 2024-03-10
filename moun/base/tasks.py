# tasks.py
import requests
import json
from .models import User
from celery import shared_task
from django.http import HttpRequest
from .views import check_user_status
from celery import shared_task

# @shared_task
# def check_user_status_task():
#     request = HttpRequest()
#     request.user = User.objects.first()  # replace with your logic to get the user
#     response = check_user_status(request)
#     data = response.getvalue()
#     with open('user_status.json', 'w') as f:
#         json.dump(data, f)

@shared_task
def check_user_status_task():
    response = requests.get('http://localhost:8000/check_user_status/')
    data = response.json()
    with open('user_status.json', 'w') as f:
        json.dump(data, f)