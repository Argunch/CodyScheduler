from django.contrib.auth.models import User
from .models import ScheduleEvent
from datetime import datetime, timedelta
import uuid

class EventManager:
    def __init__(self, request):
        self.request = request
        self.request_user = request.user
        self.target_user = self._get_target_user()

    def save_event(self, data):
        """Основной метод сохранения/обновления события"""
        # 1. Парсим данные
        parsed_data = self.parse_event_data(data)
        
        # 2. Получаем ID события
        event_id = data.get('id')
        
        # 3. Валидация
        if event_id:
            self.validate_event_update(
                event_id,
                parsed_data['date_obj'], 
                parsed_data['time_obj']
            )
        else:
            self.validate_event_creation(
                parsed_data['date_obj'], 
                parsed_data['time_obj']
            )
        # 4. Обработка
        if event_id:
            return self._update_existing_event(event_id, parsed_data)
        else:
            return self._create_new_event(parsed_data)
    
    def validate_event_creation(self, date_obj, time_obj):
        """Валидация при создании нового события"""
        if self.check_duplicate(date_obj, time_obj):
            raise ValueError('Событие в это время уже существует')
    def validate_event_update(self, event_id, date_obj, time_obj):
        """Валидация при обновлении существующего события"""
        if self.check_duplicate(date_obj, time_obj, exclude_id=event_id):
            raise ValueError('Событие в это время уже существует')
        
    def check_duplicate(self, date_obj, time_obj, exclude_id=None):
        """
        Проверяет, существует ли уже событие в указанное время.
        
        Args:
            date_obj: Дата события
            time_obj: Время события
            exclude_id: ID события, которое нужно исключить из проверки (для редактирования)
        
        Returns:
            ScheduleEvent или None: Существующее событие или None, если дубликата нет
        """     
        # Базовый запрос
        qs = ScheduleEvent.objects.filter(
            user=self.target_user,
            date=date_obj,
            time=time_obj
        )
        
        # Исключаем событие при редактировании
        if exclude_id:
            qs = qs.exclude(id=exclude_id)
        
        # Возвращаем первое найденное событие или None
        return qs.first()

    def _update_existing_event(self, event_id, parsed_data):
        """Обновление существующего события"""
        
        event = ScheduleEvent.objects.get(id=event_id, user=self.target_user)
        self._check_permissions(event)
        
        # Определяем тип обновления
        if not event.is_recurring and parsed_data['is_recurring']:
            event = self._convert_to_recurring(event, parsed_data)
        elif event.is_recurring and parsed_data['is_recurring']:
            event = self._update_recurring_series(event, parsed_data)
        elif event.is_recurring and not parsed_data['is_recurring']:
            event = self._convert_recurring_to_single(event, parsed_data)
        else:
            event = self._update_single_event(event, parsed_data)
        
        return {'status': 'success', 'created': False, 'id': event.id}
    
    def _convert_to_recurring(self,event,parsed_data):
        # Создаем новую серию
        series = uuid.uuid4()

        # Обновляем текущее событие с новыми данными
        event.date = parsed_data['date_obj']
        event.time = parsed_data['time_obj']
        event.text = parsed_data['text']
        event.color = parsed_data['color']
        event.is_recurring = True
        event.duration = parsed_data['duration']
        event.series_id = series
        event.save()

        # Создаем будущие события
        self._create_future_recurring_events(
            start_date=parsed_data['date_obj'] + timedelta(weeks=1),  # ← используем новую дату
            time=parsed_data['time_obj'],  # ← используем новое время
            text=parsed_data['text'],
            color=parsed_data['color'],
            duration=parsed_data['duration'],
            series=series,
            weeks_ahead=51
        )

        return event


    def _update_recurring_series(self,event,parsed_data):
        # Обновляем всю серию
        series_id = event.series_id

        # Обновляем все события этой серии
        events_to_update = ScheduleEvent.objects.filter(
            user=self.target_user,
            series_id=series_id
        )

        for ev in events_to_update:
            ev.text = parsed_data['text']
            ev.color = parsed_data['color']
            ev.duration = parsed_data['duration']
            # Если изменилось время, обновляем время для всех событий
            if str(ev.time) != parsed_data['time_str']:
                ev.time = parsed_data['time_obj']
            ev.save()
        return event

    def _convert_recurring_to_single(self,event,parsed_data):
        # Сохраняем исходные данные старой серии
        original_time = event.time
        original_text = event.text
        original_color = event.color
        original_duration = event.duration

        # 1. Удаляем все будущие события старой серии (но НЕ трогаем текущее)
        ScheduleEvent.objects.filter(
            user=self.target_user,
            series_id=event.series_id,
            date__gt=parsed_data['date_obj']
        ).delete()



        # 2. Создаем новую серию регулярных событий с теми же параметрами
        new_series_id = uuid.uuid4()
        new_start_date = parsed_data['date_obj']

        # Проверяем, что на new_start_date в это время нет других событий
        while ScheduleEvent.objects.filter(
                user=self.target_user,
                date=new_start_date,
                time=original_time
        ).exists():
            new_start_date += timedelta(weeks=1)

        # Создаем новую серию, если дата не ушла слишком далеко
        if new_start_date <= parsed_data['date_obj'] + timedelta(weeks=52):
            self._create_future_recurring_events(
                new_start_date,
                original_time,
                original_text,
                original_color,
                original_duration,
                new_series_id,
                weeks_ahead=52
            )

        # 3. Обновляем текущее событие → превращаем в одиночное
        event.text = parsed_data['text']
        event.color = parsed_data['color']
        event.is_recurring = False
        event.duration = parsed_data['duration']
        event.save()

        return event

    def _update_single_event(self,event,parsed_data):
        # Обновляем только одно нерегулярное событие
        event.date = parsed_data['date_obj']
        event.time = parsed_data['time_obj']
        event.text = parsed_data['text']
        event.color = parsed_data['color']
        event.is_recurring = False
        event.duration = parsed_data['duration']
        event.save()

        return event
    
    def _get_target_user(self):
        """Внутренний метод для получения целевого пользователя"""
        target_user_id = self.request.session.get('target_user_id')
        if target_user_id and self.request.user.is_superuser:
            try:
                return User.objects.get(id=target_user_id)
            except User.DoesNotExist:
                pass
        return self.request.user

    def _create_new_event(self, parsed_data):
        """Создание нового события"""
        if not parsed_data['is_recurring']:
            event = self.create_single_event(parsed_data)
            return {'status': 'success', 'created': True, 'id': event.id}
        else:
            event, series_id = self.create_recurring_events(parsed_data)
            return {
                'status': 'success', 
                'created': True, 
                'id': event.id, 
                'series_id': str(series_id)
            }
    
    def create_single_event(self, parsed_data):
        """Создание разового события"""
        return ScheduleEvent.objects.create(
            user=self.target_user,
            date=parsed_data['date_obj'],
            time=parsed_data['time_obj'],
            text=parsed_data['text'],
            color=parsed_data['color'],
            is_recurring=False,
            duration=parsed_data['duration'],
            created_by=self.request_user
        )
    
    def create_recurring_events(self, parsed_data):
        """Создание серии регулярных событий"""
        series = uuid.uuid4()
        
        # Создаем первое событие
        first_event = ScheduleEvent.objects.create(
            user=self.target_user,
            date=parsed_data['date_obj'],
            time=parsed_data['time_obj'],
            text=parsed_data['text'],
            color=parsed_data['color'],
            is_recurring=True,
            duration=parsed_data['duration'],
            series_id=series,
            created_by=self.request_user
        )
        
        # Создаем будущие события (начиная со следующей недели)
        self._create_future_recurring_events(
            start_date=parsed_data['date_obj'] + timedelta(weeks=1),
            time=parsed_data['time_obj'],
            text=parsed_data['text'],
            color=parsed_data['color'],
            duration=parsed_data['duration'],
            series=series,
            weeks_ahead=51  # чтобы всего было 52 недели
        )
        
        return first_event, series
    
    def _create_future_recurring_events(self, start_date, time, text, color, duration=1.0, series=None, weeks_ahead=52):
        """Создает регулярные события на год вперед"""
        try:
            for week in range(0, weeks_ahead + 1):
                event_date = start_date + timedelta(weeks=week)

                if ScheduleEvent.objects.filter(user=self.target_user, date=event_date, time=time).exists():
                    continue

                ScheduleEvent.objects.create(
                    user=self.target_user,
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
        
    def parse_event_data(self, data):
        
        date_str = data['date']
        time_str = data['time']
        
        # Парсим дату
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        # Парсим время
        time_obj = None
        time_formats = ['%H:%M:%S', '%H:%M', '%H']
        for fmt in time_formats:
            try:
                time_obj = datetime.strptime(time_str, fmt).time()
                break
            except ValueError:
                continue
        
        if time_obj is None:
            raise ValueError('Неверный формат времени')
        
        return {
            'date_obj': date_obj,
            'time_obj': time_obj,
            'text': data.get('text', ''),
            'color': data.get('color', ''),
            'is_recurring': data.get('is_recurring', False),
            'duration': data.get('duration', 1.0),
            'time_str': time_str  # сохраняем для сравнения
        }
    
    def _check_permissions(self, event):
        """Проверка прав доступа"""
        if not self.request_user.is_superuser and event.created_by != self.request_user:
            raise PermissionError('Недостаточно прав для редактирования этого события')