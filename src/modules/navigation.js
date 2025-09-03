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
    this.isTransitioning = false;
  }

  /**
   * Initialize all navigation components
   */
  async init() {
    await this.loadHeader();
    this.initBackToTop();
    this.preventReloadOnCurrentPage();
    this.setupPageTransitions();
    this.addPageLoadAnimation();
  }

  /**
   * Setup smooth page transitions
   */
  setupPageTransitions() {
    // Intercept all navigation link clicks
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (!link || this.isTransitioning) return;
      
      const href = link.getAttribute('href');
      
      // Only handle internal navigation
      if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) {
        return;
      }
      
      // Don't handle if it's the current page
      const currentPage = window.location.pathname.split('/').pop() || 'index.html';
      const targetPage = href.split('/').pop();
      
      if (currentPage === targetPage) {
        event.preventDefault();
        return;
      }
      
      // Perform smooth transition
      event.preventDefault();
      this.performPageTransition(href);
    });
  }

  /**
   * Add initial page load animation
   */
  addPageLoadAnimation() {
    // Add fade-in animation to body on page load
    document.body.classList.add('page-transition-enter');
    
    // Trigger the animation
    requestAnimationFrame(() => {
      document.body.classList.add('page-transition-enter-active');
      document.body.classList.remove('page-transition-enter');
    });
    
    // Clean up classes after animation
    setTimeout(() => {
      document.body.classList.remove('page-transition-enter-active');
    }, 400);
  }

  /**
   * Perform smooth page transition
   * @param {string} href - Target page URL
   */
  async performPageTransition(href) {
    if (this.isTransitioning) return;
    
    this.isTransitioning = true;
    
    try {
      // Add exit animation
      document.body.classList.add('page-transition-exit');
      
      // Wait for exit animation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      document.body.classList.add('page-transition-exit-active');
      document.body.classList.remove('page-transition-exit');
      
      // Wait for exit animation to complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Navigate to new page
      window.location.href = href;
      
    } catch (error) {
      console.error('Page transition error:', error);
      // Fallback to normal navigation
      window.location.href = href;
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Initialize hamburger menu functionality
   * @param {string} hamburgerId - ID of hamburger button
   * @param {string} navId - ID of nav element
   */
  initHamburgerMenu(hamburgerId = 'hamburger', navId = 'navbar') {
    const hamburger = document.getElementById(hamburgerId);
    const nav = document.getElementById(navId);
    const navList = nav?.querySelector('ul');

    if (!hamburger) {
      console.warn('Hamburger button not found');
      return;
    }
    
    if (!navList) {
      console.warn('Navigation list not found');
      return;
    }

    addEvent(hamburger, 'click', () => {
      navList.classList.toggle('show');
      console.log('Hamburger clicked, show class toggled');
    });
    
    console.log('Hamburger menu initialized successfully');
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
        
        // Re-initialize hamburger menu after header loads
        setTimeout(() => {
          this.initHamburgerMenu();
        }, 100);
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
