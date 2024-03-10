from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.utils import timezone
from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from .models import Room, Topic, Message, User, Follow
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

        try:
            user = User.objects.get(username=username)
        except:
            messages.error(request, 'Username does not exist')
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
    for user in User.objects.all():
        last_activity = user.last_activity.timestamp() if user.last_activity else None
        if last_activity:
            is_online = timezone.now().timestamp() - last_activity < 80
        else:
            is_online = False
        user_status = {'user_id': user.id, 'is_online': is_online}
        users_status.append(user_status)
    return JsonResponse(users_status, safe=False)

def lougoutUser(request):
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

def activityPage(request):
    room_messages = Message.objects.all()
    return render(request, 'base/activity.html', {'room_messages': room_messages})

@login_required(login_url='login')
def follow_user(request, pk):
    # Get the user to be followed
    user_to_follow = User.objects.get(pk=pk)

    # Check if the current user is already following the user
    follow_exists = Follow.objects.filter(follower=request.user, followed=user_to_follow).exists()

    if request.method == 'POST':
        if follow_exists:
            # If the current user is already following the user, unfollow
            Follow.objects.filter(follower=request.user, followed=user_to_follow).delete()
        else:
            # If the current user is not following the user, follow
            Follow.objects.create(follower=request.user, followed=user_to_follow)
        
        followers_count = Follow.objects.filter(followed=user_to_follow).count()

        return JsonResponse({'followers_count': followers_count, 'follow_exists': not follow_exists})

    





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





#print(check_user_status(1))