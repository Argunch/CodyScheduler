import json

from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.http import JsonResponse
from django.db import IntegrityError

from .models import Course, Student, StudentCoursePrice, BalanceOperation
from django.utils import timezone   
from functools import wraps


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
@superuser_required_json
def load_courses(request):
    """API: список активных курсов (для dropdown)."""
    try:
        courses = Course.objects.filter(is_archived=False).order_by('name')
        data = [
            {'id': c.id, 'name': c.name}
            for c in courses
        ]
        return JsonResponse({'status': 'success', 'courses': data})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@csrf_exempt
@require_POST
@login_required
@superuser_required_json
def create_course(request):
    """API: создание нового курса."""
    try:
        data = json.loads(request.body)
        name = (data.get('name') or '').strip()

        if not name:
            return JsonResponse(
                {'status': 'error', 'message': 'Название курса обязательно'},
                status=400
            )
        if len(name) > 100:
            return JsonResponse(
                {'status': 'error', 'message': 'Название слишком длинное (макс. 100)'},
                status=400
            )

        # Проверяем дубликат заранее — чтобы дать понятную ошибку
        if Course.objects.filter(name__iexact=name).exists():
            return JsonResponse(
                {'status': 'error', 'message': f'Курс «{name}» уже существует'},
                status=400
            )

        course = Course.objects.create(
            name=name,
            created_by=request.user
        )
        return JsonResponse({
            'status': 'success',
            'id': course.id,
            'name': course.name,
        })

    except IntegrityError:
        # На случай гонки — если два запроса одновременно создадут одинаковое имя
        return JsonResponse(
            {'status': 'error', 'message': 'Курс с таким названием уже существует'},
            status=400
        )
    except json.JSONDecodeError:
        return JsonResponse(
            {'status': 'error', 'message': 'Неверный формат JSON'},
            status=400
        )
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@csrf_exempt
@require_POST
@login_required
@superuser_required_json
def delete_course(request):
    """API: удаление курса. mode = 'archive' | 'hard'."""
    try:
        data = json.loads(request.body)
        course_id = data.get('id')
        mode = data.get('mode', 'archive')   # ДОБАВЛЕНО: режим удаления

        if not course_id:
            return JsonResponse(
                {'status': 'error', 'message': 'Не указан ID курса'},
                status=400
            )

        # ДОБАВЛЕНО: валидация режима
        if mode not in ('archive', 'hard'):
            return JsonResponse(
                {'status': 'error', 'message': 'Неверный режим удаления'},
                status=400
            )

        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return JsonResponse(
                {'status': 'error', 'message': 'Курс не найден'},
                status=404
            )

        # ИЗМЕНЕНО: ветвление по режиму
        if mode == 'archive':
            if course.is_archived:
                return JsonResponse(
                    {'status': 'error', 'message': 'Курс уже в архиве'},
                    status=400
                )
            course.is_archived = True
            course.save(update_fields=['is_archived'])
            return JsonResponse({
                'status': 'success',
                'mode': 'archive',
                'id': course.id,
                'message': f'Курс «{course.name}» отправлен в архив'
            })
        else:   # hard
            name = course.name   # сохраняем до удаления
            course.delete()      # каскад удалит связанные записи
            return JsonResponse({
                'status': 'success',
                'mode': 'hard',
                'id': course_id,
                'message': f'Курс «{name}» удалён'
            })

    except json.JSONDecodeError:
        return JsonResponse(
            {'status': 'error', 'message': 'Неверный формат JSON'},
            status=400
        )
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@login_required
@superuser_required_json
def load_course_prices(request):
    """API: список цен конкретного ученика по курсам."""
    try:
        student_id = request.GET.get('student_id')   # ДОБАВЛЕНО: id ученика из query
        if not student_id:
            return JsonResponse(
                {'status': 'error', 'message': 'Не указан student_id'},
                status=400
            )

        # ДОБАВЛЕНО: проверяем, что ученик существует и принадлежит текущему пользователю
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return JsonResponse(
                {'status': 'error', 'message': 'Ученик не найден'},
                status=404
            )

        prices = StudentCoursePrice.objects.filter(student=student).select_related('course')
        data = [
            {
                'id': p.id,
                'course_id': p.course.id,
                'course_name': p.course.name,
                'price_per_lesson': p.price_per_lesson,
            }
            for p in prices
        ]
        return JsonResponse({'status': 'success', 'prices': data})

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@csrf_exempt
@require_POST
@login_required
@superuser_required_json
def save_course_price(request):
    """API: создать или обновить цену ученика за курс."""
    try:
        data = json.loads(request.body)
        student_id = data.get('student_id')       # ДОБАВЛЕНО
        course_id = data.get('course_id')         # ДОБАВЛЕНО
        price = data.get('price_per_lesson')      # ДОБАВЛЕНО

        # ДОБАВЛЕНО: валидация обязательных полей
        if not student_id or not course_id:
            return JsonResponse(
                {'status': 'error', 'message': 'Нужны student_id и course_id'},
                status=400
            )

        # ДОБАВЛЕНО: price должен быть целым неотрицательным
        try:
            price = int(price)
        except (TypeError, ValueError):
            return JsonResponse(
                {'status': 'error', 'message': 'Цена должна быть целым числом'},
                status=400
            )
        if price < 0:
            return JsonResponse(
                {'status': 'error', 'message': 'Цена не может быть отрицательной'},
                status=400
            )

        # ДОБАВЛЕНО: проверяем ученика и курс
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return JsonResponse(
                {'status': 'error', 'message': 'Ученик не найден'},
                status=404
            )

        try:
            course = Course.objects.get(id=course_id, is_archived=False)
        except Course.DoesNotExist:
            return JsonResponse(
                {'status': 'error', 'message': 'Курс не найден или в архиве'},
                status=404
            )

        # ДОБАВЛЕНО: upsert — создать или обновить
        price_obj, created = StudentCoursePrice.objects.update_or_create(
            student=student,
            course=course,
            defaults={'price_per_lesson': price}
        )

        return JsonResponse({
            'status': 'success',
            'id': price_obj.id,
            'course_id': course.id,
            'course_name': course.name,
            'price_per_lesson': price_obj.price_per_lesson,
            'created': created,
        })

    except json.JSONDecodeError:
        return JsonResponse(
            {'status': 'error', 'message': 'Неверный формат JSON'},
            status=400
        )
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})

