from django.contrib import admin

# Register your models here.

from .models import User

admin.site.register(User) # Register the custom user model with the admin   