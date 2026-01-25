import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        
        logger.info(f"[WebSocket] Connection attempt - User: {self.user}, Authenticated: {self.user.is_authenticated}")
        
        if self.user.is_authenticated:
            # Create a unique group name for this user
            self.user_group_name = f'user_{self.user.id}'
            
            # Join user group
            await self.channel_layer.group_add(
                self.user_group_name,
                self.channel_name
            )
            
            await self.accept()
            logger.info(f"[WebSocket] ✅ Connected - User: {self.user.username} (ID: {self.user.id})")
            
            # Send initial unread count
            unread_count = await self.get_unread_count()
            await self.send(text_data=json.dumps({
                'type': 'unread_count',
                'count': unread_count
            }))
            logger.info(f"[WebSocket] Sent initial count: {unread_count}")
        else:
            logger.warning(f"[WebSocket] ❌ Rejected - User not authenticated")
            await self.close()

    async def disconnect(self, close_code):
        logger.info(f"[WebSocket] Disconnected - User: {self.user}, Code: {close_code}")
        if self.user.is_authenticated:
            # Leave user group
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )

    # Receive message from WebSocket (not needed for now, but good to have)
    async def receive(self, text_data):
        pass

    # Handler for new_message event from group
    async def new_message(self, event):
        # Send unread count to WebSocket
        unread_count = await self.get_unread_count()
        await self.send(text_data=json.dumps({
            'type': 'unread_count',
            'count': unread_count
        }))

    @database_sync_to_async
    def get_unread_count(self):
        from base.models import DirectMessage
        return DirectMessage.objects.filter(
            conversation__participants=self.user,
            is_read=False
        ).exclude(sender=self.user).count()
