function initMobileViewToggle(updateOverlayCallback) {
    const toggleLabel = document.getElementById('mobile-view-toggle');
    const toggleCheckbox = document.querySelector('#mobile-view-toggle input[type="checkbox"]');

    if (!toggleLabel) return;

    // Функция переключения должна быть объявлена ДО добавления обработчиков
    const toggleMobileView = () => {
        const body = document.body;
        const currentCheckbox = document.querySelector('#mobile-view-toggle input[type="checkbox"]');

        body.classList.toggle('expanded-view');
        currentCheckbox.checked = body.classList.contains('expanded-view');

        setTimeout(() => {
            if (typeof updateOverlayCallback === 'function') {
                updateOverlayCallback();
            }
        }, 50);

        localStorage.setItem('mobileViewExpanded', body.classList.contains('expanded-view'));
    };

    // Восстанавливаем состояние из localStorage
    const isExpanded = localStorage.getItem('mobileViewExpanded') === 'true';
    if (isExpanded) {
        document.body.classList.add('expanded-view');
        toggleCheckbox.checked = true;
    }

    // Добавляем обработчики
    toggleLabel.addEventListener('click', function(event) {
        // Предотвращаем двойное срабатывание от клика по checkbox
        if (event.target !== toggleCheckbox) {
            event.preventDefault();
            toggleMobileView();
        }
    });

    toggleCheckbox.addEventListener('change', function(event) {
        event.stopPropagation();
        toggleMobileView();
    });
}

export { initMobileViewToggle };