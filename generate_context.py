import os
import sys
import importlib
from pathlib import Path

class DjangoContextGenerator:
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.context_parts = []
        
    def setup_django(self):
        """Настраивает Django environment для вашей структуры"""
        # Добавляем корень проекта в Python path
        sys.path.insert(0, str(self.project_root))
        
        # Пробуем разные варианты настроек
        settings_modules = [
            "core.settings.local",
            "core.settings.base", 
            "core.settings.production",
            "core.settings"
        ]
        
        for settings_module in settings_modules:
            try:
                os.environ.setdefault('DJANGO_SETTINGS_MODULE', settings_module)
                import django
                django.setup()
                print(f"✅ Successfully loaded settings from: {settings_module}")
                return True
            except Exception as e:
                print(f"❌ Failed to load {settings_module}: {e}")
                continue
        
        print("⚠️  Could not load Django settings automatically")
        return False
    
    def add_section(self, title, content):
        """Добавляет секцию в контекст"""
        self.context_parts.append(f"## {title}\n\n{content}\n\n")
    
    def collect_project_structure(self):
        """Собирает информацию о структуре проекта"""
        structure = "Project Structure:\n\n"
        
        ignore_dirs = {'__pycache__', 'venv', 'env', 'staticfiles', '.git', 'node_modules', 'grigmore'}
        ignore_files = {'.DS_Store', '.env'}
        
        def list_dir(path, level=0):
            result = ""
            indent = "  " * level
            
            try:
                items = sorted(os.listdir(path))
                for item in items:
                    full_path = os.path.join(path, item)
                    
                    if item in ignore_dirs or item in ignore_files:
                        continue
                        
                    if os.path.isdir(full_path):
                        result += f"{indent}📁 {item}/\n"
                        result += list_dir(full_path, level + 1)
                    else:
                        # Показываем только важные файлы
                        if any(item.endswith(ext) for ext in ['.py', '.html', '.js', '.css', '.md', '.txt']):
                            result += f"{indent}📄 {item}\n"
            except Exception as e:
                pass
                
            return result
        
        structure += list_dir(self.project_root)
        self.add_section("PROJECT STRUCTURE", structure)
    
    def collect_settings_content(self):
        """Читает содержимое файлов настроек напрямую"""
        settings_info = "Settings Files Content:\n\n"
        
        settings_path = self.project_root / 'core' / 'settings'
        settings_files = ['__init__.py', 'base.py', 'local.py', 'production.py']
        
        for settings_file in settings_files:
            file_path = settings_path / settings_file
            if file_path.exists():
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    settings_info += f"### core/settings/{settings_file}\n"
                    settings_info += f"```python\n{content}\n```\n\n"
                except Exception as e:
                    settings_info += f"### core/settings/{settings_file} - Error: {e}\n\n"
            else:
                settings_info += f"### core/settings/{settings_file} - Not found\n\n"
        
        self.add_section("SETTINGS", settings_info)
    
    def collect_requirements(self):
        """Читает requirements файлы"""
        requirements_info = "Dependencies:\n\n"
        
        req_files = ['requirements_linux.txt', 'requirements_windows.txt', 'requirements.txt']
        
        for req_file in req_files:
            file_path = self.project_root / req_file
            if file_path.exists():
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    requirements_info += f"### {req_file}\n```\n{content}\n```\n\n"
                except Exception as e:
                    requirements_info += f"### {req_file} - Error: {e}\n\n"
        
        self.add_section("REQUIREMENTS", requirements_info)
    
    def collect_apps_content(self):
        """Читает содержимое основных файлов приложений"""
        apps_info = "Applications Content:\n\n"
        
        # Содержимое приложения scheduler
        scheduler_path = self.project_root / 'scheduler'
        scheduler_files = ['models.py', 'views.py', 'urls.py', 'admin.py', 'apps.py']
        
        apps_info += "## scheduler App\n\n"
        
        for s_file in scheduler_files:
            file_path = scheduler_path / s_file
            if file_path.exists():
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    apps_info += f"### scheduler/{s_file}\n```python\n{content}\n```\n\n"
                except Exception as e:
                    apps_info += f"### scheduler/{s_file} - Error: {e}\n\n"
        
        # Содержимое core (основные файлы проекта)
        core_path = self.project_root / 'core'
        core_files = ['urls.py', 'views.py', 'asgi.py', 'wsgi.py']
        
        apps_info += "## core Project Files\n\n"
        
        for c_file in core_files:
            file_path = core_path / c_file
            if file_path.exists():
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    apps_info += f"### core/{c_file}\n```python\n{content}\n```\n\n"
                except Exception as e:
                    apps_info += f"### core/{c_file} - Error: {e}\n\n"
        
        self.add_section("APPLICATIONS CODE", apps_info)
    
    def collect_static_and_templates(self):
        """Собирает информацию о статических файлах и шаблонах"""
        static_info = "Static Files and Templates:\n\n"
        
        # Статические файлы
        static_dirs = [self.project_root / 'static', self.project_root / 'staticfiles']
        
        js_files = []
        css_files = []
        
        for static_dir in static_dirs:
            if static_dir.exists():
                for file_path in static_dir.rglob('*'):
                    if file_path.is_file():
                        rel_path = file_path.relative_to(self.project_root)
                        if file_path.suffix == '.js':
                            js_files.append(str(rel_path))
                        elif file_path.suffix == '.css':
                            css_files.append(str(rel_path))
        
        static_info += "### JavaScript Files\n"
        for js_file in sorted(js_files)[:10]:
            static_info += f"- {js_file}\n"
        
        static_info += "\n### CSS Files\n"
        for css_file in sorted(css_files)[:10]:
            static_info += f"- {css_file}\n"
        
        # Шаблоны
        templates_dirs = [self.project_root / 'templates']
        templates = []
        
        for templates_dir in templates_dirs:
            if templates_dir.exists():
                for file_path in templates_dir.rglob('*.html'):
                    templates.append(file_path.relative_to(self.project_root))
        
        static_info += "\n### Templates\n"
        for template in sorted(templates)[:10]:
            static_info += f"- {template}\n"
        
        self.add_section("FRONTEND", static_info)
    
    def try_django_analysis(self):
        """Пробует проанализировать проект через Django если возможно"""
        try:
            import django
            from django.apps import apps
            from django.conf import settings
            
            django_info = "Django Analysis (if available):\n\n"
            
            # Информация о приложениях
            django_info += "### Installed Apps\n"
            for app in settings.INSTALLED_APPS:
                django_info += f"- {app}\n"
            
            # Модели
            django_info += "\n### Models\n"
            for app_config in apps.get_app_configs():
                if not app_config.name.startswith('django.'):
                    models = app_config.get_models()
                    django_info += f"**{app_config.verbose_name}** ({app_config.name}):\n"
                    for model in models:
                        django_info += f"- {model.__name__}\n"
            
            self.add_section("DJANGO ANALYSIS", django_info)
            return True
            
        except Exception as e:
            self.add_section("DJANGO ANALYSIS", f"Django analysis not available: {e}")
            return False
    
    def generate(self):
        """Генерирует полный контекст"""
        print("🚀 Starting context generation for CODYSCHEDULER...")
        
        # Пробуем настроить Django, но продолжаем даже если не получится
        django_loaded = self.setup_django()
        
        # Собираем информацию в любом случае
        self.collect_project_structure()
        self.collect_settings_content()
        self.collect_requirements()
        self.collect_apps_content()
        self.collect_static_and_templates()
        
        # Пробуем Django анализ только если настройки загрузились
        if django_loaded:
            self.try_django_analysis()
        
        # Собираем все вместе
        full_context = "# CODYSCHEDULER PROJECT CONTEXT\n\n"
        full_context += "".join(self.context_parts)
        full_context += f"\n\n# Generated at: {importlib.import_module('datetime').datetime.now()}"
        
        # Сохраняем в файл
        output_file = self.project_root / 'project_context.txt'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(full_context)
        
        print(f"✅ Context generated successfully!")
        print(f"📁 File: {output_file}")
        print(f"📊 Size: {len(full_context)} characters")
        
        if not django_loaded:
            print("⚠️  Note: Django settings were not loaded, but basic project structure was captured")
        
        return full_context

def main():
    generator = DjangoContextGenerator()
    generator.generate()

if __name__ == "__main__":
    main()