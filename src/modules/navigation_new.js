/**
 * Navigation and UI components
 */

import { addEvent } from './utils.js';

/**
 * Navigation Manager Class
 */
export class Navigation {
  constructor() {
    this.headerLoaded = false;
  }

  /**
   * Initialize all navigation components
   */
  async init() {
    await this.loadHeader();
    this.initHamburgerMenu();
    this.initBackToTop();
    this.preventReloadOnCurrentPage();
  }

  /**
   * Initialize hamburger menu functionality
   * @param {string} hamburgerId - ID of hamburger button
   * @param {string} navbarId - ID of navbar element
   */
  initHamburgerMenu(hamburgerId = 'hamburger', navbarId = 'navbar') {
    const hamburger = document.getElementById(hamburgerId);
    const navbar = document.getElementById(navbarId);

    addEvent(hamburger, 'click', () => {
      navbar?.classList.toggle('show');
    });
  }

  /**
   * Initialize back to top button functionality
   * @param {string} btnId - ID of back to top button
   * @param {number} threshold - Scroll threshold in pixels
   */
  initBackToTop(btnId = 'backToTop', threshold = 300) {
    const backToTopButton = document.getElementById(btnId);

    addEvent(window, 'scroll', () => {
      if (!backToTopButton) return;
      backToTopButton.classList.toggle('visible', window.scrollY > threshold);
    });

    addEvent(backToTopButton, 'click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /**
   * Load header component
   * @param {string} placeholderId - ID of placeholder element
   * @param {string} url - URL of header HTML file
   */
  async loadHeader(placeholderId = 'header-placeholder', url = 'partials/header.html') {
    try {
      const response = await fetch(url);
      const html = await response.text();
      
      const placeholder = document.getElementById(placeholderId);
      if (placeholder) {
        placeholder.innerHTML = html;
        this.headerLoaded = true;
      }
    } catch (error) {
      console.error('Failed to load header:', error);
    }
  }

  /**
   * Prevent reload on current page links
   */
  preventReloadOnCurrentPage() {
    const links = document.querySelectorAll("a[href]");

    links.forEach(link => {
      addEvent(link, "click", (e) => {
        const currentUrl = window.location.pathname + window.location.search + window.location.hash;
        const linkUrl = new URL(link.href, window.location.origin);
        const targetPath = linkUrl.pathname + linkUrl.search + linkUrl.hash;

        // Compare normalized paths
        if (currentUrl === targetPath) {
          e.preventDefault(); // stop reload
          console.log("Already on this page/section:", targetPath);
        }
      });
    });
  }
}
