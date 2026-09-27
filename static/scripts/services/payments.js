/**
 * Сервис работы с оплатами ученика.
 */
export class PaymentsService {
    constructor(studentId, paymentModal,onChanged = null) {
        this.studentId = studentId;
        this.modal = paymentModal;
        this.listContainer = document.getElementById('payments-list');

        this.onChanged = onChanged;

        // Прокидываем студента и callback
        this.modal.setStudent(this.studentId, () => {
            this.loadAndRender();
            if (this.onChanged) this.onChanged();
        });
    }

    async loadAndRender() {
        if (!this.listContainer) return;

        try {
            const response = await fetch(
                `/api/load-payments/?student_id=${this.studentId}`,
                { cache: 'no-store', headers: { 'X-Requested-With': 'XMLHttpRequest' } }
            );
            const data = await response.json();

            if (data.status === 'success') {
                this.render(data.payments);
            } else {
                this.listContainer.innerHTML = `<div class="payments-empty">${data.message || 'Ошибка загрузки'}</div>`;
            }
        } catch (error) {
            console.error('❌ Ошибка load-payments:', error);
            this.listContainer.innerHTML = '<div class="payments-empty">Ошибка сети</div>';
        }
    }

    render(payments) {
        if (!payments || payments.length === 0) {
            this.listContainer.innerHTML = '<div class="payments-empty">Оплат пока нет</div>';
            return;
        }

        this.listContainer.innerHTML = payments.map(p => `
            <div class="payment-row" data-id="${p.id}" data-course-id="${p.course_id}" data-amount="${p.amount}" data-date="${p.operation_date}">
                <div class="payment-info">
                    <span class="payment-course">${this.escapeHtml(p.course_name)}</span>
                    <span class="payment-date">${this.formatDate(p.operation_date)}</span>
                </div>
                <span class="payment-amount">+${p.amount} ₽</span>
            </div>
        `).join('');

        // Клик по строке — открыть модалку с предзаполнением (как у цен)
        this.listContainer.querySelectorAll('.payment-row').forEach(row => {
            row.addEventListener('click', () => {
                this.modal.open({
                    id: parseInt(row.dataset.id, 10),
                    course_id: parseInt(row.dataset.courseId, 10),
                    amount: parseInt(row.dataset.amount, 10),
                    operation_date: row.dataset.date,
                });
            });
        });
    }

    formatDate(isoDate) {
        const [y, m, d] = isoDate.split('-');
        return `${d}.${m}.${y}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}