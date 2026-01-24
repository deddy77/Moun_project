from django.contrib import admin

# Register your models here.


from .models import Room, Topic, Message, User, Conversation, DirectMessage


admin.site.register(User)
admin.site.register(Room)
admin.site.register(Topic)
admin.site.register(Message)
admin.site.register(Conversation)
admin.site.register(DirectMessage)