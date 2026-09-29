# 1. Выйди из venv
deactivate

# 2. Переименуй старый venv
Rename-Item .venv .venv_old

# 3. Создай новый
python -m venv .venv

# 4. Активируй
.venv\Scripts\activate

# 5. Установи зависимости
pip install -r requirements_windows.txt