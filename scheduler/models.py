from django.db import models
from django.contrib.auth.models import User
import uuid

class ScheduleEvent(models.Model):
    user=models.ForeignKey(User,on_delete=models.CASCADE)
    date=models.DateField()
    time=models.TimeField()
    text=models.TextField(blank=True)
    color=models.CharField(max_length=20,blank=True, default='')
    is_recurring = models.BooleanField(default=False)
    series_id = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)
    duration = models.FloatField(default=1.0, help_text="Duration in hours")
    created_by = models.ForeignKey(User,on_delete=models.CASCADE,related_name='created_events',verbose_name='Создатель',
                                   default=1)

    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} {self.date} {self.time} ({self.text[:20]})"

