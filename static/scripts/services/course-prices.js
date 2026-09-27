/**
 * Сервис работы с ценами ученика за курсы.
 * Загружает список, рендерит его и открывает модалку сохранения.
 */
export class CoursePricesService {
    constructor(studentId, coursePriceModal, onChanged = null) {
        this.studentId = studentId;
        this.modal = coursePriceModal;
        this.listContainer = document.getElementById('course-prices-list');

        this.onChanged = onChanged;

        this.modal.setStudent(this.studentId, () => {
            this.loadAndRender();
            if (this.onChanged) this.onChanged();
        });
    }

    /**
     * Загружает список цен с сервера и рендерит.
     */
    async loadAndRender() {
        if (!this.listContainer) return;

        try {
            const response = await fetch(
                `/api/load-course-prices/?student_id=${this.studentId}`,
                { cache: 'no-store', headers: { 'X-Requested-With': 'XMLHttpRequest' } }
            );
            const data = await response.json();

            if (data.status === 'success') {
                this.render(data.prices);
            } else {
                this.listContainer.innerHTML = `<div class="course-prices-empty">${data.message || 'Ошибка загрузки'}</div>`;
            }
        } catch (error) {
            console.error('❌ Ошибка load-course-prices:', error);
            this.listContainer.innerHTML = '<div class="course-prices-empty">Ошибка сети</div>';
        }
    }

    render(prices) {
        if (!prices || prices.length === 0) {
            this.listContainer.innerHTML = '<div class="course-prices-empty">Курсы не заданы</div>';
            return;
        }

        // ИЗМЕНЕНО: добавили data-price-id
        this.listContainer.innerHTML = prices.map(p => `
            <div class="course-price-row" data-price-id="${p.id}" data-course-id="${p.course_id}" data-price="${p.price_per_lesson}">
                <span class="course-price-name">${this.escapeHtml(p.course_name)}</span>
                <span class="course-price-value">${p.price_per_lesson} ₽</span>
            </div>
        `).join('');

        this.listContainer.querySelectorAll('.course-price-row').forEach(row => {
            row.addEventListener('click', () => {
                const priceId = parseInt(row.dataset.priceId, 10);   // ДОБАВЛЕНО
                const courseId = parseInt(row.dataset.courseId, 10);
                const price = parseInt(row.dataset.price, 10);
                this.modal.open({ priceId, courseId, price });        // ИЗМЕНЕНО: передаём priceId
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}