# scheduler/admin.py
from django.contrib import admin
from .models import ScheduleEvent

@admin.register(ScheduleEvent)
class ScheduleEventAdmin(admin.ModelAdmin):
    list_display = ['date', 'time', 'text', 'color', 'user']
    list_filter = ['date', 'color']