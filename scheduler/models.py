from django.db import models
from django.contrib.auth.models import User

class ScheduleEvent(models.Model):
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

    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} {self.date} {self.time} ({self.text[:20]})"


class Student(models.Model):
    first_name = models.CharField(max_length=100, verbose_name="Имя")
    last_name = models.CharField(max_length=100, verbose_name="Фамилия")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name="Создатель")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Ученик"
        verbose_name_plural = "Ученики"
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.last_name} {self.first_name}"