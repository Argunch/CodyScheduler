import json

from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from django.http import JsonResponse

from .models import ScheduleEvent

from django.shortcuts import render, redirect
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import login

from django.contrib.auth.models import User
from .models import ScheduleEvent

def get_target_user(request):
    """Определяет целевого пользователя для операций"""
    target_user_id = request.session.get('target_user_id')
    if target_user_id and request.user.is_superuser:
        try:
            return User.objects.get(id=target_user_id)
        except User.DoesNotExist:
            pass
    return request.user

@csrf_exempt
@require_POST
@login_required
def save_event(request):
    try:
        target_user = get_target_user(request)

        data = json.loads(request.body)
        event_id = data.get('id')  # ← ловим id, если редактирование

        date_str = data['date']
        time_str = data['time']
        text = data.get('text', '')
        color = data.get('color', '')
        is_recurring = data.get('is_recurring', False)
        duration = data.get('duration', 1.0)

        from datetime import datetime
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
            return JsonResponse({'status': 'error', 'message': 'Неверный формат времени'})

        # ПРОВЕРКА ДУБЛИКАТА
        existing_event = ScheduleEvent.objects.filter(
            user=target_user,
            date=date_obj,
            time=time_obj
        ).first()

        if existing_event and not event_id:  # Только для создания нового
            return JsonResponse({
                'status': 'error',
                'message': 'Событие в это время уже существует'
            })

        # --- Если есть id → обновляем существующее событие
        if event_id:
            try:
                event = ScheduleEvent.objects.get(id=event_id, user=target_user)

                # Если событие становится регулярным (было нерегулярным, стало регулярным)
                if not event.is_recurring and is_recurring:
                    # Создаем новую серию
                    import uuid
                    series = uuid.uuid4()

                    # Обновляем текущее событие с новыми данными
                    event.date = date_obj  # ← обновляем дату
                    event.time = time_obj  # ← обновляем время
                    event.text = text
                    event.color = color
                    event.is_recurring = is_recurring
                    event.duration = duration
                    event.series_id = series
                    event.save()

                    from datetime import timedelta

                    # Создаем будущие события
                    create_recurring_events(
                        target_user,
                        date_obj + timedelta(weeks=1),  # ← используем новую дату
                        time_obj,  # ← используем новое время
                        text,
                        color,
                        duration,
                        series,
                    )

                # Если это уже регулярное событие и изменились параметры
                elif event.is_recurring and is_recurring:
                    # Обновляем всю серию
                    series_id = event.series_id

                    # Обновляем все события этой серии
                    events_to_update = ScheduleEvent.objects.filter(
                        user=target_user,
                        series_id=series_id
                    )

                    for ev in events_to_update:
                        ev.text = text
                        ev.color = color
                        ev.duration = duration
                        # Если изменилось время, обновляем время для всех событий
                        if str(ev.time) != time_str:
                            ev.time = time_obj
                        ev.save()

                # Если регулярное событие становится нерегулярным
                elif event.is_recurring and not is_recurring:
                    import uuid
                    from datetime import timedelta

                    # Сохраняем исходные данные старой серии
                    original_time = event.time
                    original_text = event.text
                    original_color = event.color
                    original_duration = event.duration

                    # 1. Удаляем все будущие события старой серии (но НЕ трогаем текущее)
                    ScheduleEvent.objects.filter(
                        user=target_user,
                        series_id=event.series_id,
                        date__gt=date_obj
                    ).delete()



                    # 2. Создаем новую серию регулярных событий с теми же параметрами
                    new_series_id = uuid.uuid4()
                    new_start_date = date_obj

                    # Проверяем, что на new_start_date в это время нет других событий
                    while ScheduleEvent.objects.filter(
                            user=target_user,
                            date=new_start_date,
                            time=original_time
                    ).exists():
                        new_start_date += timedelta(weeks=1)

                    # Создаем новую серию, если дата не ушла слишком далеко
                    if new_start_date <= date_obj + timedelta(weeks=52):
                        create_recurring_events(
                            target_user,
                            new_start_date,
                            original_time,
                            original_text,
                            original_color,
                            original_duration,
                            new_series_id,
                            weeks_ahead=52
                        )

                    # 3. Обновляем текущее событие → превращаем в одиночное
                    event.text = text
                    event.color = color
                    event.is_recurring = False
                    event.duration = duration
                    event.series_id = uuid.uuid4()  # уникальный ID для одиночного события
                    event.save()

                else:
                    # Обновляем только одно нерегулярное событие
                    event.date = date_obj
                    event.time = time_obj
                    event.text = text
                    event.color = color
                    event.is_recurring = is_recurring
                    event.duration = duration
                    event.save()

                created = False

            except ScheduleEvent.DoesNotExist:
                return JsonResponse({'status': 'error', 'message': 'Событие не найдено'})
        else:
            # --- Если id нет → создаём новое событие
            import uuid
            series = uuid.uuid4()
            event = ScheduleEvent.objects.create(
                user=target_user,
                date=date_obj,
                time=time_obj,
                text=text,
                color=color,
                is_recurring=is_recurring,
                duration=duration,
                series_id=series
            )
            created = True
            # Если это регулярное занятие — создаём будущие
            if is_recurring:
                create_recurring_events(
                    target_user,
                    date_obj,
                    time_obj,
                    text,
                    color,
                    duration,
                    series,
                )

        return JsonResponse({'status': 'success', 'created': created, 'id': event.id})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


def create_recurring_events(user, start_date, time, text, color, duration=1.0, series=None, weeks_ahead=52):
    """Создает регулярные события на год вперед"""
    from datetime import timedelta
    try:
        for week in range(0, weeks_ahead + 1):
            event_date = start_date + timedelta(weeks=week)

            if ScheduleEvent.objects.filter(user=user, date=event_date, time=time).exists():
                continue

            ScheduleEvent.objects.create(
                user=user,
                date=event_date,
                time=time,
                text=text,
                color=color,
                is_recurring=True,
                duration=duration,
                series_id=series
            )
    except Exception as e:
        print(f"[ERROR] in create_recurring_events: {str(e)}")
        raise e

@csrf_exempt
@login_required
def load_events(request):
    try:
        target_user = get_target_user(request)

        date_from=request.GET.get('date_from')
        date_to=request.GET.get('date_to')

        from datetime import datetime
        date_from_obj=datetime.strptime(date_from,'%Y-%m-%d').date()
        date_to_obj=datetime.strptime(date_to,'%Y-%m-%d').date()

        events=ScheduleEvent.objects.filter(
            user=target_user,
            date__range=[date_from_obj,date_to_obj]
        )

        events_data=[]
        for event in events:
            time_str = event.time.strftime('%H:%M')

            events_data.append({
                'id': event.id,
                'date':event.date.strftime('%Y-%m-%d'),
                'time':time_str,
                'text': event.text,
                'color': event.color,
                'is_recurring': event.is_recurring,
                'duration': float(event.duration)
            })
        return  JsonResponse({'status': 'success', 'events': events_data})

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@csrf_exempt
@require_POST
@login_required
def delete_event(request):
    try:
        target_user = get_target_user(request)

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
