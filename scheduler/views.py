import json

from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from django.http import JsonResponse

from .models import ScheduleEvent, Attendance

from django.shortcuts import render, redirect
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import login

from django.contrib.auth.models import User

from .event_manager import EventManager

@csrf_exempt
@require_POST
@login_required
def save_event(request):
    try:
        # Просто создаем менеджер с request
        manager = EventManager(request)
        
        # парсим JSON
        data = json.loads(request.body)

        result = manager.save_event(data)
        
        return JsonResponse(result)
        
    except ScheduleEvent.DoesNotExist:
        return JsonResponse(
            {'status': 'error', 'message': 'Событие не найдено'}, 
            status=404
        )
    except PermissionError as e:
        return JsonResponse(
            {'status': 'error', 'message': str(e)}, 
            status=403
        )
    except ValueError as e:
        return JsonResponse(
            {'status': 'error', 'message': str(e)}, 
            status=400
        )
    except json.JSONDecodeError:
        return JsonResponse(
            {'status': 'error', 'message': 'Неверный формат JSON'}, 
            status=400
        )
    except Exception as e:
        # Логирование для разработки
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in save_event: {e}", exc_info=True)
        
        return JsonResponse(
            {'status': 'error', 'message': 'Внутренняя ошибка сервера'}, 
            status=500
        )

@csrf_exempt
@login_required
def load_events(request):
    try:
        manager = EventManager(request)
        target_user = manager.target_user

        date_from=request.GET.get('date_from')
        date_to=request.GET.get('date_to')

        from datetime import datetime
        date_from_obj=datetime.strptime(date_from,'%Y-%m-%d').date()
        date_to_obj=datetime.strptime(date_to,'%Y-%m-%d').date()

        events=ScheduleEvent.objects.filter(
            user=target_user,
            date__range=[date_from_obj,date_to_obj]
        ).select_related('created_by', 'user', 'course').prefetch_related('students', 'attendances','compensation_attendances__event__course')

        events_data=[]
        for event in events:
            time_str = event.time.strftime('%H:%M')

            # ДОБАВЛЕНО: карта посещаемости для текущего события
            attendance_map = {a.student_id: a.was_present for a in event.attendances.all()}
            events_data.append({
                'id': event.id,
                'series_id': str(event.series_id),
                'date':event.date.strftime('%Y-%m-%d'),
                'time':time_str,
                'text': event.text,
                'color': event.color,
                'is_recurring': event.is_recurring,
                'duration': float(event.duration),
                'created_by': event.created_by.id,
                'user_id': event.user.id,
                'status': event.status,                                # NEW
                'student_ids': list(event.students.values_list('id', flat=True)),  # NEW
                'students': [
                    {
                        'id': s.id,
                        'full_name': str(s),
                        'remaining_lessons': s.get_remaining_lessons(event.course),
                        'was_present': attendance_map.get(s.id),   # ДОБАВЛЕНО
                    }
                    for s in event.students.all()
                ],
                'course_id': event.course_id,
                'course_name': event.course.name if event.course else '',
                'completion_status': event.completion_status,    # ДОБАВЛЕНО
                'completed_at': event.completed_at.isoformat() if event.completed_at else None,   # ДОБАВЛЕНО

                'is_compensation': event.is_compensation,
                'compensations': [
                    {
                        'student_id': att.student_id,
                        'attendance_id': att.id,
                        'course_name': att.event.course.name if att.event.course else '',
                        'date': att.event.date.strftime('%Y-%m-%d'),
                        'time': att.event.time.strftime('%H:%M'),
                    }
                    for att in event.compensation_attendances.select_related('event__course').all()
                ],
            })
        return  JsonResponse({'status': 'success', 'events': events_data})

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})
    
