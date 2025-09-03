/**
 * Utility functions for the application
 */

/**
 * Safe event binding utility
 * @param {HTMLElement} element - The element to bind the event to
 * @param {string} eventType - The type of event to listen for
 * @param {Function} handler - The event handler function
 */
export function addEvent(element, eventType, handler) {
  element?.addEventListener(eventType, handler);
}

/**
 * Generate a unique ID
 * @param {string} prefix - Prefix for the ID
 * @returns {string} Unique ID
 */
export function generateUniqueId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Debounce function to limit function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Format text for safe HTML insertion
 * @param {string} text - Text to format
 * @returns {string} Formatted text
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
