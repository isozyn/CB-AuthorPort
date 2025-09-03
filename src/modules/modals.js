/**
 * Modal components and functionality
 */

import { generateBookDescription } from './apiService.js';

/**
 * Base modal class for common functionality
 */
class BaseModal {
  constructor(modalId, modalClass) {
    this.modalId = modalId;
    this.modalClass = modalClass;
    this.modal = null;
  }

  /**
   * Show the modal
   */
  show() {
    if (!this.modal) {
      this.modal = this.createElement();
      document.body.appendChild(this.modal);
    }
    
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  /**
   * Hide the modal
   */
  hide() {
    if (this.modal) {
      this.modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  }

  /**
   * Create modal element - to be implemented by subclasses
   */
  createElement() {
    throw new Error('createElement method must be implemented by subclass');
  }
}

/**
 * Featured Books Modal
 */
export class FeaturedBooksModal extends BaseModal {
  constructor() {
    super('featuredBookModal', 'featured-book-modal');
    this.setupEventListeners();
  }

  /**
   * Setup global event listeners
   */
  setupEventListeners() {
    // Close modal on Escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.hide();
      }
    });

    // Make close function globally accessible
    window.closeFeaturedBookModal = () => this.hide();
  }

  /**
   * Setup modal-specific event listeners after modal is created
   */
  setupModalEventListeners() {
    if (!this.modal) return;

    // Close button
    const closeButton = this.modal.querySelector('.modal-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.hide());
    }

    // Overlay click
    const overlay = this.modal.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.hide());
    }
  }

  /**
   * Show modal with book data
   * @param {Object} book - Book object
   */
  showWithBook(book) {
    this.show();
    this.setupModalEventListeners(); // Setup event listeners after modal is created
    this.populateContent(book);
  }

  /**
   * Create modal element
   * @returns {HTMLElement} Modal element
   */
  createElement() {
    const modal = document.createElement('div');
    modal.id = this.modalId;
    modal.className = this.modalClass;
    
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <button class="modal-close">&times;</button>
        <div class="modal-body">
          <div class="modal-image">
            <img id="featuredModalBookCover" src="" alt="Book Cover">
          </div>
          <div class="modal-info">
            <h2 id="featuredModalBookTitle"></h2>
            <p class="modal-author">by J.K. Rowling</p>
            <div class="modal-details">
              <div class="detail-item">
                <strong>Publication Year:</strong>
                <span id="featuredModalBookYear"></span>
              </div>
              <div class="detail-item" id="featuredModalSubjectsContainer">
                <strong>Subjects:</strong>
                <div id="featuredModalSubjects" class="modal-subjects"></div>
              </div>
              <div class="detail-item" id="featuredModalDescriptionContainer">
                <strong>Description:</strong>
                <p id="featuredModalDescription"></p>
              </div>
            </div>
            <div class="modal-actions">
              <a id="featuredModalAmazonLink" href="" target="_blank" rel="noopener noreferrer" class="buy-btn amazon-btn">
                <span class="amazon-icon">📚</span>
                Buy on Amazon
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
    
    return modal;
  }

  /**
   * Populate modal with book data
   * @param {Object} book - Book object
   */
  populateContent(book) {
    // Cover image
    const coverUrl = book.covers && book.covers[0] 
      ? `https://covers.openlibrary.org/b/id/${book.covers[0]}-L.jpg`
      : '/public/vite.svg';
    
    document.getElementById('featuredModalBookCover').src = coverUrl;
    document.getElementById('featuredModalBookTitle').textContent = book.title;
    document.getElementById('featuredModalBookYear').textContent = book.first_publish_date || 'Unknown';
    
    // Subjects
    this.populateSubjects(book.subjects);
    
    // Description
    this.populateDescription(book);
    
    // Amazon link
    const amazonSearchQuery = encodeURIComponent(`${book.title} J.K. Rowling`);
    const amazonUrl = `https://www.amazon.com/s?k=${amazonSearchQuery}&i=stripbooks&ref=nb_sb_noss`;
    document.getElementById('featuredModalAmazonLink').href = amazonUrl;
  }

  /**
   * Populate subjects section
   * @param {Array} subjects - Array of subject strings
   */
  populateSubjects(subjects) {
    const subjectsContainer = document.getElementById('featuredModalSubjectsContainer');
    const subjectsDiv = document.getElementById('featuredModalSubjects');
    
    if (subjects && subjects.length > 0) {
      subjectsDiv.innerHTML = subjects.slice(0, 10).map(subject => 
        `<span class="subject-tag">${subject}</span>`
      ).join('');
      subjectsContainer.style.display = 'block';
    } else {
      subjectsContainer.style.display = 'none';
    }
  }

  /**
   * Populate description section
   * @param {Object} book - Book object
   */
  populateDescription(book) {
    const descriptionElement = document.getElementById('featuredModalDescription');
    
    if (book.description) {
      descriptionElement.textContent = book.description;
    } else {
      // Show loading state and generate AI description
      descriptionElement.innerHTML = '<div class="description-loading"><div class="spinner-small"></div>Generating description...</div>';
      
      // Create book object for AI description
      const bookForAI = {
        title: book.title,
        subject: book.subjects || [],
        first_publish_year: book.first_publish_date,
        cover_i: book.covers && book.covers[0] ? book.covers[0] : null
      };
      
      generateBookDescription(bookForAI)
        .then(description => {
          descriptionElement.textContent = description;
        })
        .catch(error => {
          console.error('Error generating description:', error);
          descriptionElement.textContent = 'A captivating work by J.K. Rowling that has enchanted readers worldwide.';
        });
    }
  }
}

