from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
import json
from .models import Student

@login_required
def students_page(request):
    """Страница управления учениками"""
    return render(request, 'students.html')

@login_required
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
def load_students(request):
    """API для загрузки списка учеников"""
    try:
        students = Student.objects.filter(created_by=request.user)
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

@login_required
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

            student = Student.objects.get(id=student_id, created_by=request.user)
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