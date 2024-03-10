# celery.py
from __future__ import absolute_import, unicode_literals
import os
from celery import Celery

# Import the tasks
#from base.tasks import check_user_status_task

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'moun.settings')

app = Celery('moun')

app.config_from_object('django.conf:settings', namespace='CELERY')

# Manually register the task
@app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    from base.tasks import check_user_status_task

    sender.register_task(check_user_status_task)


app.autodiscover_tasks()