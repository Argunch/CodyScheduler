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

        # ДОБАВЛЕНО: если есть ученики — курс обязателен
        student_ids = parsed_data.get('student_ids') or []
        if student_ids and not parsed_data.get('course_id'):
            raise ValueError('Для занятия с учениками нужен курс')
        
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
        
        return {
            'status': 'success',
            'created': False,
            'id': event.id,
            'course_id': event.course_id,                                    # ДОБАВЛЕНО
            'course_name': event.course.name if event.course else '',         # ДОБАВЛЕНО
            'student_ids': list(event.students.values_list('id', flat=True)),   # NEW
            'students': [                                                       # NEW
                {'id': s.id, 'full_name': str(s)} for s in event.students.all()
            ],
        }
    
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

        # NEW: обновляем учеников у текущего события
        if parsed_data['student_ids'] is not None:
            event.students.set(parsed_data['student_ids'])

        if parsed_data.get('course_id') is not None:                                 # ДОБАВЛЕНО
            event.course_id = parsed_data['course_id'] or None                       # ДОБАВЛЕНО

        # Создаем будущие события
        self._create_future_recurring_events(
            start_date=parsed_data['date_obj'] + timedelta(weeks=1),  # ← используем новую дату
            time=parsed_data['time_obj'],  # ← используем новое время
            text=parsed_data['text'],
            color=parsed_data['color'],
            duration=parsed_data['duration'],
            series=series,
            weeks_ahead=51,
            student_ids=parsed_data['student_ids'],
        )

        return event


    def _update_recurring_series(self,event,parsed_data):
        # Обновляем всю серию
        series_id = event.series_id

        # Обновляем все события этой серии
        events_to_update = ScheduleEvent.objects.filter(
            user=self.target_user,
            series_id=series_id,
            date__gte=event.date,   # ← только текущее и будущие
        )

        for ev in events_to_update:
            ev.text = parsed_data['text']
            ev.color = parsed_data['color']
            ev.duration = parsed_data['duration']
            # Если изменилось время, обновляем время для всех событий
            if str(ev.time) != parsed_data['time_str']:
                ev.time = parsed_data['time_obj']
            ev.save()

            # NEW: обновляем учеников у каждого события серии
            if parsed_data['student_ids'] is not None:
                old_ids = set(ev.students.values_list('id', flat=True))    # ДОБАВЛЕНО
                ev.students.set(parsed_data['student_ids'])
                self._resync_event_students(ev, old_ids)                    # ДОБАВЛЕНО

            if parsed_data.get('course_id') is not None:                                 # ДОБАВЛЕНО
                event.course_id = parsed_data['course_id'] or None                       # ДОБАВЛЕНО

        return event

    def _convert_recurring_to_single(self,event,parsed_data):
        # Сохраняем исходные данные старой серии
        original_time = event.time
        original_text = event.text
        original_color = event.color
        original_duration = event.duration
         # NEW: запоминаем старых учеников — они останутся у новой серии
        original_student_ids = list(event.students.values_list('id', flat=True))

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
                weeks_ahead=52,
                student_ids=original_student_ids,   # NEW
            )

        # 3. Обновляем текущее событие → превращаем в одиночное
        event.text = parsed_data['text']
        event.color = parsed_data['color']
        event.is_recurring = False
        event.duration = parsed_data['duration']
        event.save()

        # NEW: обновляем учеников у текущего события
        if parsed_data['student_ids'] is not None:
            event.students.set(parsed_data['student_ids'])

        if parsed_data.get('course_id') is not None:                                 # ДОБАВЛЕНО
            event.course_id = parsed_data['course_id'] or None                       # ДОБАВЛЕНО

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

        # NEW: если фронт передал student_ids
        if parsed_data['student_ids'] is not None:
            # Запоминаем старый состав до изменения
            old_ids = set(event.students.values_list('id', flat=True))
            event.students.set(parsed_data['student_ids'])
            # Полный ре-синк
            self._resync_event_students(event, old_ids)

        if parsed_data.get('course_id') is not None:                                 # ДОБАВЛЕНО
            event.course_id = parsed_data['course_id'] or None                       # ДОБАВЛЕНО

        # ДОБАВЛЕНО: если пришёл completion_status — обновляем и синхронизируем списание
        new_completion = parsed_data.get('completion_status')
        if new_completion is not None and new_completion != event.completion_status:
            from django.utils import timezone
            event.completion_status = new_completion
            if new_completion:
                event.completed_at = timezone.now()
            else:
                event.completed_at = None
            event.save(update_fields=['completion_status', 'completed_at'])

            # Синхронизируем charge для каждого ученика (для индов — один)
            for student in event.students.all():
                self._sync_charge_for_event(event, student)

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
            return {
                'status': 'success',
                'created': True,
                'id': event.id,
                'course_id': event.course_id,                                    # ДОБАВЛЕНО
                'course_name': event.course.name if event.course else '',         # ДОБАВЛЕНО
                'student_ids': list(event.students.values_list('id', flat=True)),
                'students': [
                    {'id': s.id, 'full_name': str(s)} for s in event.students.all()
                ],
            }
        else:
            event, series_id = self.create_recurring_events(parsed_data)
            return {
                'status': 'success',
                'created': True,
                'id': event.id,
                'series_id': str(series_id),
                'course_id': event.course_id,                                    # ДОБАВЛЕНО
                'course_name': event.course.name if event.course else '',         # ДОБАВЛЕНО
                'student_ids': list(event.students.values_list('id', flat=True)),
                'students': [
                    {'id': s.id, 'full_name': str(s)} for s in event.students.all()
                ],
            }
    
    def create_single_event(self, parsed_data):
        """Создание разового события"""
        event=ScheduleEvent.objects.create(
            user=self.target_user,
            date=parsed_data['date_obj'],
            time=parsed_data['time_obj'],
            text=parsed_data['text'],
            color=parsed_data['color'],
            is_recurring=False,
            duration=parsed_data['duration'],
            course_id=parsed_data.get('course_id') or None,   # ДОБАВЛЕНО
            created_by=self.request_user
        )
        # NEW: привязываем учеников (если переданы)
        if parsed_data['student_ids']:
            event.students.set(parsed_data['student_ids'])
        return event
    
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
            course_id=parsed_data.get('course_id') or None,   # ДОБАВЛЕНО
            created_by=self.request_user
        )

         # NEW: привязываем к первому событию
        if parsed_data['student_ids']:
            first_event.students.set(parsed_data['student_ids'])
        
        # Создаем будущие события (начиная со следующей недели)
        self._create_future_recurring_events(
            start_date=parsed_data['date_obj'] + timedelta(weeks=1),
            time=parsed_data['time_obj'],
            text=parsed_data['text'],
            color=parsed_data['color'],
            duration=parsed_data['duration'],
            series=series,
            weeks_ahead=51,  # чтобы всего было 52 недели
            student_ids=parsed_data['student_ids'],   # NEW
            course_id=parsed_data.get('course_id') or None,   # ДОБАВЛЕНО
        )
        
        return first_event, series
    
    def _create_future_recurring_events(self, start_date, time, text, color, duration=1.0, series=None, weeks_ahead=52, student_ids=None,course_id=None):
        """Создает регулярные события на год вперед"""
        try:
            for week in range(0, weeks_ahead + 1):
                event_date = start_date + timedelta(weeks=week)

                if ScheduleEvent.objects.filter(user=self.target_user, date=event_date, time=time).exists():
                    continue

                ev=ScheduleEvent.objects.create(
                    user=self.target_user,
                    date=event_date,
                    time=time,
                    text=text,
                    color=color,
                    is_recurring=True,
                    duration=duration,
                    series_id=series,
                    course_id=course_id
                )
                # NEW: привязываем учеников к каждому событию серии
                if student_ids:
                    ev.students.set(student_ids)
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
            'time_str': time_str,  # сохраняем для сравнения
            'student_ids': data.get('student_ids', None),   # NEW: None = не трогать
            'course_id': data.get('course_id'),   # ДОБАВЛЕНО
            'completion_status': data.get('completion_status'),    # ДОБАВЛЕНО
        }

    # def _sync_charge_for_event(self, event, student):
    #     """
    #     Синхронизирует списание (BalanceOperation type=charge) для события и ученика.
    #     - Если статус события = passed и есть курс с ценой — создаёт или обновляет списание.
    #     - Если статус не passed — удаляет существующее списание.
    #     """
    #     from .models import StudentCoursePrice, BalanceOperation

    #     # Удаляем предыдущее списание по этому событию и ученику (если было)
    #     BalanceOperation.objects.filter(
    #         event=event,
    #         student=student,
    #         operation_type=BalanceOperation.TYPE_CHARGE,
    #     ).delete()

    #     # ИЗМЕНЕНО: списываем при passed или missed_student
    #     chargeable = (
    #         event.completion_status == ScheduleEvent.COMPLETION_PASSED
    #         or event.completion_status == ScheduleEvent.COMPLETION_MISSED_STUDENT
    #     )
    #     if not chargeable:
    #         return

    #     # Нет курса — списывать нечего
    #     if not event.course_id:
    #         print(f'[charge] У события {event.id} нет курса — списание не создано')
    #         return

    #     # Нет цены для пары (ученик, курс) — списывать нечего
    #     price_obj = StudentCoursePrice.objects.filter(
    #         student=student,
    #         course_id=event.course_id,
    #     ).first()
    #     if not price_obj or price_obj.price_per_lesson <= 0:
    #         print(f'[charge] У ученика {student.id} нет цены на курс {event.course_id} — списание не создано')
    #         return

    #     # Создаём списание
    #     BalanceOperation.objects.create(
    #         student=student,
    #         course_id=event.course_id,
    #         amount=-price_obj.price_per_lesson,       # отрицательное!
    #         operation_type=BalanceOperation.TYPE_CHARGE,
    #         operation_date=event.date,
    #         event=event,
    #         created_by=self.request_user,
    #     )
    #     print(f'[charge] Списано {price_obj.price_per_lesson}₽ с {student} за событие {event.id}')
    

    def _sync_charge_for_event(self, event, student, was_present=None):
        """
        Синхронизирует списание (BalanceOperation type=charge) для события и ученика.

        Правила:
        - Индивидуальное: списываем при passed или missed_student.
        - Групповое: списываем, если ученик был ИЛИ у него есть остаток оплаченных занятий.
          (не списываем только если ученик отсутствовал И на балансе пусто)
        """
        from .models import StudentCoursePrice, BalanceOperation

        # 1. Удаляем предыдущее списание по этому событию и ученику
        BalanceOperation.objects.filter(
            event=event,
            student=student,
            operation_type=BalanceOperation.TYPE_CHARGE,
        ).delete()

        # 2. Определяем, надо ли списывать
        should_charge = False

        if event.status == ScheduleEvent.STATUS_INDIVIDUAL:
            should_charge = event.completion_status in (
                ScheduleEvent.COMPLETION_PASSED,
                ScheduleEvent.COMPLETION_MISSED_STUDENT,
            )
        elif event.status == ScheduleEvent.STATUS_GROUP:
            # ИЗМЕНЕНО: новая логика для групповых
            if was_present:
                should_charge = True
            else:
                remaining = student.get_remaining_lessons(event.course)
                should_charge = (remaining is not None and remaining > 0)

        if not should_charge:
            return

        # 3. Проверяем курс и цену
        if not event.course_id:
            print(f'[charge] У события {event.id} нет курса — списание не создано')
            return

        price_obj = StudentCoursePrice.objects.filter(
            student=student,
            course_id=event.course_id,
        ).first()
        if not price_obj or price_obj.price_per_lesson <= 0:
            print(f'[charge] У ученика {student.id} нет цены на курс {event.course_id} — списание не создано')
            return

        # 4. Создаём списание
        BalanceOperation.objects.create(
            student=student,
            course_id=event.course_id,
            amount=-price_obj.price_per_lesson,
            operation_type=BalanceOperation.TYPE_CHARGE,
            operation_date=event.date,
            event=event,
            created_by=self.request_user,
        )
        print(f'[charge] Списано {price_obj.price_per_lesson}₽ с {student} за событие {event.id}')

    def _check_permissions(self, event):
        """Проверка прав доступа"""
        if not self.request_user.is_superuser and event.created_by != self.request_user:
            raise PermissionError('Недостаточно прав для редактирования этого события')

    def load_unmarked_events(self):
        """
        Возвращает список непроверенных занятий (инд. и групповых)
        за последние 7 дней, которые уже закончились.
        """
        from django.utils import timezone

        now = timezone.localtime()
        week_ago = now - timedelta(days=7)

        qs = ScheduleEvent.objects.filter(
            user=self.target_user,
            status__in=[
                ScheduleEvent.STATUS_INDIVIDUAL,
                ScheduleEvent.STATUS_GROUP,
            ],
            completion_status='',
            date__gte=week_ago.date(),
        ).prefetch_related('students').order_by('date', 'time')

        result = []
        for event in qs:
            if not event.is_finished(now=now):
                continue

            # Текущие отметки (если есть) — чтобы фронт мог их предзаполнить
            existing = {
                a.student_id: a.was_present
                for a in event.attendances.all()
            }

            result.append({
                'id': event.id,
                'status': event.status,   # 'individual' / 'group'
                'date': event.date.strftime('%Y-%m-%d'),
                'time': event.time.strftime('%H:%M'),
                'text': event.text or 'Без названия',
                'duration': float(event.duration),
                'student_ids': list(event.students.values_list('id', flat=True)),
                'students': [
                    {
                        'id': s.id,
                        'full_name': str(s),
                        'was_present': existing.get(s.id),  # None или bool
                        'remaining_lessons': s.get_remaining_lessons(event.course), 
                    }
                    for s in event.students.all()
                ],
            })

        return result

    def mark_event(self, event_id, completion_status=None, attendances=None):
        """
        Ставит отметку проведения на занятие.
        - Для индивидуальных: completion_status обязателен, Attendance создаётся автоматически.
        - Для групповых: attendances — массив [{student_id, was_present}],
          completion_status вычисляется автоматически.
        """
        from django.utils import timezone
        from .models import Attendance

        try:
            if self.request_user.is_superuser:
                # Суперюзер может отмечать любое событие (включая чужие расписания)
                event = ScheduleEvent.objects.get(id=event_id)
            else:
                event = ScheduleEvent.objects.get(id=event_id, user=self.target_user)
        except ScheduleEvent.DoesNotExist:
            raise ScheduleEvent.DoesNotExist('Событие не найдено')

        now = timezone.now()

        # ─── ГРУППОВОЕ ────────────────────────────────
        if event.status == ScheduleEvent.STATUS_GROUP:
            if not attendances:
                raise ValueError('Для группового занятия нужен список посещений')

            # Проверяем, что все student_id принадлежат этому событию
            valid_ids = set(event.students.values_list('id', flat=True))
            incoming_ids = {int(a['student_id']) for a in attendances}
            unknown = incoming_ids - valid_ids
            if unknown:
                raise ValueError(f'Ученики не привязаны к занятию: {unknown}')

            # Обновляем/создаём Attendance для каждого ученика
            for att in attendances:
                Attendance.objects.update_or_create(
                    event=event,
                    student_id=int(att['student_id']),
                    defaults={'was_present': bool(att['was_present'])},
                )

            # Автоматически вычисляем статус
            was_any = any(bool(a['was_present']) for a in attendances)
            event.completion_status = (
                ScheduleEvent.COMPLETION_PASSED if was_any
                else ScheduleEvent.COMPLETION_NOT_CONDUCTED
            )
            event.completed_at = now
            event.save(update_fields=['completion_status', 'completed_at'])

            # ИЗМЕНЕНО: формируем карту «кто был»
            attendance_map = {int(a['student_id']): bool(a['was_present']) for a in attendances}

            # ИЗМЕНЕНО: передаём was_present для каждого ученика
            for stu in event.students.all():
                was_present = attendance_map.get(stu.id, False)
                self._sync_charge_for_event(event, stu, was_present=was_present) 


            return {
                'id': event.id,
                'completion_status': event.completion_status,
                'completed_at': event.completed_at.isoformat(),
            }

        # ─── ИНДИВИДУАЛЬНОЕ ──────────────────────────
        if event.status == ScheduleEvent.STATUS_INDIVIDUAL:
            allowed = {c[0] for c in ScheduleEvent.COMPLETION_CHOICES}
            if completion_status not in allowed:
                raise ValueError(f'Недопустимый статус: {completion_status}')

            event.completion_status = completion_status
            event.completed_at = now
            event.save(update_fields=['completion_status', 'completed_at'])

            # Автоматически создаём Attendance для единственного ученика
            was_present = (completion_status == ScheduleEvent.COMPLETION_PASSED)
            student = event.students.first()
            if student:
                Attendance.objects.update_or_create(
                    event=event,
                    student=student,
                    defaults={'was_present': was_present},
                )

            # Автоматически создаём Attendance
            was_present = (completion_status == ScheduleEvent.COMPLETION_PASSED)
            student = event.students.first()
            if student:
                Attendance.objects.update_or_create(
                    event=event,
                    student=student,
                    defaults={'was_present': was_present},
                )

            # ДОБАВЛЕНО: списание за занятие, если статус = passed
            self._sync_charge_for_event(event, student)

            return {
                'id': event.id,
                'completion_status': event.completion_status,
                'completed_at': event.completed_at.isoformat(),
            }

        # ─── ЗАМЕТКА (не должна сюда попадать) ──────
        raise ValueError('Нельзя отметить заметку — только занятие')

    def _resync_event_students(self, event, old_student_ids):
        """
        Полный ре-синк состава учеников события.

        old_student_ids — set ID учеников ДО изменения состава.
        После вызова:
        - У удалённых учеников удаляются Attendance и charge.
        - У текущих учеников Attendance и charge пересоздаются
          на основе текущего completion_status события.
        """
        from .models import Attendance, BalanceOperation

        current_ids = set(event.students.values_list('id', flat=True))
        removed_ids = old_student_ids - current_ids

        # 1. Удаляем следы у тех, кого убрали
        if removed_ids:
            BalanceOperation.objects.filter(
                event=event,
                student_id__in=removed_ids,
                operation_type=BalanceOperation.TYPE_CHARGE,
            ).delete()
            # Attendance удалится сигналом m2m_changed, но подстрахуемся
            Attendance.objects.filter(
                event=event,
                student_id__in=removed_ids,
            ).delete()

        # 2. Синхронизируем всех текущих
        for student in event.students.all():
            # Определяем was_present по статусу события
            was_present = None
            if event.completion_status == ScheduleEvent.COMPLETION_PASSED:
                was_present = True
            elif event.completion_status == ScheduleEvent.COMPLETION_NOT_CONDUCTED:
                was_present = False

            # Если событие отмечено — обновляем Attendance и charge
            if event.completion_status:
                Attendance.objects.update_or_create(
                    event=event,
                    student=student,
                    defaults={'was_present': was_present if was_present is not None else False},
                )
                self._sync_charge_for_event(event, student, was_present=was_present)
            else:
                # Неотмеченное — просто удаляем старый charge, если был
                BalanceOperation.objects.filter(
                    event=event,
                    student=student,
                    operation_type=BalanceOperation.TYPE_CHARGE,
                ).delete()

