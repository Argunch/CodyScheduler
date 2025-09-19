import {initCurrentWeek,goToPrevWeek,goToNextWeek,toggleHoursVisibility} from './schedule_controller.js';
import {saveEvent,deleteEvent,hideEventModal,showEventModal,updateOverlayPositions} from './add_note.js';

// Обновление позиций overlay при изменении размера или скролле
let resizeTimer;

// Функция для обработки ресайза с debounce
function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        updateOverlayPositions();
    }, 250);
}

// Функция инициализации overlay listeners
function initOverlayListeners() {
    // Ресайз окна
    window.addEventListener('resize', handleResize);

    // Скролл расписания
    const scheduleWrapper = document.querySelector('.schedule-wrapper');
    if (scheduleWrapper) {
        scheduleWrapper.addEventListener('scroll', updateOverlayPositions);
    }
}

document.addEventListener('DOMContentLoaded',
    function()
    {
       initCurrentWeek();

        // Даем время на рендеринг расписания перед инициализацией overlay
        setTimeout(() => {
            initOverlayListeners();
            updateOverlayPositions(); // Первоначальное позиционирование
        }, 300);

       document.getElementById('prev-week').addEventListener('click', goToPrevWeek);
       document.getElementById('next-week').addEventListener('click', goToNextWeek);

       // Скрытие\показ ночных часов
       document.getElementById('toggle-hours-btn').addEventListener('click', toggleHoursVisibility);


       // Обработчики для модального окна
        document.getElementById('modal-ok').addEventListener('click', saveEvent);
        document.getElementById('modal-cancel').addEventListener('click', hideEventModal);
        document.getElementById('delete-note').addEventListener('click', deleteEvent);


        // Закрытие по клику на затемнение
        document.getElementById('modal-overlay').addEventListener('click', hideEventModal);

        // Закрытие по клавише Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                hideEventModal();
            }
        });
    }
);