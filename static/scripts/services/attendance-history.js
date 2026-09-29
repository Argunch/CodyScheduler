/**
 * Сервис истории посещаемости ученика.
 */
export class AttendanceHistoryService {
    constructor(studentId) {
        this.studentId = studentId;
        this.listContainer = document.getElementById('attendance-history-list');
    }

    async loadAndRender() {
        if (!this.listContainer) return;

        try {
            const response = await fetch(
                `/api/load-student-attendance/?student_id=${this.studentId}`,
                { cache: 'no-store', headers: { 'X-Requested-With': 'XMLHttpRequest' } }
            );
            const data = await response.json();

            if (data.status === 'success') {
                this.render(data.records);
            } else {
                this.listContainer.innerHTML =
                    `<div class="attendance-history-empty">${data.message || 'Ошибка загрузки'}</div>`;
            }
        } catch (error) {
            console.error('❌ Ошибка load-student-attendance:', error);
            this.listContainer.innerHTML =
                '<div class="attendance-history-empty">Ошибка сети</div>';
        }
    }

    render(records) {
        if (!records || records.length === 0) {
            this.listContainer.innerHTML = '<div class="attendance-history-empty">Занятий пока нет</div>';
            return;
        }

        this.listContainer.innerHTML = records.map(r => {
            const dateLabel = this.formatDate(r.date);
            const timeLabel = r.time;

            const statusClass = r.was_present ? 'present' : 'absent';
            const statusText  = r.was_present ? '✓ Был' : '✗ Не был';

            const chargedText = r.charged > 0 ? `−${r.charged} ₽` : '';

            // ИЗМЕНЕНО: курс — главный, дата/время — второстепенное
            const title = r.course_name || 'Без курса';

            return `
                <div class="attendance-history-row">
                    <div class="attendance-history-info">
                        <span class="attendance-history-course">${this.escapeHtml(title)}</span>
                        <span class="attendance-history-meta">${dateLabel} · ${timeLabel}</span>
                    </div>
                    <div class="attendance-history-right">
                        <span class="attendance-history-status ${statusClass}">${statusText}</span>
                        ${chargedText ? `<span class="attendance-history-charged">${chargedText}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    formatDate(iso) {
        const [y, m, d] = iso.split('-');
        return `${d}.${m}.${y}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}