@csrf_exempt
@login_required
def load_series_events(request):
    try:
        manager = EventManager(request)
        target_user = manager.target_user
        series_id = request.GET.get('series_id')
        
        if not series_id:
            return JsonResponse({'status': 'error', 'message': 'series_id обязателен'})

        # Ищем все события с таким series_id для целевого пользователя
        events = ScheduleEvent.objects.filter(
            user=target_user,
            series_id=series_id,
        ).select_related('created_by', 'user', 'course').prefetch_related('students', 'attendances','compensation_attendances__event__course')

        events_data = []
        for event in events:
            time_str = event.time.strftime('%H:%M')
            # ДОБАВЛЕНО: карта посещаемости для текущего события
            attendance_map = {a.student_id: a.was_present for a in event.attendances.all()}
            events_data.append({
                'id': event.id,
                'series_id': str(event.series_id),
                'date': event.date.strftime('%Y-%m-%d'),
                'time': time_str,
                'text': event.text,
                'color': event.color,
                'is_recurring': event.is_recurring,
                'duration': float(event.duration),
                'created_by': event.created_by.id,
                'user_id': event.user.id,
                'status': event.status,                                # NEW
                'student_ids': list(event.students.values_list('id', flat=True)),  # NEW
                'students': [
                    {
                        'id': s.id,
                        'full_name': str(s),
                        'remaining_lessons': s.get_remaining_lessons(event.course),
                        'was_present': attendance_map.get(s.id),   # ДОБАВЛЕНО
                    }
                    for s in event.students.all()
                ],
                'course_id': event.course_id,
                'course_name': event.course.name if event.course else '',
                'completion_status': event.completion_status,    # ДОБАВЛЕНО
                'completed_at': event.completed_at.isoformat() if event.completed_at else None,   # ДОБАВЛЕНО

                'is_compensation': event.is_compensation,
                'compensations': [
                    {
                        'student_id': att.student_id,
                        'attendance_id': att.id,
                        'course_name': att.event.course.name if att.event.course else '',
                        'date': att.event.date.strftime('%Y-%m-%d'),
                        'time': att.event.time.strftime('%H:%M'),
                    }
                    for att in event.compensation_attendances.select_related('event__course').all()
                ],
            })
        
        return JsonResponse({'status': 'success', 'events': events_data})

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})

@csrf_exempt
@login_required
def check_event_conflict(request):
    """Проверить конфликт событий при создании/переносе"""
    try:
        manager = EventManager(request)
        target_user = manager.target_user
        
        date_str = request.GET.get('date')
        time_str = request.GET.get('time')
        duration = request.GET.get('duration')
        exclude_event_id = request.GET.get('exclude_event_id')
        
        if not all([date_str, time_str, duration]):
            return JsonResponse({
                'status': 'error', 
                'message': 'Отсутствуют обязательные параметры: date, time, duration'
            }, status=400)

        from datetime import datetime, timedelta
        
        # Парсим дату и время
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        # Парсим время - поддерживаем разные форматы
        time_obj = None
        time_formats = ['%H:%M:%S', '%H:%M', '%H']
        for fmt in time_formats:
            try:
                time_obj = datetime.strptime(time_str, fmt).time()
                break
            except ValueError:
                continue
        
        if time_obj is None:
            return JsonResponse({
                'status': 'error', 
                'message': 'Неверный формат времени'
            }, status=400)
        
        # Конвертируем продолжительность
        try:
            duration_hours = float(duration)
        except ValueError:
            return JsonResponse({
                'status': 'error', 
                'message': 'Неверный формат продолжительности'
            }, status=400)
        
        # Вычисляем время окончания события
        start_datetime = datetime.combine(date_obj, time_obj)
        end_datetime = start_datetime + timedelta(hours=duration_hours)
        end_time = end_datetime.time()
        
        # Ищем конфликтующие события
        conflicting_events = ScheduleEvent.objects.filter(
            user=target_user,
            date=date_obj
        )
        
        # Исключаем текущее событие из проверки (если указано)
        if exclude_event_id:
            conflicting_events = conflicting_events.exclude(id=exclude_event_id)
        
        # Проверяем каждое событие на пересечение по времени
        conflicts = []
        for event in conflicting_events:
            event_start = datetime.combine(date_obj, event.time)
            event_end = event_start + timedelta(hours=float(event.duration))
            
            # Проверяем пересечение интервалов
            if (start_datetime < event_end and end_datetime > event_start):
                conflicts.append({
                    'id': event.id,
                    'text': event.text,
                    'time': event.time.strftime('%H:%M'),
                    'duration': float(event.duration),
                    'color': event.color
                })
        
        if conflicts:
            conflict_messages = []
            for conflict in conflicts:
                conflict_messages.append(
                    f"{conflict['text']} ({conflict['time']}, {conflict['duration']}ч)"
                )
            
            return JsonResponse({
                'hasConflict': True,
                'message': f'Конфликт с событиями: {", ".join(conflict_messages)}',
                'conflictingEvents': conflicts
            })
        else:
            return JsonResponse({
                'hasConflict': False,
                'message': 'Конфликтов не обнаружено'
            })
            
    except Exception as e:
        return JsonResponse({
            'status': 'error', 
            'message': f'Ошибка при проверке конфликта: {str(e)}'
        }, status=500)

