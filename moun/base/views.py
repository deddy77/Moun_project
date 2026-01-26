from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.utils import timezone
from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.conf import settings
from .models import Room, Topic, Message, User, Follow, Conversation, DirectMessage
from .forms import RoomForm, UserForm, MyUserCreationForm
from django.views.decorators.http import require_http_methods
# Create your views here.

# rooms =[
#     {'id':1, 'name':'Chanm 16'},
#     {'id':2, 'name':'Politik'},
#     {'id':3, 'name':'HMI'},
# ]





def loginPage(request):
    page ='login'

    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        username = request.POST.get('username').lower()
        password = request.POST.get('password')

        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return redirect('home')
        else:
            messages.error(request, 'Username OR password is incorrect')

        
    context = {'page': page}
    return render(request, 'base/login_register.html', context)


def check_user_status(request):
    users_status = []
    
    # Get mutual followers (users who follow each other)
    if request.user.is_authenticated:
        # Get IDs of users who follow the current user
        follower_ids = set(Follow.objects.filter(followed=request.user).values_list('follower_id', flat=True))
        # Get IDs of users whom the current user follows
        following_ids = set(Follow.objects.filter(follower=request.user).values_list('followed_id', flat=True))
        # Find mutual followers (intersection)
        mutual_follow_ids = follower_ids.intersection(following_ids)
        # Only check status for mutual followers
        users_to_check = User.objects.filter(id__in=mutual_follow_ids)
    else:
        # If not authenticated, return empty list
        users_to_check = User.objects.none()
    
    for user in users_to_check:
        last_activity = user.last_activity.timestamp() if user.last_activity else None
        if last_activity:
            is_online = timezone.now().timestamp() - last_activity < 80
        else:
            is_online = False
        user_status = {'user_id': user.id, 'is_online': is_online}
        users_status.append(user_status)
    return JsonResponse(users_status, safe=False)

def lougoutUser(request):
    # Clear last_activity to show user as offline immediately
    if request.user.is_authenticated:
        request.user.last_activity = None
        request.user.save()
    logout(request)
    return redirect('login')

def registerPage(request):
    page ='register'
    form = MyUserCreationForm()

    if request.method == 'POST':
        form = MyUserCreationForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.username = user.username.lower()
            user.save() 
            login(request, user)
            return redirect('home')
        else:
            messages.error(request, 'An error occured during registration')
    return render(request, 'base/login_register.html',{'form': form})   
    context = {'page': page}
    return render(request, 'base/login_register.html', context)

def home(request):
    q = request.GET.get('q') if request.GET.get('q') != None else ''
    rooms = Room.objects.filter(
        Q(topic__name__icontains=q) |
        Q(name__icontains=q) |
        Q(description__icontains=q)
        )
    topics = Topic.objects.all()[0:5]
    room_count = rooms.count()
    room_messages = Message.objects.filter(Q(room__topic__name__icontains=q))
    context = {
        'rooms': rooms,
        'topics': topics,
        'room_count': room_count,
        'room_messages': room_messages,
    }
    return render(request, 'base/home.html', context)

@login_required(login_url='login')
def room(request, pk):
    room = Room.objects.get(id=pk)
    room_messages = room.message_set.all()
    participants = room.participants.all()

    if request.method == 'POST': 
        message = Message.objects.create(
            user = request.user,
            room = room,
            body = request.POST.get('body')
        )
        room.participants.add(request.user)
        return redirect('room', pk = room.id)


    context =  {
        'room': room,
        'room_messages': room_messages,
        'participants': participants,
        }
    return render(request, 'base/room.html', context)

def userProfile(request, pk):
    if not request.user.is_authenticated:
        return redirect('login')
    
    user = User.objects.get(id=pk)
    rooms = user.room_set.all()
    room_messages = user.message_set.all()
    topics = Topic.objects.all()
    is_following = request.user.is_following(user)
    context ={
        'user': user,
        'rooms': rooms,
        'room_messages': room_messages,
        'topics': topics,
        'is_following': is_following,
    }
    return render(request, 'base/profile.html', context)


@login_required(login_url='login')
def createRoom(request):
    form = RoomForm()
    topics = Topic.objects.all()
    if request.method == 'POST':
        topic_name =request.POST.get('topic')
        topic, created = Topic.objects.get_or_create(name=topic_name)
        #form = RoomForm(request.POST)

        Room.objects.create(
            host = request.user,
            topic = topic,
            #created = created,
            name = request.POST.get('name'),
            description = request.POST.get('description'),

        )
        return redirect('home')

    context = {'form': form, 'topics': topics,}
    return render(request, 'base/room_form.html', context)

@login_required(login_url='login')
def updateRoom(request, pk):
    room = Room.objects.get(id=pk)
    form = RoomForm(instance=room)
    topics = Topic.objects.all()

    if request.user != room.host:
        return HttpResponse('You are not allowed here!')

    if request.method == 'POST':
        topic_name = request.POST.get('topic')
        topic, created = Topic.objects.get_or_create(name=topic_name)
        form = RoomForm(request.POST, instance=room)
        room.name = request.POST.get('name')
        room.topic = topic
        room.description = request.POST.get('description')
        room.save()
        return redirect('home')

    context = {'form': form,
               'topics': topics,
               'room': room,
               }
    return render(request, 'base/room_form.html', context)

