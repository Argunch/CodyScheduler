import { timeUtils, dateUtils } from '../utils/utils.js';
import { EventDTO } from '../models/event-dto.js';

export class EventViewModal {
    constructor() {
        this.elements = {
            modal: document.getElementById('event-view-modal'),
            overlay: document.getElementById('view-modal-overlay'),
            timeInfo: document.getElementById('view-time-info'),
            eventText: document.getElementById('view-event-text'),
            eventDuration: document.getElementById('view-event-duration'),
            close: document.querySelector('#event-view-modal .close')
        };

        this.dayNames = {
            'mon': 'Понедельник',
            'tue': 'Вторник',
            'wed': 'Среда',
            'thu': 'Четверг',
            'fri': 'Пятница',
            'sat': 'Суббота',
            'sun': 'Воскресенье'
        };

        this.bindEvents();
    }

    bindEvents() {

        // ДОБАВЛЯЕМ: Обработчик для крестика
        if (this.elements.close) {
            this.elements.close.addEventListener('click', () => this.hide());
        }

        // Закрытие по клику на overlay
        this.elements.overlay.addEventListener('click', () => this.hide());

        // Закрытие по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible()) {
                this.hide();
            }
        });

        // Предотвращаем закрытие при клике на само модальное окно
        this.elements.modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    /**
     * Показать модальное окно для просмотра события
     * @param {Object} eventData - Данные события
     */
    show(eventData) {
        const dto = new EventDTO(eventData);

        // Форматируем дату и время
        const date = dto.date;
        const time = dto.time;
        const day = dateUtils.getDayFromDate(date);
        const formattedDate = dateUtils.formatDate(date);

        // Устанавливаем информацию о времени
        this.elements.timeInfo.textContent =
            `${this.dayNames[day]}, ${formattedDate} ${time}`;

        // Заполняем поля
        // this.elements.eventText.textContent = dto.text || '(без текста)';
        this.renderText(eventData.text || '');
        this.elements.eventDuration.textContent =
            `${timeUtils.decimalToTime(dto.duration)} часов`;

        // Заполняем учеников
        this.renderStudents(eventData.students);
        this.renderCourse(eventData.course_name);   // ДОБАВЛЕНО
        this.showModal();
    }

    /**
     * Показать модальное окно
     */
    showModal() {
        this.elements.modal.style.display = 'block';
        this.elements.overlay.style.display = 'block';
    }

    /**
     * Скрыть модальное окно
     */
    hide() {
        this.elements.modal.style.display = 'none';
        this.elements.overlay.style.display = 'none';
    }

    /**
     * Проверить, видимо ли модальное окно
     */
    isVisible() {
        return this.elements.modal.style.display === 'block';
    }

    renderStudents(students) {
        const group = document.getElementById('view-students-group');
        const container = document.getElementById('view-event-students');

        if (!group || !container) return;

        // Если учеников нет — прячем секцию целиком
        if (!Array.isArray(students) || students.length === 0) {
            group.style.display = 'none';
            container.innerHTML = '';
            this.updateModalText(false);            // ← NEW: нет учеников
            return;
        }

        group.style.display = 'block';


        // ИЗМЕНЕНО: строки — ссылки на профиль ученика с (N) остатка
        container.innerHTML = students.map(s => {
            const suffix = (s.remaining_lessons !== null && s.remaining_lessons !== undefined)
                ? ` (${s.remaining_lessons})`
                : '';
            return `
                <div class="view-student-row">
                    ${this.escapeHtml(s.full_name)}${suffix}
                </div>
            `;
        }).join('');

        this.updateModalText(true);                 // ← NEW: есть ученики
    }

    /**
     * Меняет заголовок и метку текста в зависимости от наличия учеников
     */
    updateModalText(hasStudents) {
        const title = document.getElementById('view-modal-title');
        const label = document.getElementById('view-text-label');

        if (title) {
            title.textContent = hasStudents ? 'Просмотр занятия' : 'Просмотр события';
        }
        if (label) {
            label.textContent = hasStudents ? 'Заметки к занятию:' : 'Текст события:';
        }
    }

    /**
     * Показывает/скрывает блок с курсом.
     */
    renderCourse(courseName) {
        const group = document.getElementById('view-course-group');
        const el = document.getElementById('view-event-course');
        if (!group || !el) return;

        if (!courseName) {
            group.style.display = 'none';
            el.textContent = '';
            return;
        }
        group.style.display = 'block';
        el.textContent = courseName;
    }

    /**
     * Вставляет текст с автоматической подсветкой ссылок.
     * Порядок: сначала escape (XSS), потом линкификация.
     */
    renderText(text) {
        const container = document.getElementById('view-event-text');
        if (!container) return;

        if (!text) {
            container.innerHTML = '';
            return;
        }

        // 1. Экранируем HTML — защита от XSS
        const escaped = this.escapeHtml(text);

        // 2. Находим http(s):// и www. — оборачиваем в <a>
        const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
        const html = escaped.replace(urlRegex, (url) => {
            const href = url.startsWith('http') ? url : `https://${url}`;
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });

        // 3. Вставляем через innerHTML.
        // CSS white-space: pre-line сохранит переносы строк.
        container.innerHTML = html;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}