@csrf_exempt
@require_POST
@login_required
def delete_event(request):
    try:
        manager = EventManager(request)
        target_user = manager.target_user

        data = json.loads(request.body)
        event_id = data.get('id')  # ← получаем id события
        delete_recurring = data.get('delete_recurring', False)

        if not event_id:
            return JsonResponse({'status': 'error', 'message': 'Не указан ID события'})

        try:
            event = ScheduleEvent.objects.get(id=event_id, user=target_user)

            if delete_recurring:
                # Удаляем все регулярные занятия из этой серии
                ScheduleEvent.objects.filter(
                    user=target_user,
                    series_id=event.series_id,
                ).delete()
            else:
                event.delete()

            return JsonResponse({'status': 'success', 'message': 'Событие удалено'})
        except ScheduleEvent.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Событие не найдено'})

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@csrf_exempt
@require_POST
@login_required
def switch_user(request):
    """Переключение на другого пользователя"""
    if not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Доступ запрещен'})

    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')

        if user_id == 'self':
            # Возврат к своему расписанию
            if 'target_user_id' in request.session:
                del request.session['target_user_id']
            return JsonResponse({'status': 'success', 'message': 'Режим просмотра: свое расписание'})

        target_user = User.objects.get(id=user_id)
        request.session['target_user_id'] = user_id

        return JsonResponse({
            'status': 'success',
            'message': f'Режим просмотра: {target_user.username}'
        })

    except User.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Пользователь не найден'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@login_required
def get_users_list(request):
    """Получение списка пользователей для суперпользователя"""
    if not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Доступ запрещен'})

    users = User.objects.all().order_by('username')
    users_data = [{'id': user.id, 'username': user.username} for user in users]

    return JsonResponse({'status': 'success', 'users': users_data})

def signup(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('home')  # Или 'scheduler:home' если есть namespace
    else:
        form = UserCreationForm()
    return render(request, 'registration/signup.html', {'form': form})

@csrf_exempt
@login_required
def load_unmarked_events(request):
    """API: список непроверенных индивидуальных занятий за 7 дней"""
    try:
        manager = EventManager(request)
        events = manager.load_unmarked_events()
        return JsonResponse({'status': 'success', 'events': events})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@csrf_exempt
@require_POST
@login_required
def mark_event(request):
    """API: отметить проведение занятия (индивидуального или группового)"""
    try:
        manager = EventManager(request)
        data = json.loads(request.body)

        event_id = data.get('id')
        if not event_id:
            return JsonResponse(
                {'status': 'error', 'message': 'Нужен id события'},
                status=400
            )

        completion_status = data.get('completion_status')
        attendances = data.get('attendances')

        result = manager.mark_event(event_id, completion_status, attendances)
        return JsonResponse({'status': 'success', **result})

    except ScheduleEvent.DoesNotExist:
        return JsonResponse(
            {'status': 'error', 'message': 'Событие не найдено'},
            status=404
        )
    except ValueError as e:
        return JsonResponse(
            {'status': 'error', 'message': str(e)},
            status=400
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error in mark_event: {e}", exc_info=True)
        return JsonResponse(
            {'status': 'error', 'message': 'Внутренняя ошибка сервера'},
            status=500
        )


@login_required
def load_all_unmarked_events(request):
    """API: неотмеченные занятия всех преподавателей (только суперюзер)."""
    if not request.user.is_superuser:
        return JsonResponse(
            {'status': 'error', 'message': 'Доступ запрещён'},
            status=403
        )

    try:
        from django.utils import timezone
        from datetime import timedelta

        now = timezone.localtime()
        week_ago = now - timedelta(days=7)

        qs = ScheduleEvent.objects.filter(
            status__in=[
                ScheduleEvent.STATUS_INDIVIDUAL,
                ScheduleEvent.STATUS_GROUP,
            ],
            completion_status='',
            date__gte=week_ago.date(),
        ).select_related(
            'user', 'course'
        ).prefetch_related(
            'students', 'attendances'
        ).order_by('date', 'time')

        result = []
        for event in qs:
            if not event.is_finished(now=now):
                continue

            existing = {a.student_id: a.was_present for a in event.attendances.all()}

            result.append({
                'id': event.id,
                'teacher_id': event.user.id,
                'teacher_name': event.user.username,
                'date': event.date.strftime('%Y-%m-%d'),
                'time': event.time.strftime('%H:%M'),
                'text': event.text or 'Без названия',
                'course_id': event.course_id,
                'course_name': event.course.name if event.course else '',
                'status': event.status,
                'duration': float(event.duration),
                'students': [
                    {
                        'id': s.id,
                        'full_name': str(s),
                        'remaining_lessons': s.get_remaining_lessons(event.course),
                        'was_present': existing.get(s.id),
                    }
                    for s in event.students.all()
                ],

                'is_compensation': event.is_compensation,
            })

        return JsonResponse({'status': 'success', 'events': result})

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@login_required
def load_problem_students(request):
    """
    API: ученики с нулевым или отрицательным балансом.
    Показывает только тех, у кого есть хоть одна операция
    (иначе все ученики без платежей попадут в «нулевые»).
    Только для суперюзера.
    """
    if not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Доступ запрещён'}, status=403)

    try:
        from django.db.models import Sum
        from .models import BalanceOperation, Student

        # Ученики с хотя бы одной операцией
        # students_with_ops = Student.objects.filter(
        #     balance_operations__isnull=False
        # ).distinct()

        # Все ученики с нулём
        students_with_ops = Student.objects.all()


        zero = []
        negative = []

        for s in students_with_ops:
            total = BalanceOperation.objects.filter(student=s).aggregate(
                s=Sum('amount')
            )['s'] or 0

            if total == 0:
                zero.append({'id': s.id, 'full_name': str(s), 'balance': 0})
            elif total < 0:
                negative.append({'id': s.id, 'full_name': str(s), 'balance': total})

        # Сортировка
        negative.sort(key=lambda x: x['balance'])              # самые большие долги сверху
        zero.sort(key=lambda x: x['full_name'].lower())


        # Автоматические компенсации: ученик отсутствовал И было списание
        # (универсально для индов и групп)
        charged_event_students = set(
            BalanceOperation.objects.filter(
                operation_type=BalanceOperation.TYPE_CHARGE,
                event__isnull=False,
            ).values_list('event_id', 'student_id')
        )

        attendances_qs = Attendance.objects.filter(
            was_present=False,
            compensated=False,
        ).select_related('student', 'event', 'event__course').order_by('-event__date', '-event__time')

        compensations = []
        for a in attendances_qs:
            if (a.event_id, a.student_id) not in charged_event_students:
                continue   # не списывали — компенсация не нужна
            compensations.append({
                'attendance_id': a.id,
                'student_id': a.student.id,
                'student_name': str(a.student),
                'date': a.event.date.strftime('%Y-%m-%d'),
                'time': a.event.time.strftime('%H:%M'),
                'course_name': a.event.course.name if a.event.course else '',
                'is_manual': False,
            })

        return JsonResponse({
            'status': 'success',
            'zero': zero,
            'negative': negative,
            'compensations': compensations,
        })

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})

