import {currentWeek,initCurrentWeek,goToPrevWeek,goToNextWeek,toggleHoursVisibility} from './schedule_controller.js';
import { EventManager } from './services/event-manager.js';
import { UserManager } from './services/user-manager.js';
import { initMobileViewToggle } from './mobile_view_mode.js';
import { timelineManager } from './schedule_controller.js';
import { StudentsController } from './services/students-controller.js';
import { CompletionModal } from './components/completion-modal.js';
import { CoursePriceModal } from './components/course-price-modal.js';
import { CoursePricesService } from './services/course-prices.js';
import { PaymentModal } from './components/payment-modal.js';
import { PaymentsService } from './services/payments.js';
import { BalanceService } from './services/balance.js';

let eventManager = null;
let userManager = null;




/*
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
                // Обновляем линии времени
                timelineManager.update();
            }, 150);
        }
    });
}

/**
 * Настройка обработчиков смены пользователя
 */
function initUserChangeHandlers() {
    if (!userManager) return;

    // Обработчик события смены пользователя
    userManager.onUserChanged(async (event) => {
        // Перезагружаем события для нового пользователя
        if (eventManager) {
            try {
                await eventManager.loadEventsForWeek();
                eventManager.updateOverlayPositions();
                timelineManager.update();
            } catch (error) {
                console.error('❌ Ошибка перезагрузки событий:', error);
            }
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
                    // Обновляем линии времени
                    timelineManager.update();
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
                // Обновляем линии времени
                timelineManager.update();
            }, 150);
        }
    });
}

/**
 * Инициализация страницы РАСПИСАНИЯ
 */
async function initSchedulePage() {
    try {
        const week = await initCurrentWeek();
        
        userManager = new UserManager();
        await userManager.initUserSwitcher();
        initUserChangeHandlers();

        eventManager = new EventManager({ currentWeek: week });

        initWeekNavigation();
        initHoursToggle();
        initMobileView();
        initPageVisibilityHandler();

        await eventManager.waitForInit();
        await eventManager.loadEventsForWeek();

        // Проверяем непроверенные занятия и показываем модалку отметки
        const completionModal = new CompletionModal();
        await completionModal.checkAndShow();

        setTimeout(() => {
            if (eventManager) {
                eventManager.updateOverlayPositions();
            }
        }, 500);

    } catch (error) {
        console.error('💥 Ошибка инициализации расписания:', error);
    }
}

/**
 * Инициализация страницы УЧЕНИКОВ
 */
function initStudentsPage() {
    try {
        // Просто создаем контроллер, он сам сделает всю работу
        new StudentsController();
        console.log('✅ Страница учеников инициализирована');
    } catch (error) {
        console.error('💥 Ошибка инициализации страницы учеников:', error);
    }
}

/**
 * Показ страницы учеников
 */
async function initStudentDetailPage() {
    try {
        const page = document.getElementById('student-detail-page');
        const studentId = parseInt(page.dataset.studentId, 10);

        const controller = new StudentsController();
        await controller.ready;    // ждём загрузки списка учеников

        const editBtn = document.getElementById('student-detail-edit');
        if (editBtn) {
            editBtn.addEventListener('click', () => controller.openEditModal(studentId));
        }

        // Баланс ученика
        const balanceService = new BalanceService(studentId);

        // Модалка стоимости курса
        const coursePriceModal = new CoursePriceModal();
        const coursePricesService = new CoursePricesService(studentId, coursePriceModal,() => balanceService.loadAndRender());
        await coursePricesService.loadAndRender();

         // Модалка оплаты
        const paymentModal = new PaymentModal();
        const paymentsService = new PaymentsService(studentId, paymentModal,() => balanceService.loadAndRender());
        await paymentsService.loadAndRender();

        await balanceService.loadAndRender();

        const addCoursePriceBtn = document.getElementById('add-course-price-btn');
        if (addCoursePriceBtn) {
            addCoursePriceBtn.addEventListener('click', () => coursePriceModal.open());
        }

        const addPaymentBtn = document.getElementById('add-payment-btn');
        if (addPaymentBtn) {
            addPaymentBtn.addEventListener('click', () => paymentModal.open());
        }
    } catch (error) {
        console.error('💥 Ошибка initStudentDetailPage:', error);
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

/**
 * ГЛАВНЫЙ РОУТЕР
 * Определяет, на какой мы странице, и запускает нужный код
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Проверяем наличие уникального элемента расписания
    if (document.getElementById('schedule-container') || document.getElementById('prev-week')) {
        initSchedulePage();
        return;
    } 
    // Проверяем наличие уникального элемента учеников
    if (document.getElementById('students-list')) {
        console.log('👤 Обнаружена страница учеников');
        initStudentsPage();
        return;
    }
    if (document.getElementById('student-detail-page')) {
        console.log('👤 Обнаружена страница ученика');
        await initStudentDetailPage();
        return;
    }
});

// Очистка при выгрузке страницы (оставляем как было)
window.addEventListener('beforeunload', cleanupApplication);
