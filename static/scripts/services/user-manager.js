// scripts/services/user-manager.js
import { ApiService } from './api-service.js';

export class UserManager {
    constructor() {
        this.apiService = new ApiService();
        this.currentUserInfo = null;
    }

     /**
     * Инициализация переключателя пользователей
     */
    async initUserSwitcher() {
        const userSelect = document.getElementById('user-select');
        if (!userSelect) return;

        try {
            // Загружаем список пользователей через ApiService
            const users = await this.apiService.getUsersList();

            // Добавляем пользователей в выпадающий список, исключая текущего
            users.forEach(user => {
                // 👇 Пропускаем текущего пользователя
                if (user.id.toString() !== this.getCurrentUserId()) {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = user.username;
                    userSelect.appendChild(option);
                }
            });

            // Восстанавливаем сохраненный выбор
            await this.restoreUserSelection();

            // Обработчик изменения выбора
            userSelect.addEventListener('change', (e) => {
                this.handleUserSwitch(e.target.value);
            });

            console.log('✅ User switcher initialized');

        } catch (error) {
            console.error('❌ Ошибка инициализации переключателя пользователей:', error);
        }
    }

    getCurrentUserId() {
        // Из data-атрибута
        const userElement = document.querySelector('[data-user-id]');
        if (userElement) {
            return userElement.dataset.userId;
        }

        // Или из meta-тега
        const metaElement = document.querySelector('meta[name="current-user-id"]');
        if (metaElement) {
            return metaElement.getAttribute('content');
        }

        console.warn('Не удалось найти ID текущего пользователя');
        return '';
    }

    /**
     * Обработка переключения пользователя
     * @param {string} userId - ID пользователя
     */
    async handleUserSwitch(userId) {
        try {
            const data = await this.apiService.switchUser(userId);

            if (data.status === 'success') {
                this.currentUserInfo = '';
                this.updateUserInfoDisplay();

                // 👇 ДОБАВЬТЕ ЭТУ СТРОКУ - сохраняем выбор
                this.saveUserSelection(userId);

                // Создаем событие для уведомления других модулей
                this.dispatchUserChangedEvent(userId);

            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Ошибка переключения пользователя:', error);
            alert('Ошибка: ' + error.message);
        }
    }

    /**
     * Сохраняет выбранного пользователя в localStorage
     */
    saveUserSelection(userId) {
        try {
            localStorage.setItem('selectedUserId', userId);
        } catch (error) {
            console.warn('Не удалось сохранить выбор пользователя:', error);
        }
    }

    /**
     * Загружает сохраненного пользователя из localStorage
     */
    loadUserSelection() {
        try {
            return localStorage.getItem('selectedUserId') || 'self';
        } catch (error) {
            console.warn('Не удалось загрузить выбор пользователя:', error);
            return 'self';
        }
    }

    /**
     * Восстанавливает выбранного пользователя при загрузке
     */
    async restoreUserSelection() {
        const savedUserId = this.loadUserSelection();
        const userSelect = document.getElementById('user-select');

        if (userSelect && savedUserId) {
            userSelect.value = savedUserId;

            // Если выбран не "self", применяем выбор
            if (savedUserId !== 'self') {
                await this.handleUserSwitch(savedUserId);
            }
        }
    }
    /**
     * Обновить отображение информации о текущем пользователе
     */
    updateUserInfoDisplay() {
        const infoElement = document.getElementById('current-user-info');
        if (infoElement && this.currentUserInfo) {
            infoElement.textContent = this.currentUserInfo;
        }
    }

    /**
     * Отправить событие о смене пользователя
     * @param {string} userId - ID пользователя
     */
    dispatchUserChangedEvent(userId) {
        const event = new CustomEvent('userChanged', {
            detail: {
                userId: userId,
                timestamp: new Date(),
                message: this.currentUserInfo
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Получить информацию о текущем выбранном пользователе
     * @returns {Object} Информация о пользователе
     */
    getCurrentUserInfo() {
        return this.currentUserInfo;
    }

    /**
     * Проверить, является ли текущий режим просмотром другого пользователя
     * @returns {boolean} true если просматривается другой пользователь
     */
    isViewingOtherUser() {
        const userSelect = document.getElementById('user-select');
        return userSelect && userSelect.value !== 'self';
    }


    /**
     * Установить обработчик события смены пользователя
     * @param {Function} callback - Функция-обработчик
     */
    onUserChanged(callback) {
        document.addEventListener('userChanged', callback);
    }

    /**
     * Удалить обработчик события смены пользователя
     * @param {Function} callback - Функция-обработчик
     */
    offUserChanged(callback) {
        document.removeEventListener('userChanged', callback);
    }

    /**
     * Очистка ресурсов
     */
    destroy() {
        const userSelect = document.getElementById('user-select');
        if (userSelect) {
            userSelect.replaceWith(userSelect.cloneNode(true)); // Удаляем обработчики
        }

        this.currentUserInfo = null;
        console.log('🧹 User manager cleaned up');
    }
}