/**
 * Books Page Modal (for books.html)
 */
export class BooksPageModal extends BaseModal {
  constructor(booksPageManager = null) {
    super('bookModal', 'book-modal');
    this.booksPageManager = booksPageManager; // Reference to get cached descriptions
    this.setupEventListeners();
  }

  /**
   * Setup global event listeners
   */
  setupEventListeners() {
    // Close modal on Escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.hide();
      }
    });

    // Make functions globally accessible
    window.showBookDetails = (book) => this.showWithBook(book);
    window.closeBookModal = () => this.hide();
  }

  /**
   * Setup modal-specific event listeners after modal is created
   */
  setupModalEventListeners() {
    if (!this.modal) return;

    // Close button
    const closeButton = this.modal.querySelector('.modal-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.hide());
    }

    // Overlay click
    const overlay = this.modal.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.hide());
    }
  }

  /**
   * Show modal with book data
   * @param {Object} book - Book object
   */
  showWithBook(book) {
    this.show();
    this.setupModalEventListeners(); // Setup event listeners after modal is created
    this.populateContent(book);
  }

  /**
   * Create modal element
   * @returns {HTMLElement} Modal element
   */
  createElement() {
    const modal = document.createElement('div');
    modal.id = this.modalId;
    modal.className = this.modalClass;
    
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <button class="modal-close">&times;</button>
        <div class="modal-body">
          <div class="modal-image">
            <img id="modalBookCover" src="" alt="Book Cover">
          </div>
          <div class="modal-info">
            <h2 id="modalBookTitle"></h2>
            <p class="modal-author">by J.K. Rowling</p>
            <div class="modal-details">
              <div class="detail-item">
                <strong>Publication Year:</strong>
                <span id="modalBookYear"></span>
              </div>
              <div class="detail-item">
                <strong>First Published:</strong>
                <span id="modalFirstPublished"></span>
              </div>
              <div class="detail-item" id="modalLanguageContainer">
                <strong>Languages:</strong>
                <span id="modalLanguages"></span>
              </div>
              <div class="detail-item" id="modalPublisherContainer">
                <strong>Publishers:</strong>
                <span id="modalPublishers"></span>
              </div>
              <div class="detail-item" id="modalSubjectsContainer">
                <strong>Subjects:</strong>
                <div id="modalSubjects" class="modal-subjects"></div>
              </div>
              <div class="detail-item" id="modalDescriptionContainer">
                <strong>Description:</strong>
                <p id="modalDescription"></p>
              </div>
            </div>
            <div class="modal-actions">
              <a id="modalAmazonLink" href="" target="_blank" rel="noopener noreferrer" class="buy-btn amazon-btn">
                <span class="amazon-icon">📚</span>
                Buy on Amazon
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
    
    return modal;
  }

  /**
   * Populate modal with book data
   * @param {Object} book - Book object
   */
  populateContent(book) {
    // Cover image
    const coverUrl = book.cover_i 
      ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
      : 'https://via.placeholder.com/400x600/f0f0f0/666?text=No+Cover';
    
    document.getElementById('modalBookCover').src = coverUrl;
    document.getElementById('modalBookTitle').textContent = book.title;
    document.getElementById('modalBookYear').textContent = book.first_publish_year || 'Unknown';
    document.getElementById('modalFirstPublished').textContent = book.first_publish_year || 'Unknown';
    
    // Languages
    this.populateLanguages(book.language);
    
    // Publishers
    this.populatePublishers(book.publisher);
    
    // Subjects
    this.populateSubjects(book.subject);
    
    // Description
    this.populateDescription(book);
    
    // Amazon link
    const amazonSearchQuery = encodeURIComponent(`${book.title} J.K. Rowling`);
    const amazonUrl = `https://www.amazon.com/s?k=${amazonSearchQuery}&i=stripbooks&ref=nb_sb_noss`;
    document.getElementById('modalAmazonLink').href = amazonUrl;
  }

  /**
   * Populate languages section
   * @param {Array} languages - Array of language codes
   */
  populateLanguages(languages) {
    const languageContainer = document.getElementById('modalLanguageContainer');
    
    if (languages && languages.length > 0) {
      document.getElementById('modalLanguages').textContent = languages.slice(0, 5).join(', ');
      languageContainer.style.display = 'block';
    } else {
      languageContainer.style.display = 'none';
    }
  }

  /**
   * Populate publishers section
   * @param {Array} publishers - Array of publisher names
   */
  populatePublishers(publishers) {
    const publisherContainer = document.getElementById('modalPublisherContainer');
    
    if (publishers && publishers.length > 0) {
      document.getElementById('modalPublishers').textContent = publishers.slice(0, 3).join(', ');
      publisherContainer.style.display = 'block';
    } else {
      publisherContainer.style.display = 'none';
    }
  }

  /**
   * Populate subjects section
   * @param {Array} subjects - Array of subject strings
   */
  populateSubjects(subjects) {
    const subjectsContainer = document.getElementById('modalSubjectsContainer');
    const subjectsDiv = document.getElementById('modalSubjects');
    
    if (subjects && subjects.length > 0) {
      subjectsDiv.innerHTML = subjects.slice(0, 10).map(subject => 
        `<span class="subject-tag">${subject}</span>`
      ).join('');
      subjectsContainer.style.display = 'block';
    } else {
      subjectsContainer.style.display = 'none';
    }
  }

  /**
   * Populate description section
   * @param {Object} book - Book object
   */
  populateDescription(book) {
    const descriptionElement = document.getElementById('modalDescription');
    
    // Try to get cached description first
    let cachedDescription = null;
    if (this.booksPageManager) {
      cachedDescription = this.booksPageManager.getCachedDescription(book);
    }
    
    if (cachedDescription) {
      // Use cached description immediately
      descriptionElement.textContent = cachedDescription;
    } else {
      // Show loading state and generate description
      descriptionElement.innerHTML = '<div class="description-loading"><div class="spinner-small"></div>Generating description...</div>';
      
      // Generate description using Hugging Face API
      generateBookDescription(book)
        .then(description => {
          descriptionElement.textContent = description;
          
          // Cache the description for future use
          if (this.booksPageManager) {
            const cacheKey = this.booksPageManager.getBookCacheKey(book);
            this.booksPageManager.descriptionCache.set(cacheKey, description);
          }
        })
        .catch(error => {
          console.error('Error generating description:', error);
          // Fallback description
          let fallbackDescription = '';
          if (book.subtitle) {
            fallbackDescription = book.subtitle;
          } else if (book.subject && book.subject.length > 0) {
            fallbackDescription = `A captivating work exploring themes of ${book.subject.slice(0, 3).join(', ')}.`;
          } else {
            fallbackDescription = 'A captivating work by J.K. Rowling that has enchanted readers worldwide.';
          }
          descriptionElement.textContent = fallbackDescription;
        });
    }
  }
}
