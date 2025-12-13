from django.urls import path
from . import views
from . import students_views


urlpatterns = [
    path('save-event/', views.save_event, name='save_event'),
    path('load-events/', views.load_events, name='load_events'),
    path('load-series-events/', views.load_series_events, name='load_series_events'),
    path('check-event-conflict/', views.check_event_conflict, name='check_event_conflict'),
    path('delete-event/', views.delete_event, name='delete_event'),
    path('switch_user/', views.switch_user, name='switch_user'),
    path('get_users_list/', views.get_users_list, name='get_users_list'),
    path('signup/', views.signup, name='signup'),  # ← Добавляем регистрацию

    path('students/', students_views.students_page, name='students_page'),
    path('save-student/', students_views.save_student, name='save_student'),
    path('load-students/', students_views.load_students, name='load_students'),
    path('delete-student/', students_views.delete_student, name='delete_student'),
]
