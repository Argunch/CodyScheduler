export const TIME_CONFIG = {
    MIN_HOUR: 7,
    MAX_HOUR: 20,
    showAllHours: false
};

export function shouldShowHour(hour) {
    return TIME_CONFIG.showAllHours || (hour >= TIME_CONFIG.MIN_HOUR && hour <= TIME_CONFIG.MAX_HOUR);
}