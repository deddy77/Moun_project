from django.forms import ModelForm
from django.contrib.auth.forms import UserCreationForm
from .models import Room, User




class MyUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ['name',
                   'username',
                    'email',
                    'password1',
                    'password2',
                ]

class RoomForm(ModelForm):
    class Meta:
        model = Room
        fields = '__all__'
        exclude = ['host',
                    'participants',
                    ]

class UserForm(ModelForm):
    class Meta:
        model = User
        fields = [
            'name',
            'email',
            'avatar',
            'bio',
        ]
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Prevent username modification by removing it from the form
        # Username is unique and immutable once set
        if 'username' in self.fields:
            del self.fields['username']
        