@csrf_exempt
@require_POST
@login_required
def mark_compensated(request):
    """API: отметить компенсации как предоставленные. Только для суперюзера."""
    if not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Доступ запрещён'}, status=403)

    try:
        from .models import Attendance
        data = json.loads(request.body)
        ids = data.get('ids', [])

        if not ids:
            return JsonResponse(
                {'status': 'error', 'message': 'Не переданы id компенсаций'},
                status=400
            )

        updated = Attendance.objects.filter(id__in=ids).update(compensated=True)
        return JsonResponse({'status': 'success', 'updated': updated})

    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Неверный формат JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@login_required
def load_student_compensations(request):
    """API: некомпенсированные пропуски конкретного ученика (только суперюзер)."""
    if not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Доступ запрещён'}, status=403)

    try:
        from .models import Attendance, BalanceOperation

        student_id = request.GET.get('student_id')
        if not student_id:
            return JsonResponse({'status': 'error', 'message': 'Не указан student_id'}, status=400)

        # Пропуски ученика с was_present=False и compensated=False,
        # по которым было списание
        charged = set(
            BalanceOperation.objects.filter(
                operation_type=BalanceOperation.TYPE_CHARGE,
                event__isnull=False,
            ).values_list('event_id', 'student_id')
        )

        qs = Attendance.objects.filter(
            student_id=student_id,
            was_present=False,
            compensated=False,
        ).select_related('event', 'event__course').order_by('-event__date', '-event__time')

        data = []
        for a in qs:
            if (a.event_id, a.student_id) not in charged:
                continue
            # Пропускаем пропуски, которые уже привязаны к незавершённой компенсации
            if a.compensating_events.exists():
                continue
            data.append({
                'attendance_id': a.id,
                'event_id': a.event_id,
                'course_id': a.event.course_id,  
                'course_name': a.event.course.name if a.event.course else '',
                'date': a.event.date.strftime('%Y-%m-%d'),
                'time': a.event.time.strftime('%H:%M'),
                'event_text': a.event.text or '',
            })

        return JsonResponse({'status': 'success', 'compensations': data})

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})

