from django.urls import path
from . import views

urlpatterns = [
    path('save-event/', views.save_event, name='save_event'),
    path('load-events/', views.load_events, name='load_events'),
    path('delete-event/', views.delete_event, name='delete_event'),
    path('signup/', views.signup, name='signup'),  # ← Добавляем регистрацию
]