@login_required
@superuser_required_json
def load_payments(request):
    """API: список платежей (только type=payment) ученика."""
    try:
        student_id = request.GET.get('student_id')
        if not student_id:
            return JsonResponse(
                {'status': 'error', 'message': 'Не указан student_id'},
                status=400
            )

        try:
            student = Student.objects.get(id=student_id, created_by=request.user)
        except Student.DoesNotExist:
            return JsonResponse(
                {'status': 'error', 'message': 'Ученик не найден'},
                status=404
            )

        ops = BalanceOperation.objects.filter(
            student=student,
            operation_type=BalanceOperation.TYPE_PAYMENT
        ).select_related('course').order_by('-operation_date', '-created_at')

        data = [
            {
                'id': op.id,
                'course_id': op.course.id,
                'course_name': op.course.name,
                'amount': op.amount,
                'operation_date': op.operation_date.strftime('%Y-%m-%d'),
            }
            for op in ops
        ]
        return JsonResponse({'status': 'success', 'payments': data})

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@csrf_exempt
@require_POST
@login_required
@superuser_required_json
def save_payment(request):
    """API: создание или обновление платежа."""
    try:
        data = json.loads(request.body)
        payment_id = data.get('id')                # ДОБАВЛЕНО: если передан — обновляем
        student_id = data.get('student_id')
        course_id = data.get('course_id')
        amount = data.get('amount')
        operation_date = data.get('operation_date')

        # Валидация обязательных полей
        if not student_id or not course_id:
            return JsonResponse(
                {'status': 'error', 'message': 'Нужны student_id и course_id'},
                status=400
            )

        # Валидация суммы — целое, положительное для оплаты
        try:
            amount = int(amount)
        except (TypeError, ValueError):
            return JsonResponse(
                {'status': 'error', 'message': 'Сумма должна быть целым числом'},
                status=400
            )
        if amount <= 0:
            return JsonResponse(
                {'status': 'error', 'message': 'Сумма должна быть больше 0'},
                status=400
            )

        # Валидация даты
        from datetime import datetime
        try:
            date_obj = datetime.strptime(operation_date, '%Y-%m-%d').date()
        except (TypeError, ValueError):
            return JsonResponse(
                {'status': 'error', 'message': 'Неверный формат даты'},
                status=400
            )

        # Ученик
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return JsonResponse(
                {'status': 'error', 'message': 'Ученик не найден'},
                status=404
            )

        # Курс
        try:
            course = Course.objects.get(id=course_id, is_archived=False)
        except Course.DoesNotExist:
            return JsonResponse(
                {'status': 'error', 'message': 'Курс не найден или в архиве'},
                status=404
            )

        if payment_id:
            # Обновление существующего
            try:
                op = BalanceOperation.objects.get(
                    id=payment_id,
                    student=student,
                    operation_type=BalanceOperation.TYPE_PAYMENT
                )
            except BalanceOperation.DoesNotExist:
                return JsonResponse(
                    {'status': 'error', 'message': 'Платёж не найден'},
                    status=404
                )
            op.course = course
            op.amount = amount
            op.operation_date = date_obj
            op.save(update_fields=['course', 'amount', 'operation_date'])
            created = False
        else:
            # Создание
            op = BalanceOperation.objects.create(
                student=student,
                course=course,
                amount=amount,
                operation_type=BalanceOperation.TYPE_PAYMENT,
                operation_date=date_obj,
                created_by=request.user
            )
            created = True

        return JsonResponse({
            'status': 'success',
            'id': op.id,
            'course_id': course.id,
            'course_name': course.name,
            'amount': op.amount,
            'operation_date': op.operation_date.strftime('%Y-%m-%d'),
            'created': created,
        })

    except json.JSONDecodeError:
        return JsonResponse(
            {'status': 'error', 'message': 'Неверный формат JSON'},
            status=400
        )
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})

