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
    duration = models.FloatField(default=1.0, help_text="Duration in hours")  # Новое поле

    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    class Meta:
        unique_together=['user','date','time']

