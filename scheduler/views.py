import json

from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from django.http import JsonResponse

from .models import ScheduleEvent

from django.shortcuts import render, redirect
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import login
@csrf_exempt
@require_POST
@login_required
def save_event(request):
    try:
        data = json.loads(request.body)
        date_str=data['date']
        time_str=data['time']
        text=data.get('text','')
        color=data.get('color','')
        is_recurring = data.get('is_recurring', False)
        duration = data.get('duration', 1.0)  # Новое поле

        from datetime import datetime
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        time_obj = datetime.strptime(time_str, '%H').time()

        import uuid
        # создаём уникальный идентификатор серии
        series = uuid.uuid4()


        event,created=ScheduleEvent.objects.update_or_create(
            user=request.user,
            date=date_obj,
            time=time_obj,
            defaults={'text': text, 'color': color, 'is_recurring': is_recurring, 'duration': duration, 'series_id': series}
        )

        # Если это регулярное занятие, создаем события на будущие недели
        if is_recurring:
            create_recurring_events(request.user, date_obj, time_obj, text, color,duration,series)
        return JsonResponse({'status': 'success', 'created': created})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


def create_recurring_events(user, start_date, time, text, color, duration=1.0, series=None, weeks_ahead=52):
    """Создает регулярные события на год вперед"""
    from datetime import timedelta
    try:
        for week in range(1, weeks_ahead + 1):
            event_date = start_date + timedelta(weeks=week)

            # Используем get_or_create сначала, чтобы избежать ошибки уникальности
            event, created = ScheduleEvent.objects.get_or_create(
                user=user,
                date=event_date,
                time=time,
                defaults={
                    'text': text,
                    'color': color,
                    'is_recurring': True,
                    'duration': duration,
                    'series_id':series
                }
            )

            # Если событие уже существует, обновляем его
            if not created:
                event.text = text
                event.color = color
                event.is_recurring = True
                event.duration = duration
                event.series_id=series
                event.save()
        print(f"Created/updated recurring events for {weeks_ahead} weeks")
    except Exception as e:
        print(f"Error in create_recurring_events: {str(e)}")
        raise e

@csrf_exempt
@login_required
def load_events(request):
    try:
        date_from=request.GET.get('date_from')
        date_to=request.GET.get('date_to')

        from datetime import datetime
        date_from_obj=datetime.strptime(date_from,'%Y-%m-%d').date()
        date_to_obj=datetime.strptime(date_to,'%Y-%m-%d').date()

        events=ScheduleEvent.objects.filter(
            user=request.user,
            date__range=[date_from_obj,date_to_obj]
        )

        events_data=[]
        for event in events:
            time_str = str(event.time.hour)  # "1" вместо "01"

            events_data.append({
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
        data = json.loads(request.body)
        date_str = data.get('date')
        time_str = data.get('time')
        delete_recurring = data.get('delete_recurring', False)

        from datetime import datetime

        # Парсим дату
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()

        # Гибкий парсер времени: поддерживаем '%H:%M:%S', '%H:%M', '%H'
        time_obj = None
        for fmt in ('%H:%M:%S', '%H:%M', '%H'):
            try:
                time_obj = datetime.strptime(time_str, fmt).time()
                break
            except Exception:
                continue
        if time_obj is None:
            # как запасной вариант — попробовать считать просто час
            try:
                hour = int(time_str)
                time_obj = datetime.strptime(f'{hour:02}:00:00', '%H:%M:%S').time()
            except Exception:
                raise ValueError('Неверный формат времени')

        # ищем конкретное событие
        event = ScheduleEvent.objects.get(
            user=request.user,
            date=date_obj,
            time=time_obj
        )

        if delete_recurring:
            # Удаляем все регулярные занятия
            ScheduleEvent.objects.filter(
                user=request.user,
                series_id=event.series_id,
            ).delete()
        else:
            event.delete()
        return JsonResponse({'status': 'success', 'message': 'Событие удалено'})
    except ScheduleEvent.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Событие не найдено'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})

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
