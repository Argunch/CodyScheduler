/**
 * Сервис баланса ученика. Загружает сводку и рендерит её.
 */
export class BalanceService {
    constructor(studentId) {
        this.studentId = studentId;
        this.totalEl = document.getElementById('balance-total');
        this.byCourseEl = document.getElementById('balance-by-course');
    }

    async loadAndRender() {
        try {
            const response = await fetch(
                `/api/load-student-balance/?student_id=${this.studentId}`,
                { cache: 'no-store', headers: { 'X-Requested-With': 'XMLHttpRequest' } }
            );
            const data = await response.json();

            if (data.status === 'success') {
                this.render(data);
            } else {
                console.error('Ошибка баланса:', data.message);
            }
        } catch (error) {
            console.error('❌ Ошибка load-student-balance:', error);
        }
    }

    render(data) {
        // Общий баланс
        if (this.totalEl) {
            this.totalEl.textContent = `${data.total_balance} ₽`;
            this.totalEl.classList.remove('negative');
            if (data.total_balance < 0) {
                this.totalEl.classList.add('negative');
            }
        }

        // По курсам
        if (!this.byCourseEl) return;

        if (!data.by_course || data.by_course.length === 0) {
            this.byCourseEl.innerHTML = '<div class="balance-empty">Нет данных по курсам</div>';
            return;
        }

        this.byCourseEl.innerHTML = data.by_course.map(c => {
            const sign = c.balance < 0 ? 'negative' : (c.balance === 0 ? 'zero' : 'positive');
            const lessonsText = this.formatLessons(c);
            return `
                <div class="balance-course-row">
                    <div class="balance-course-info">
                        <span class="balance-course-name">${this.escapeHtml(c.course_name)}</span>
                        <span class="balance-course-lessons">${lessonsText}</span>
                    </div>
                    <span class="balance-course-amount ${sign}">${c.balance} ₽</span>
                </div>
            `;
        }).join('');
    }

    formatLessons(c) {
        if (c.price_per_lesson <= 0) {
            return 'цена не задана';
        }
        const paid = c.paid_lessons ?? 0;
        const conducted = c.conducted_lessons ?? 0;
        return `Оплачено ${paid}, проведено ${conducted}, осталось ${c.remaining_lessons ?? 0}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}