from .models import DirectMessage

def unread_messages_count(request):
    """Add unread messages count to context for all templates"""
    if request.user.is_authenticated:
        unread_count = DirectMessage.objects.filter(
            conversation__participants=request.user,
            is_read=False
        ).exclude(sender=request.user).count()
        return {'unread_messages_count': unread_count}
    return {'unread_messages_count': 0}
