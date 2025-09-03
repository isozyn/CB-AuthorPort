/**
 * Featured Books Carousel functionality
 */

import { fetchBooksFromOpenLibrary } from './apiService.js';
import { FeaturedBooksModal } from './modals.js';

/**
 * Featured Books Carousel Manager
 */
export class FeaturedBooksCarousel {
  constructor() {
    this.container = null;
    this.loading = null;
    this.error = null;
    this.wrapper = null;
    this.booksData = [];
    this.modal = new FeaturedBooksModal();
    this.autoScrollInterval = null;
    this.currentPosition = 0;
    this.autoScrollDirection = 1;
    this.isUserInteracting = false;
    
    this.setupGlobalFunctions();
  }

  /**
   * Setup global functions for onclick handlers
   */
  setupGlobalFunctions() {
    window.openFeaturedBookDetails = (bookIndex) => this.openBookDetails(bookIndex);
    window.scrollFeaturedBooks = (direction) => this.manualScroll(direction);
    window.retryLoadFeaturedBooks = () => this.loadBooks();
  }

  /**
   * Initialize the carousel
   */
  async init() {
    this.getElements();
    
    if (!this.validateElements()) {
      console.log('Featured books elements not found');
      return;
    }
    
    await this.loadBooks();
  }

  /**
   * Get DOM elements
   */
  getElements() {
    this.container = document.getElementById('featured-books-container');
    this.loading = document.getElementById('featured-books-loading');
    this.error = document.getElementById('featured-books-error');
    this.wrapper = document.getElementById('featured-books-wrapper');
  }

  /**
   * Validate required elements exist
   * @returns {boolean} True if all elements found
   */
  validateElements() {
    return this.container && this.loading && this.error && this.wrapper;
  }

  /**
   * Load books from API
   */
  async loadBooks() {
    try {
      this.showLoading();
      
      const data = await fetchBooksFromOpenLibrary('OL23919A', 50);
      
      if (!data.entries || data.entries.length === 0) {
        throw new Error('No books found');
      }
      
      const filteredBooks = this.filterBooks(data.entries);
      const selectedBooks = this.selectRandomBooks(filteredBooks, 8);
      
      this.booksData = selectedBooks;
      this.hideLoading();
      this.displayBooks(selectedBooks);
      this.initCarouselFunctionality();
      
    } catch (error) {
      console.error('Error loading featured books:', error);
      this.showError();
    }
  }

  /**
   * Filter books to exclude invalid entries
   * @param {Array} books - Raw books array
   * @returns {Array} Filtered books
   */
  filterBooks(books) {
    return books.filter(book => 
      book.title && 
      !book.title.toLowerCase().includes('untitled') &&
      book.covers && book.covers.length > 0
    );
  }

  /**
   * Select random books from filtered list
   * @param {Array} books - Filtered books array
   * @param {number} count - Number of books to select
   * @returns {Array} Selected books
   */
  selectRandomBooks(books, count) {
    return books.sort(() => 0.5 - Math.random()).slice(0, count);
  }

  /**
   * Display books in carousel
   * @param {Array} books - Books to display
   */
  displayBooks(books) {
    this.container.innerHTML = books.map((book, index) => {
      const coverUrl = book.covers && book.covers[0] 
        ? `https://covers.openlibrary.org/b/id/${book.covers[0]}-L.jpg`
        : '/public/vite.svg';
      
      return `
        <div class="featured-book-card" data-book-index="${index}" onclick="openFeaturedBookDetails(${index})">
          <div class="featured-book-image">
            <img src="${coverUrl}" alt="${book.title}" onerror="this.src='/public/vite.svg'">
          </div>
          <div class="featured-book-content">
            <h3>${book.title}</h3>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Initialize carousel scrolling functionality
   */
  initCarouselFunctionality() {
    if (!this.container) return;

    // Setup hover events
    this.container.addEventListener('mouseenter', () => {
      this.isUserInteracting = true;
      this.stopAutoScroll();
    });

    this.container.addEventListener('mouseleave', () => {
      this.isUserInteracting = false;
      this.startAutoScroll();
    });

    // Handle manual scrolling
    this.container.addEventListener('scroll', () => {
      this.currentPosition = this.container.scrollLeft;
    });

    // Start auto-scroll
    this.startAutoScroll();
  }

  /**
   * Start automatic scrolling
   */
  startAutoScroll() {
    this.autoScrollInterval = setInterval(() => {
      if (!this.isUserInteracting) {
        this.performAutoScroll();
      }
    }, 3000);
  }

  /**
   * Stop automatic scrolling
   */
  stopAutoScroll() {
    if (this.autoScrollInterval) {
      clearInterval(this.autoScrollInterval);
    }
  }

  /**
   * Perform automatic scroll step
   */
  performAutoScroll() {
    const cardWidth = 316; // 300px card + 16px gap
    const maxScroll = this.container.scrollWidth - this.container.clientWidth;
    
    if (this.autoScrollDirection === 1) {
      // Scrolling right
      if (this.currentPosition >= maxScroll) {
        this.autoScrollDirection = -1;
      } else {
        this.currentPosition += cardWidth;
        if (this.currentPosition > maxScroll) this.currentPosition = maxScroll;
      }
    } else {
      // Scrolling left
      if (this.currentPosition <= 0) {
        this.autoScrollDirection = 1;
      } else {
        this.currentPosition -= cardWidth;
        if (this.currentPosition < 0) this.currentPosition = 0;
      }
    }
    
    this.container.scrollTo({
      left: this.currentPosition,
      behavior: 'smooth'
    });
  }

  /**
   * Handle manual scroll
   * @param {string} direction - 'next' or 'prev'
   */
  manualScroll(direction) {
    this.isUserInteracting = true;
    this.stopAutoScroll();
    
    const cardWidth = 316;
    const maxScroll = this.container.scrollWidth - this.container.clientWidth;
    
    if (direction === 'next') {
      this.currentPosition += cardWidth;
      if (this.currentPosition > maxScroll) this.currentPosition = maxScroll;
    } else {
      this.currentPosition -= cardWidth;
      if (this.currentPosition < 0) this.currentPosition = 0;
    }
    
    this.container.scrollTo({
      left: this.currentPosition,
      behavior: 'smooth'
    });
    
    // Resume auto-scroll after user interaction
    setTimeout(() => {
      this.isUserInteracting = false;
      this.startAutoScroll();
    }, 5000);
  }

  /**
   * Open book details modal
   * @param {number} bookIndex - Index of book in booksData array
   */
  openBookDetails(bookIndex) {
    if (!this.booksData[bookIndex]) {
      console.error('Book data not found for index:', bookIndex);
      return;
    }
    
    const book = this.booksData[bookIndex];
    this.modal.showWithBook(book);
  }

  /**
   * Show loading state
   */
  showLoading() {
    this.loading.style.display = 'flex';
    this.error.style.display = 'none';
    this.wrapper.style.display = 'none';
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    this.loading.style.display = 'none';
    this.wrapper.style.display = 'block';
  }

  /**
   * Show error state
   */
  showError() {
    this.loading.style.display = 'none';
    this.error.style.display = 'block';
  }
}
