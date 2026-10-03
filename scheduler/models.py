from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import m2m_changed, pre_delete
from django.dispatch import receiver

from datetime import datetime, timedelta
from django.utils import timezone

class Course(models.Model):
    """Курс, который ведёт преподаватель (Roblox, Unity и т.д.)."""
    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name='Название'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='courses',
        verbose_name='Создатель'
    )
    is_archived = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name='В архиве'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Курс'
        verbose_name_plural = 'Курсы'
        ordering = ['name']

    def __str__(self):
        return self.name




class Student(models.Model):
    first_name = models.CharField(max_length=100, verbose_name="Имя")
    last_name = models.CharField(max_length=100, verbose_name="Фамилия")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name="Создатель")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    birth_date = models.DateField(
        null=True, blank=True,
        verbose_name='Дата рождения'
    )
    parent_name = models.CharField(
        max_length=200, blank=True,
        verbose_name='ФИО родителя'
    )
    parent_phone = models.CharField(
        max_length=50, blank=True,
        verbose_name='Телефон родителя'
    )
    extra_info = models.TextField(
        blank=True,
        verbose_name='Дополнительная информация'
    )

    def get_remaining_lessons(self, course):
        """
        Возвращает количество оставшихся оплаченных занятий по курсу.
        None — если цена не задана.
        """
        from django.db.models import Sum

        if course is None:
            return None

        price_obj = StudentCoursePrice.objects.filter(student=self, course=course).first()
        if not price_obj or price_obj.price_per_lesson <= 0:
            return None

        total_paid = BalanceOperation.objects.filter(
            student=self, course=course,
            operation_type=BalanceOperation.TYPE_PAYMENT
        ).aggregate(s=Sum('amount'))['s'] or 0

        paid_lessons = total_paid // price_obj.price_per_lesson

        conducted = BalanceOperation.objects.filter(
            student=self, course=course,
            operation_type=BalanceOperation.TYPE_CHARGE
        ).count()

        return paid_lessons - conducted

    def get_balance_summary(self):
        """
        Возвращает:
        {
            'total_balance': <int>,
            'by_course': [
                {
                    'course_id': <int>,
                    'course_name': <str>,
                    'balance': <int>,
                    'price_per_lesson': <int>,
                    'paid_lessons': <int|None>,       # None, если цена не задана
                    'conducted_lessons': <int>,
                    'remaining_lessons': <int|None>,  # None, если цена не задана
                },
                ...
            ],
        }
        """
        from django.db.models import Sum

        # Собираем ID всех курсов, где есть либо цена, либо операции
        priced_course_ids = set(
            StudentCoursePrice.objects.filter(student=self).values_list('course_id', flat=True)
        )
        operated_course_ids = set(
            BalanceOperation.objects.filter(student=self).values_list('course_id', flat=True)
        )
        course_ids = priced_course_ids | operated_course_ids

        if not course_ids:
            return {'total_balance': 0, 'by_course': []}

        courses = Course.objects.filter(id__in=course_ids).order_by('name')

        total_balance = 0
        by_course = []

        for course in courses:
            # ИЗМЕНЕНО: считаем отдельно оплаты и списания
            total_paid = BalanceOperation.objects.filter(
                student=self, course=course,
                operation_type=BalanceOperation.TYPE_PAYMENT
            ).aggregate(s=Sum('amount'))['s'] or 0

            total_charged_raw = BalanceOperation.objects.filter(
                student=self, course=course,
                operation_type=BalanceOperation.TYPE_CHARGE
            ).aggregate(s=Sum('amount'))['s'] or 0
            total_charged = abs(total_charged_raw)   # модуль (charge хранится отрицательным)

            balance = total_paid - total_charged
            total_balance += balance

            # Цена за занятие
            price_obj = StudentCoursePrice.objects.filter(student=self, course=course).first()
            price = price_obj.price_per_lesson if price_obj else 0

            # ИЗМЕНЕНО: paid_lessons считается от суммы оплат, не от текущего баланса
            if price > 0:
                paid_lessons = total_paid // price
            else:
                paid_lessons = None

            # Проведено занятий (charge-операций)
            conducted_lessons = BalanceOperation.objects.filter(
                student=self, course=course,
                operation_type=BalanceOperation.TYPE_CHARGE
            ).count()

            # Осталось занятий
            if paid_lessons is not None:
                remaining_lessons = paid_lessons - conducted_lessons
            else:
                remaining_lessons = None


            # НОВОЕ: до какого числа хватит оплаты
            paid_until_date = None
            if remaining_lessons is not None and remaining_lessons > 0:
                from django.utils import timezone
                from .models import ScheduleEvent
                future_lessons = list(
                    ScheduleEvent.objects.filter(
                        students=self,
                        course=course,
                        date__gte=timezone.localdate(),
                    ).order_by('date', 'time')[:remaining_lessons]
                )
                if future_lessons:
                    paid_until_date = future_lessons[-1].date

            by_course.append({
                'course_id': course.id,
                'course_name': course.name,
                'balance': balance,
                'price_per_lesson': price,
                'paid_lessons': paid_lessons,
                'conducted_lessons': conducted_lessons,
                'remaining_lessons': remaining_lessons,
                'paid_until_date': paid_until_date.strftime('%Y-%m-%d') if paid_until_date else None,   # НОВОЕ
            })

        return {
            'total_balance': total_balance,
            'by_course': by_course,
        }

    class Meta:
        verbose_name = "Ученик"
        verbose_name_plural = "Ученики"
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.last_name} {self.first_name}"

    