@login_required(login_url='login')
def deleteRoom(request, pk):
    room = Room.objects.get(id=pk)
    
    if request.user != room.host:
        return HttpResponse('You are not allowed here!')

    if request.method == 'POST':
        room.delete()
        return redirect('home')

    return render(request, 'base/delete.html', {'obj': room})

@login_required(login_url='login')
def deleteMessage(request, pk):
    message = Message.objects.get(id=pk)
    
    if request.user != message.user:
        return HttpResponse('You are not allowed here!')

    if request.method == 'POST':
        message.delete()
        # need to redirect user to room not to home
        return redirect('home')

    return render(request, 'base/delete.html', {'obj': message})

@login_required(login_url='login')
def updateUser(request):
    user = request.user
    form = UserForm(instance = user)
    if request.method == 'POST':
        form = UserForm(request.POST, request.FILES, instance = user)
        if form.is_valid():
            form.save()
            return redirect('user-profile', pk=user.id)
    return render(request, 'base/update-user.html', {'form': form})
      

def topicsPage(request):
    q = request.GET.get('q') if request.GET.get('q') != None else ''
    topics = Topic.objects.filter(name__icontains=q)
    return render(request,
                  'base/topics.html',
                   {'topics': topics},
                     )

@login_required(login_url='login')
def activityPage(request):
    room_messages = Message.objects.all()
    return render(request, 'base/activity.html', {'room_messages': room_messages})

@login_required(login_url='login')
def follow_user(request, pk):
    user_to_follow = User.objects.get(id=pk)
    current_user = request.user

    # Prevent a user from following themselves
    if current_user == user_to_follow:
        return JsonResponse({'error': 'A user cannot follow themselves.'}, status=400)

    # Check if the current user is following the user_to_follow
    is_following = Follow.objects.filter(follower=current_user, followed=user_to_follow).exists()

    if request.method == 'POST':
        if is_following:
            # If the current user is already following the user, unfollow
            Follow.objects.filter(follower=current_user, followed=user_to_follow).delete()
            is_following = False
        else:
            # If the current user is not following the user, follow
            Follow.objects.create(follower=current_user, followed=user_to_follow)
            is_following = True

    # Get the number of followers of the user_to_follow
    followers = Follow.objects.filter(followed=user_to_follow)
    num_followers = followers.count()

    return JsonResponse({user_to_follow.id: {'num_followers': num_followers, 'is_following': is_following}})


@login_required(login_url='login')
def get_follow_data(request, pk):
    user = User.objects.get(id=pk)
    num_followers = Follow.objects.filter(followed=user).count()
    is_following = Follow.objects.filter(follower=request.user, followed=user).exists()

    # Create a dictionary that includes only the fields you want to include in the response
    user_data = {
        'id': user.id,
        'username': user.username,
        # 'first_name': user.first_name,
        # 'last_name': user.last_name,
        # 'email': user.email,
        # 'date_joined': user.date_joined,
        # Add any other fields you want to include
    }

    return JsonResponse({
        
        'num_followers': num_followers,
       
    })

@login_required
def leave_room(request, room_id):
    room = get_object_or_404(Room, id=room_id)
    room.participants.remove(request.user)
    return JsonResponse({'status': 'ok'})


# Direct Messaging Views
@login_required
def inbox(request):
    """View all conversations for the logged-in user"""
    conversations = request.user.conversations.all()
    
    # Annotate with unread count and online status
    conversations_data = []
    for conv in conversations:
        other_user = conv.get_other_participant(request.user)
        last_msg = conv.last_message()
        unread_count = conv.direct_messages.filter(is_read=False).exclude(sender=request.user).count()
        
        # Check if user is online (active within last 5 minutes)
        is_online = False
        if other_user.last_activity:
            time_diff = timezone.now() - other_user.last_activity
            is_online = time_diff.total_seconds() < 300  # 5 minutes
        
        conversations_data.append({
            'conversation': conv,
            'other_user': other_user,
            'last_message': last_msg,
            'unread_count': unread_count,
            'is_online': is_online
        })
    
    context = {'conversations_data': conversations_data}
    return render(request, 'base/inbox.html', context)


