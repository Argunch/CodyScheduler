#!/bin/bash
# =====================================================
# Скрипт деплоя CodyScheduler на production-сервер (Apache + mod_wsgi)
# Запуск: bash deploy.sh
# =====================================================

set -e  # остановиться при любой ошибке

# --- Настройки ---
PROJECT_DIR="/var/www/CodyScheduler"           # путь к проекту на сервере
VENV_DIR="$PROJECT_DIR/.venv"                   # venv
BRANCH="main"                                   # ветка для pull
SETTINGS_MODULE="core.settings.production"      # модуль настроек Django
APACHE_SERVICE="apache2"                        # имя службы Apache (на Debian/Ubuntu — apache2, на CentOS — httpd)
WSGI_FILE="$PROJECT_DIR/core/wsgi.py"           # для touch — обновить mtime, чтобы mod_wsgi перечитал

# --- Цветной вывод ---
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}▶ Начинаю деплой CodyScheduler...${NC}"

# --- 1. Перейти в папку проекта ---
cd "$PROJECT_DIR" || { echo -e "${RED}✗ Не найдена папка $PROJECT_DIR${NC}"; exit 1; }

# --- 2. Активировать venv ---
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${RED}✗ Не найден venv по пути $VENV_DIR${NC}"
    exit 1
fi
source "$VENV_DIR/bin/activate"

# --- 3. Забрать изменения с git ---
echo -e "${GREEN}▶ git pull origin $BRANCH${NC}"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# --- 4. Установить/обновить зависимости ---
echo -e "${GREEN}▶ Устанавливаю зависимости...${NC}"
pip install --upgrade pip
pip install -r requirements_linux.txt

# --- 5. Миграции ---
echo -e "${GREEN}▶ Применяю миграции...${NC}"
DJANGO_SETTINGS_MODULE="$SETTINGS_MODULE" python manage.py migrate --noinput

# --- 6. Собрать статику ---
echo -e "${GREEN}▶ Собираю статику...${NC}"
DJANGO_SETTINGS_MODULE="$SETTINGS_MODULE" python manage.py collectstatic --noinput

# --- 7. Проверить конфигурацию Django ---
echo -e "${GREEN}▶ Проверяю проект...${NC}"
DJANGO_SETTINGS_MODULE="$SETTINGS_MODULE" python manage.py check --deploy || true

# --- 8. Права доступа (Apache обычно работает под www-data) ---
echo -e "${GREEN}▶ Выставляю права на проект...${NC}"
sudo chown -R www-data:www-data "$PROJECT_DIR" 2>/dev/null || true
sudo chmod -R 755 "$PROJECT_DIR" 2>/dev/null || true

# --- 9. Обновить mtime wsgi.py — mod_wsgi перезагрузит проект ---
if [ -f "$WSGI_FILE" ]; then
    echo -e "${GREEN}▶ Обновляю wsgi.py для перезагрузки mod_wsgi...${NC}"
    touch "$WSGI_FILE"
fi

# --- 10. Перезапустить Apache ---
echo -e "${GREEN}▶ Перезапускаю Apache ($APACHE_SERVICE)...${NC}"
sudo systemctl reload "$APACHE_SERVICE" || sudo systemctl restart "$APACHE_SERVICE"

echo -e "${GREEN}✅ Деплой завершён успешно!${NC}"