@csrf_exempt
@require_POST
@login_required
@superuser_required_json
def delete_payment(request):
    """API: удаление платежа по id."""
    try:
        data = json.loads(request.body)
        payment_id = data.get('id')

        if not payment_id:
            return JsonResponse(
                {'status': 'error', 'message': 'Не указан ID платежа'},
                status=400
            )

        try:
            op = BalanceOperation.objects.get(
                id=payment_id,
                operation_type=BalanceOperation.TYPE_PAYMENT,
            )
        except BalanceOperation.DoesNotExist:
            return JsonResponse(
                {'status': 'error', 'message': 'Платёж не найден'},
                status=404
            )

        op.delete()
        return JsonResponse({'status': 'success', 'id': payment_id})

    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Неверный формат JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@csrf_exempt
@require_POST
@login_required
@superuser_required_json
def delete_course_price(request):
    """API: удаление цены ученика за курс по id."""
    try:
        data = json.loads(request.body)
        price_id = data.get('id')

        if not price_id:
            return JsonResponse(
                {'status': 'error', 'message': 'Не указан ID цены'},
                status=400
            )

        try:
            price = StudentCoursePrice.objects.get(
                id=price_id,
            )
        except StudentCoursePrice.DoesNotExist:
            return JsonResponse(
                {'status': 'error', 'message': 'Цена не найдена'},
                status=404
            )

        price.delete()
        return JsonResponse({'status': 'success', 'id': price_id})

    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Неверный формат JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})

