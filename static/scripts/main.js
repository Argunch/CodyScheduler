import {currentWeek,initCurrentWeek,goToPrevWeek,goToNextWeek,toggleHoursVisibility} from './schedule_controller.js';
import { EventManager } from './services/event-manager.js';
import {initMobileViewToggle} from './mobile_view_mode.js';

let eventManager = null;

/**
 * Инициализация навигации по неделям
 */
function initWeekNavigation() {
    // Предыдущая неделя
    document.getElementById('prev-week').addEventListener('click', async () => {
        await goToPrevWeek();
        if (eventManager) {
            eventManager.setCurrentWeek(currentWeek);
        }
    });

    // Следующая неделя
    document.getElementById('next-week').addEventListener('click', async () => {
        await goToNextWeek();
        if (eventManager) {
            eventManager.setCurrentWeek(currentWeek);
        }
    });
}

/**
 * Инициализация переключения часов
 */
function initHoursToggle() {
    document.getElementById('toggle-hours-btn').addEventListener('click', () => {
        toggleHoursVisibility();
        // Обновляем позиции overlay после изменения видимости часов
        if (eventManager) {
            setTimeout(() => {
                eventManager.updateOverlayPositions();
            }, 150);
        }
    });
}

/**
 * Настройка обработчика видимости страницы для оптимизации
 */
function initPageVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Страница скрыта - можно приостановить некоторые процессы
            console.log('Страница скрыта, приостановка неактивных процессов');
        } else {
            // Страница снова активна - обновляем позиции overlay
            if (eventManager) {
                setTimeout(() => {
                    eventManager.updateOverlayPositions();
                }, 50);
            }
        }
    });
}

/**
 * Инициализация мобильного вида
 */
function initMobileView() {
    initMobileViewToggle(() => {
        if (eventManager) {
            setTimeout(() => {
                eventManager.updateOverlayPositions();
            }, 150);
        }
    });
}

/**
 * Основная функция инициализации приложения
 */
async function initializeApplication() {
    try {

        // 1. Инициализация текущей недели (ждем завершения)
        const week = await initCurrentWeek(); // ← Получаем неделю

        // 2. Создание менеджера событий
        eventManager = new EventManager({ currentWeek: week });

        // 3. Настройка специфичных для main.js обработчиков
        initWeekNavigation();
        initHoursToggle();
        initMobileView();
        initPageVisibilityHandler();

        // 4. Загрузка событий для текущей недели
        await eventManager.waitForInit();
        await eventManager.loadEventsForWeek();

        // 5. Финальное обновление позиций
        setTimeout(() => {
            if (eventManager) {
                eventManager.updateOverlayPositions();

            }
        }, 500);

    } catch (error) {
        console.error('💥 Ошибка инициализации приложения:', error);
    }
}

/**
 * Очистка ресурсов приложения
 */
function cleanupApplication() {
    if (eventManager) {
        eventManager.destroy();
        eventManager = null;
    }
    console.log('🧹 Приложение очищено');
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', initializeApplication);

// Очистка при выгрузке страницы
window.addEventListener('beforeunload', cleanupApplication);