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


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'
        
        logger.info(f"[ChatWebSocket] Connection attempt - User: {self.user}, Conversation: {self.conversation_id}")
        
        if self.user.is_authenticated:
            # Check if user is participant
            is_participant = await self.check_participant()
            if is_participant:
                # Join conversation group
                await self.channel_layer.group_add(
                    self.room_group_name,
                    self.channel_name
                )
                
                await self.accept()
                logger.info(f"[ChatWebSocket] ✅ Connected - User: {self.user.username}, Room: {self.room_group_name}")
            else:
                logger.warning(f"[ChatWebSocket] ❌ Rejected - User not participant")
                await self.close()
        else:
            logger.warning(f"[ChatWebSocket] ❌ Rejected - User not authenticated")
            await self.close()

    async def disconnect(self, close_code):
        logger.info(f"[ChatWebSocket] Disconnected - User: {self.user}, Code: {close_code}")
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    # Receive message from WebSocket
    async def receive(self, text_data):
        pass

    # Handler for chat_message event from group
    async def chat_message(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'new_message',
            'message': event['message']
        }))
        logger.info(f"[ChatWebSocket] Sent message to {self.user.username}")

    @database_sync_to_async
    def check_participant(self):
        from base.models import Conversation
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            return self.user in conversation.participants.all()
        except Conversation.DoesNotExist:
            return False
