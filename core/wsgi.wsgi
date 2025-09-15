import os
import sys

sys.path.insert(0, '/var/www/CodyScheduler')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.production')

from core.wsgi import application
