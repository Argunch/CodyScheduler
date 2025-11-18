from django.urls import path
from . import views

urlpatterns = [
    path('save-event/', views.save_event, name='save_event'),
    path('load-events/', views.load_events, name='load_events'),
    path('load-series-events/', views.load_series_events, name='load_series_events'),
    path('check-event-conflict/', views.check_event_conflict, name='check_event_conflict'),
    path('delete-event/', views.delete_event, name='delete_event'),
    path('switch_user/', views.switch_user, name='switch_user'),
    path('get_users_list/', views.get_users_list, name='get_users_list'),
    path('signup/', views.signup, name='signup'),  # ← Добавляем регистрацию
]
