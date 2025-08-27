import {initCurrentWeek,goToPrevWeek,goToNextWeek} from './schedule_controller.js';
import {saveEvent,hideEventModal,showEventModal} from './add_note.js';

document.addEventListener('DOMContentLoaded',
    function()
    {
       initCurrentWeek();

       document.getElementById('prev-week').addEventListener('click', goToPrevWeek);
       document.getElementById('next-week').addEventListener('click', goToNextWeek);

       // Обработчики для модального окна
        document.getElementById('modal-ok').addEventListener('click', saveEvent);
        document.getElementById('modal-cancel').addEventListener('click', hideEventModal);

        // Закрытие по клику на затемнение
        document.getElementById('modal-overlay').addEventListener('click', hideEventModal);

        // Закрытие по клавише Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                hideEventModal();
            }
        });

        // Обработчики кликов по ячейкам
        document.querySelectorAll('.schedule-cell').forEach(cell => {
            cell.addEventListener('click', function() {
                showEventModal(this);
            });
        });
    }
);