class StudentCoursePrice(models.Model):
    """Индивидуальная цена ученика за занятие на конкретном курсе."""
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='course_prices',
        verbose_name='Ученик'
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='student_prices',
        verbose_name='Курс'
    )
    price_per_lesson = models.IntegerField(
        default=0,
        verbose_name='Цена за занятие (₽)'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Цена ученика за курс'
        verbose_name_plural = 'Цены учеников за курсы'
        unique_together = ('student', 'course')
        ordering = ['course__name']

    def __str__(self):
        return f'{self.student} / {self.course}: {self.price_per_lesson}₽'

class ScheduleEvent(models.Model):

    STATUS_NOTE = 'note'
    STATUS_INDIVIDUAL = 'individual'
    STATUS_GROUP = 'group'
    STATUS_CHOICES = [
        (STATUS_NOTE, 'Заметка'),
        (STATUS_INDIVIDUAL, 'Индивидуальное занятие'),
        (STATUS_GROUP, 'Групповое занятие'),
    ]

    user=models.ForeignKey(User,on_delete=models.CASCADE)
    date=models.DateField()
    time=models.TimeField()
    text=models.TextField(blank=True)
    color=models.CharField(max_length=20,blank=True, default='')
    is_recurring = models.BooleanField(default=False)
    series_id = models.UUIDField(default=None, null=True, blank=True, editable=False, db_index=True)
    duration = models.FloatField(default=1.0, help_text="Duration in hours")
    created_by = models.ForeignKey(User,on_delete=models.CASCADE,related_name='created_events',verbose_name='Создатель',
                                   default=1)
    is_compensation = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name='Компенсация'
    )
    compensation_attendances = models.ManyToManyField(
        'Attendance',
        blank=True,
        related_name='compensating_events',
        verbose_name='Отработанные пропуски'
    )
    
    
    course = models.ForeignKey(
        'Course',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='events',
        verbose_name='Курс'
    )


    # ─── NEW: Ученики и статус ───────────────────────────
    students = models.ManyToManyField(
        'Student',
        blank=True,
        related_name='events',
        verbose_name='Ученики'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_NOTE,
        db_index=True,
        verbose_name='Статус'
    )

    # ─── Статус проведения занятия (для индивидуальных) ──
    COMPLETION_PASSED = 'passed'
    COMPLETION_MISSED_STUDENT = 'missed_student'
    COMPLETION_MISSED_TEACHER = 'missed_teacher'
    COMPLETION_NOT_CONDUCTED = 'not_conducted'

    COMPLETION_CHOICES = [
        (COMPLETION_PASSED, 'Прошло успешно'),
        (COMPLETION_MISSED_STUDENT, 'Пропущено учеником'),
        (COMPLETION_MISSED_TEACHER, 'Пропущено преподавателем'),
        (COMPLETION_NOT_CONDUCTED, 'Не проведено'),
    ]

    # Пустая строка '' = занятие ещё не отмечено
    completion_status = models.CharField(
        max_length=20,
        choices=COMPLETION_CHOICES,
        blank=True,
        default='',
        db_index=True,
        verbose_name='Статус проведения'
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Когда отмечено'
    )

    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

     # ─── NEW: Пересчёт статуса ───────────────────────────
    def recalculate_status(self):
        """
        Пересчитывает статус на основе количества привязанных учеников:
        - 0 учеников → заметка
        - 1 ученик   → индивидуальное занятие
        - 2+         → групповое занятие
        """
        count = self.students.count()
        if count == 0:
            new_status = self.STATUS_NOTE
        elif count == 1:
            new_status = self.STATUS_INDIVIDUAL
        else:
            new_status = self.STATUS_GROUP

        if self.status != new_status:
            self.status = new_status
            self.save(update_fields=['status'])

    def is_finished(self, now=None):
        """
        Возвращает True, если занятие уже закончилось
        (date + time + duration < now).
        """
        
        if now is None:
            now = timezone.localtime()

        # Собираем конец события как aware datetime в текущей таймзоне
        end_dt = timezone.make_aware(
            datetime.combine(self.date, self.time),
            timezone.get_current_timezone()
        ) + timedelta(hours=self.duration)

        return end_dt < now

    def __str__(self):
        return f"{self.user} {self.date} {self.time} ({self.text[:20]})"


