from django.urls import path
from . import views
from . import students_views


urlpatterns = [
    path('students/', students_views.students_page, name='students_page'),
    path('students/<int:student_id>/', students_views.student_detail, name='student_detail'),
]
