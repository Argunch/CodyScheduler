"""
Local development settings for core project.
"""
from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1'
]

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'cody_scheduler'),
        'USER': os.environ.get('DB_USER', 'cody_user'),
        'PASSWORD': os.environ.get('DB_PASSWORD', ''),
        'HOST': 'localhost',                   # или '127.0.0.1'
        'PORT': '5432',
        'OPTIONS': {
            'client_encoding': 'UTF8',         # Кодировка
        },
    }
}

# Для отладки - можно включить логирование
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
        },
    },
}

