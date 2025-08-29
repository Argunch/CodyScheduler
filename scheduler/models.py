from django.db import models
from django.contrib.auth.models import User

class ScheduleEvent(models.Model):
    user=models.ForeignKey(User,on_delete=models.CASCADE)
    date=models.DateField()
    time=models.TimeField()
    text=models.TextField(blank=True)
    color=models.CharField(max_length=20,blank=True)
    is_recurring = models.BooleanField(default=False)

    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    class Meta:
        unique_together=['user','date','time']