@login_required
@superuser_required_json
def load_student_balance(request):
    """API: сводка баланса ученика по курсам."""
    try:
        student_id = request.GET.get('student_id')
        if not student_id:
            return JsonResponse(
                {'status': 'error', 'message': 'Не указан student_id'},
                status=400
            )

        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return JsonResponse(
                {'status': 'error', 'message': 'Ученик не найден'},
                status=404
            )

        summary = student.get_balance_summary()
        return JsonResponse({'status': 'success', **summary})

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})

@login_required
@superuser_required_json
def load_student_attendance(request):
    """API: история посещаемости ученика (по отмеченным занятиям)."""
    try:
        student_id = request.GET.get('student_id')
        if not student_id:
            return JsonResponse(
                {'status': 'error', 'message': 'Не указан student_id'},
                status=400
            )

        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return JsonResponse(
                {'status': 'error', 'message': 'Ученик не найден'},
                status=404
            )

        # ИЗМЕНЕНО: загружаем Attendance и связанные события
        from .models import Attendance, BalanceOperation

        attendances = Attendance.objects.filter(student=student).select_related(
            'event', 'event__course'
        ).order_by('-event__date', '-event__time')

        # Карта списаний: {event_id: amount}
        charge_map = {
            op.event_id: abs(op.amount)
            for op in BalanceOperation.objects.filter(
                student=student,
                operation_type=BalanceOperation.TYPE_CHARGE,
                event__isnull=False,
            )
        }

        records = []
        for att in attendances:
            ev = att.event
            records.append({
                'id': att.id,
                'event_id': ev.id,
                'date': ev.date.strftime('%Y-%m-%d'),
                'time': ev.time.strftime('%H:%M'),
                'course_name': ev.course.name if ev.course else '',
                'event_text': ev.text or '',
                'was_present': att.was_present,
                'completion_status': ev.completion_status,
                'charged': charge_map.get(ev.id, 0),
            })

        return JsonResponse({'status': 'success', 'records': records})

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@login_required
@superuser_required_json
def load_student_extra(request):
    """API: получить дополнительную информацию об ученике."""
    try:
        student_id = request.GET.get('student_id')
        if not student_id:
            return JsonResponse(
                {'status': 'error', 'message': 'Не указан student_id'},
                status=400
            )
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return JsonResponse(
                {'status': 'error', 'message': 'Ученик не найден'},
                status=404
            )

        return JsonResponse({
            'status': 'success',
            'birth_date': student.birth_date.strftime('%Y-%m-%d') if student.birth_date else '',
            'parent_name': student.parent_name or '',
            'parent_phone': student.parent_phone or '',
            'extra_info': student.extra_info or '',
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@csrf_exempt
@require_POST
@login_required
@superuser_required_json
def save_student_extra(request):
    """API: сохранить дополнительную информацию об ученике."""
    try:
        data = json.loads(request.body)
        student_id = data.get('student_id')
        if not student_id:
            return JsonResponse(
                {'status': 'error', 'message': 'Не указан student_id'},
                status=400
            )
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return JsonResponse(
                {'status': 'error', 'message': 'Ученик не найден'},
                status=404
            )

        # Дата рождения — пустая строка => None
        birth_date_raw = (data.get('birth_date') or '').strip()
        if birth_date_raw:
            from datetime import datetime
            try:
                student.birth_date = datetime.strptime(birth_date_raw, '%Y-%m-%d').date()
            except ValueError:
                return JsonResponse(
                    {'status': 'error', 'message': 'Неверный формат даты'},
                    status=400
                )
        else:
            student.birth_date = None

        student.parent_name = (data.get('parent_name') or '').strip()[:200]
        student.parent_phone = (data.get('parent_phone') or '').strip()[:50]
        student.extra_info = data.get('extra_info') or ''

        student.save(update_fields=['birth_date', 'parent_name', 'parent_phone', 'extra_info'])

        return JsonResponse({
            'status': 'success',
            'message': 'Информация сохранена',
        })
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Неверный формат JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})