@login_required
def conversation_detail(request, pk):
    """View a specific conversation and send messages"""
    conversation = get_object_or_404(Conversation, id=pk)
    
    # Ensure the user is a participant
    if request.user not in conversation.participants.all():
        messages.error(request, 'You do not have access to this conversation')
        return redirect('inbox')
    
    # Mark messages as read
    conversation.direct_messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)
    
    # Handle message sending
    if request.method == 'POST':
        body = request.POST.get('body', '')
        reply_to_id = request.POST.get('reply_to_id')
        file = request.FILES.get('file')
        file_type = 'text'
        voice_duration = request.POST.get('voice_duration')
        
        # Determine file type
        if file:
            file_name = file.name.lower()
            if file_name.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                file_type = 'image'
            elif file_name.endswith(('.mp4', '.webm', '.mov', '.avi')):
                file_type = 'video'
            elif file_name.endswith(('.mp3', '.wav', '.ogg', '.m4a', '.webm')):
                file_type = 'voice'
        
        # Ensure either body or file is provided
        if body or file:
            reply_to = None
            if reply_to_id:
                try:
                    reply_to = DirectMessage.objects.get(id=reply_to_id, conversation=conversation)
                except DirectMessage.DoesNotExist:
                    pass
            
            message = DirectMessage.objects.create(
                conversation=conversation,
                sender=request.user,
                body=body,
                file=file,
                file_type=file_type,
                voice_duration=int(voice_duration) if voice_duration else None,
                reply_to=reply_to
            )
            
            # Send WebSocket notification to the recipient (for unread count)
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            
            other_user = conversation.get_other_participant(request.user)
            channel_layer = get_channel_layer()
            
            # Send to recipient's notification channel (for message icon)
            async_to_sync(channel_layer.group_send)(
                f'user_{other_user.id}',
                {
                    'type': 'new_message',
                }
            )
            
            # Send to chat room (for real-time conversation updates)
            message_data = {
                'id': message.id,
                'body': message.body,
                'file_url': message.file.url if message.file else None,
                'file_type': message.file_type,
                'voice_duration': message.voice_duration,
                'sender_id': message.sender.id,
                'sender_username': message.sender.username,
                'sender_avatar': message.sender.avatar.url if message.sender.avatar else None,
                'created': message.created.strftime('%b %d, %I:%M %p'),
                'reply_to': None
            }
            
            if message.reply_to:
                message_data['reply_to'] = {
                    'id': message.reply_to.id,
                    'body': message.reply_to.body,
                    'file_type': message.reply_to.file_type,
                    'sender_username': message.reply_to.sender.username
                }
            
            async_to_sync(channel_layer.group_send)(
                f'chat_{conversation.id}',
                {
                    'type': 'chat_message',
                    'message': message_data
                }
            )
            
            # Return JSON for AJAX requests
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                from django.http import JsonResponse
                return JsonResponse({'success': True, 'message': message_data})
            
            return redirect('conversation', pk=pk)
    
    messages_list = conversation.direct_messages.all()
    other_user = conversation.get_other_participant(request.user)
    
    context = {
        'conversation': conversation,
        'messages': messages_list,
        'other_user': other_user
    }
    return render(request, 'base/conversation.html', context)


@login_required
def start_conversation(request, user_pk):
    """Start a new conversation with a user or redirect to existing one"""
    other_user = get_object_or_404(User, id=user_pk)
    
    if other_user == request.user:
        return JsonResponse({'error': 'You cannot message yourself'}, status=400)
    
    # Check if the other user is following the current user
    is_followed_by_receiver = Follow.objects.filter(follower=other_user, followed=request.user).exists()
    
    # Check if the current user is following the other user
    is_following_receiver = Follow.objects.filter(follower=request.user, followed=other_user).exists()
    
    if not is_followed_by_receiver:
        return JsonResponse({'error': f'{other_user.username} must follow you before you can send them a message'}, status=403)
    
    if not is_following_receiver:
        return JsonResponse({'error': f'You must follow {other_user.username} before you can send them a message'}, status=403)
    
    # Check if conversation already exists
    existing_conv = Conversation.objects.filter(
        participants=request.user
    ).filter(
        participants=other_user
    ).first()
    
    if existing_conv:
        return JsonResponse({'success': True, 'redirect': f'/conversation/{existing_conv.id}/'})
    
    # Create new conversation
    conversation = Conversation.objects.create()
    conversation.participants.add(request.user, other_user)
    
    return JsonResponse({'success': True, 'redirect': f'/conversation/{conversation.id}/'})


@login_required
def api_unread_count(request):
    """API endpoint for polling unread message count"""
    unread_count = DirectMessage.objects.filter(
        conversation__participants=request.user,
        is_read=False
    ).exclude(sender=request.user).count()
    
    return JsonResponse({'count': unread_count})


def offline_page(request):
    """Offline fallback page"""
    return render(request, 'offline.html')


def service_worker(request):
    """Serve service worker from root path"""
    from django.http import HttpResponse
    import os
    
    sw_path = os.path.join(settings.BASE_DIR, 'static', 'js', 'service-worker.js')
    
    try:
        with open(sw_path, 'r', encoding='utf-8') as f:
            sw_content = f.read()
        
        response = HttpResponse(sw_content, content_type='application/javascript')
        response['Service-Worker-Allowed'] = '/'
        response['Cache-Control'] = 'no-cache'
        return response
    except FileNotFoundError:
        return HttpResponse('Service worker not found', status=404)


def desktopLanding(request):
    """
    Landing page for desktop users promoting the mobile app.
    This page is shown to non-mobile users before they can access the main app.
    """
    return render(request, 'base/desktop-landing.html')


#print(check_user_status(1))