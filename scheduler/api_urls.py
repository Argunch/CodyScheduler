# scheduler/api_urls.py
from django.urls import path
from . import views
from . import students_views
from . import courses_views

urlpatterns = [
    path('save-event/', views.save_event, name='save_event'),
    path('load-events/', views.load_events, name='load_events'),
    path('load-series-events/', views.load_series_events, name='load_series_events'),
    path('check-event-conflict/', views.check_event_conflict, name='check_event_conflict'),
    path('delete-event/', views.delete_event, name='delete_event'),
    path('switch_user/', views.switch_user, name='switch_user'),
    path('get_users_list/', views.get_users_list, name='get_users_list'),
    path('signup/', views.signup, name='signup'),

    # API учеников
    path('save-student/', students_views.save_student, name='save_student'),
    path('load-students/', students_views.load_students, name='load_students'),
    path('delete-student/', students_views.delete_student, name='delete_student'),
    path('update-student/', students_views.update_student, name='update_student'),

    # отметки (проведение) занятий
    path('load-unmarked-events/', views.load_unmarked_events, name='load_unmarked_events'),
    path('mark-event/', views.mark_event, name='mark_event'),

    # Курсы
    path('load-courses/', courses_views.load_courses, name='load_courses'),
    path('create-course/', courses_views.create_course, name='create_course'),
    path('delete-course/', courses_views.delete_course, name='delete_course'),

    #Цены на курсы
    path('load-course-prices/', courses_views.load_course_prices, name='load_course_prices'),
    path('save-course-price/', courses_views.save_course_price, name='save_course_price'),
    path('delete-course-price/', courses_views.delete_course_price, name='delete_course_price'), 
       
    # Платежи
    path('load-payments/', courses_views.load_payments, name='load_payments'),
    path('save-payment/', courses_views.save_payment, name='save_payment'),
    path('delete-payment/', courses_views.delete_payment, name='delete_payment'),

    # баланс
    path('load-student-balance/', courses_views.load_student_balance, name='load_student_balance'),

    path('load-student-attendance/', courses_views.load_student_attendance, name='load_student_attendance'),
]