class Attendance(models.Model):
    """
    Факт посещения занятия учеником.
    Запись создаётся только при отметке занятия.
    """
    event = models.ForeignKey(
        ScheduleEvent,
        on_delete=models.CASCADE,
        related_name='attendances',
        verbose_name='Занятие'
    )
    student = models.ForeignKey(
        'Student',
        on_delete=models.CASCADE,
        related_name='attendances',
        verbose_name='Ученик'
    )
    was_present = models.BooleanField(
        verbose_name='Присутствовал'
    )
    marked_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Когда отмечено'
    )

    compensated = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name='Компенсация предоставлена'
    )

    class Meta:
        verbose_name = 'Посещаемость'
        verbose_name_plural = 'Посещаемость'
        unique_together = ('event', 'student')
        indexes = [
            models.Index(fields=['event', 'student']),
            models.Index(fields=['student', 'was_present']),
        ]

    def __str__(self):
        status = 'был' if self.was_present else 'не был'
        return f'{self.student} @ {self.event_id}: {status}'

class BalanceOperation(models.Model):
    """
    Одно движение по балансу ученика.
    Положительное = оплата, отрицательное = списание (будет позже).
    """
    TYPE_PAYMENT = 'payment'
    TYPE_CHARGE = 'charge'
    TYPE_ADJUSTMENT = 'adjustment'
    TYPE_CHOICES = [
        (TYPE_PAYMENT, 'Оплата'),
        (TYPE_CHARGE, 'Списание за занятие'),
        (TYPE_ADJUSTMENT, 'Корректировка'),
    ]

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='balance_operations',
        verbose_name='Ученик'
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='balance_operations',
        verbose_name='Курс'
    )
    amount = models.IntegerField(verbose_name='Сумма (₽)')
    operation_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        db_index=True,
        verbose_name='Тип операции'
    )
    operation_date = models.DateField(verbose_name='Дата операции')
    event = models.ForeignKey(
        'ScheduleEvent',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='balance_operations',
        verbose_name='Занятие'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        verbose_name='Создал'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Операция по балансу'
        verbose_name_plural = 'Операции по балансу'
        ordering = ['-operation_date', '-created_at']
        indexes = [
            models.Index(fields=['student', 'course']),
            models.Index(fields=['operation_type']),
        ]

    def __str__(self):
        sign = '+' if self.amount >= 0 else ''
        return f'{self.student} / {self.course}: {sign}{self.amount}₽ ({self.get_operation_type_display()})'


# ─── NEW: Сигнал для автопересчёта статуса ───────────────
@receiver(m2m_changed, sender=ScheduleEvent.students.through)
def update_schedule_event_status(sender, instance, action, **kwargs):
    """
    Django вызывает этот сигнал всякий раз, когда меняется состав
    учеников у события — через view, админку или shell.
    action может быть: pre_add, post_add, pre_remove, post_remove,
                       pre_clear, post_clear
    Нас интересуют только 'post_*' — когда изменения уже применены.
    """
    if action in ('post_add', 'post_remove', 'post_clear'):
        instance.recalculate_status()


@receiver(pre_delete, sender=ScheduleEvent)
def restore_attendance_on_compensation_delete(sender, instance, **kwargs):
    """Перед удалением события-компенсации возвращаем пропуски в некомпенсированные."""
    if instance.is_compensation:
        attendance_ids = list(instance.compensation_attendances.values_list('id', flat=True))
        if attendance_ids:
            Attendance.objects.filter(id__in=attendance_ids).update(compensated=False)

        

