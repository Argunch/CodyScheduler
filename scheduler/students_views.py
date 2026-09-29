from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.http import JsonResponse
import json
from .models import Student
from functools import wraps


def superuser_required_page(view_func):
    """Декоратор для HTML-страниц: редирект на главную."""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_superuser:
            return redirect('home')
        return view_func(request, *args, **kwargs)
    return wrapper

def superuser_required_json(view_func):
    """Декоратор для JSON API: 403 + JSON-ответ."""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_superuser:
            return JsonResponse(
                {'status': 'error', 'message': 'Доступ запрещён'},
                status=403
            )
        return view_func(request, *args, **kwargs)
    return wrapper


@login_required
@superuser_required_page
def students_page(request):
    """Страница управления учениками — только для суперпользователей."""
    if not request.user.is_superuser:                            
        return redirect('home')                                    
    return render(request, 'students.html')

@csrf_exempt
@require_POST
@login_required
@superuser_required_json
def save_student(request):
    """API для сохранения ученика"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            first_name = data.get('first_name', '').strip()
            last_name = data.get('last_name', '').strip()

            if not first_name or not last_name:
                return JsonResponse({
                    'status': 'error', 
                    'message': 'Имя и фамилия обязательны'
                })

            # Создаем ученика
            student = Student.objects.create(
                first_name=first_name,
                last_name=last_name,
                created_by=request.user
            )

            return JsonResponse({
                'status': 'success',
                'id': student.id,
                'full_name': str(student),
                'message': 'Ученик успешно добавлен'
            })

        except Exception as e:
            return JsonResponse({
                'status': 'error', 
                'message': f'Ошибка: {str(e)}'
            })

    return JsonResponse({'status': 'error', 'message': 'Метод не разрешен'})

@login_required
@superuser_required_json
def load_students(request):
    """API для загрузки списка учеников"""
    try:
        students = Student.objects.all()
        students_list = [
            {
                'id': student.id,
                'first_name': student.first_name,
                'last_name': student.last_name,
                'full_name': str(student),
                'created_at': student.created_at.strftime('%d.%m.%Y')
            }
            for student in students
        ]

        return JsonResponse({
            'status': 'success',
            'students': students_list
        })

    except Exception as e:
        return JsonResponse({
            'status': 'error', 
            'message': f'Ошибка загрузки: {str(e)}'
        })

@csrf_exempt
@require_POST
@login_required
@superuser_required_json
def update_student(request):
    """API для обновления данных ученика"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            student_id = data.get('id')
            first_name = data.get('first_name', '').strip()
            last_name = data.get('last_name', '').strip()

            if not student_id:
                return JsonResponse({'status': 'error', 'message': 'ID не указан'})

            if not first_name or not last_name:
                return JsonResponse({'status': 'error', 'message': 'Имя и фамилия обязательны'})

            # Ищем ученика, принадлежащего текущему пользователю
            student = Student.objects.get(id=student_id)
            student.first_name = first_name
            student.last_name = last_name
            student.save()

            return JsonResponse({
                'status': 'success',
                'id': student.id,
                'full_name': str(student),
                'message': 'Ученик обновлён'
            })

        except Student.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Ученик не найден'})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': f'Ошибка: {str(e)}'})

    return JsonResponse({'status': 'error', 'message': 'Метод не разрешен'})

@csrf_exempt
@require_POST
@login_required
@superuser_required_json
def delete_student(request):
    """API для удаления ученика"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            student_id = data.get('id')

            if not student_id:
                return JsonResponse({
                    'status': 'error', 
                    'message': 'ID ученика не указан'
                })

            student = Student.objects.get(id=student_id)
            student.delete()

            return JsonResponse({
                'status': 'success',
                'message': 'Ученик успешно удален'
            })

        except Student.DoesNotExist:
            return JsonResponse({
                'status': 'error', 
                'message': 'Ученик не найден'
            })
        except Exception as e:
            return JsonResponse({
                'status': 'error', 
                'message': f'Ошибка: {str(e)}'
            })

    return JsonResponse({'status': 'error', 'message': 'Метод не разрешен'})


@login_required
@superuser_required_page
def student_detail(request, student_id):
    """Страница одного ученика."""
    student = get_object_or_404(
        Student,
        id=student_id,
    )
    return render(request, 'student_detail.html', {'student': student})