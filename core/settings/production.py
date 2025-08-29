"""
Production settings for core project.
"""
from .base import *
import os

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = False

ALLOWED_HOSTS = [
    'scheduler.mrrob.ru',
    'www.scheduler.mrrob.ru',
    'localhost',
    '127.0.0.1'
]

# Database
# Используйте переменные окружения для безопасности!
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'cody_scheduler'),
        'USER': os.environ.get('DB_USER', 'cody_user'),
        'PASSWORD': os.environ.get('DB_PASSWORD', ''),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

# Security settings
CSRF_TRUSTED_ORIGINS = [
    'https://scheduler.mrrob.ru',
    'https://www.scheduler.mrrob.ru',
]

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# Static files
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'ERROR',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'django_errors.log'),
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file'],
            'level': 'ERROR',
            'propagate': True,
        },
    },
}

# Use environment variable for secret key in production
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', SECRET_KEY)