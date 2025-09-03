/**
 * Books page functionality
 */

import { fetchDetailedJKRowlingBooks, generateBookDescription } from './apiService.js';
import { BooksPageModal } from './modals.js';
import { addEvent, debounce, escapeHtml } from './utils.js';

/**
 * Books Page Manager
 */
export class BooksPageManager {
  constructor() {
    this.elements = {};
    this.allBooks = [];
    this.filteredBooks = [];
    this.currentFilters = {
      search: '',
      language: '',
      year: '',
      genre: ''
    };
    this.modal = new BooksPageModal(this); // Pass reference to this manager
    this.debouncedSearch = debounce((query) => this.searchBooks(query), 300);
    this.debouncedFilter = debounce(() => this.applyFilters(), 100);
    
    // Performance optimizations
    this.descriptionCache = new Map(); // Cache for generated descriptions
    this.isPreGeneratingDescriptions = false; // Flag to prevent multiple pre-generation calls
  }

  /**
   * Initialize the books page
   */
  async init() {
    this.getElements();
    
    if (!this.elements.booksContainer) {
      console.log('Not on books page');
      return;
    }
    
    this.setupEventListeners();
    await this.fetchBooks();
  }

  /**
   * Get DOM elements
   */
  getElements() {
    this.elements = {
      loading: document.getElementById('loading'),
      error: document.getElementById('error'),
      booksContainer: document.getElementById('books-container'),
      retryBtn: document.getElementById('retry-btn'),
      searchInput: document.getElementById('bookSearch'),
      clearBtn: document.getElementById('clearSearch'),
      searchResults: document.getElementById('searchResults'),
      languageFilter: document.getElementById('languageFilter'),
      yearFilter: document.getElementById('yearFilter'),
      genreFilter: document.getElementById('genreFilter'),
      clearFiltersBtn: document.getElementById('clearFilters')
    };
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Retry button
    if (this.elements.retryBtn) {
      addEvent(this.elements.retryBtn, 'click', () => this.fetchBooks());
    }

    // Search functionality
    if (this.elements.searchInput) {
      addEvent(this.elements.searchInput, 'input', (event) => {
        this.currentFilters.search = event.target.value;
        this.debouncedFilter();
      });

      addEvent(this.elements.searchInput, 'keydown', (event) => {
        if (event.key === 'Escape') {
          this.elements.searchInput.value = '';
          this.currentFilters.search = '';
          this.debouncedFilter();
        }
      });
    }

    // Clear search button
    if (this.elements.clearBtn) {
      addEvent(this.elements.clearBtn, 'click', () => {
        this.elements.searchInput.value = '';
        this.currentFilters.search = '';
        this.debouncedFilter();
        this.elements.searchInput.focus();
      });
    }

    // Filter dropdowns
    if (this.elements.languageFilter) {
      addEvent(this.elements.languageFilter, 'change', (event) => {
        this.currentFilters.language = event.target.value;
        this.debouncedFilter();
      });
    }

    if (this.elements.yearFilter) {
      addEvent(this.elements.yearFilter, 'change', (event) => {
        this.currentFilters.year = event.target.value;
        this.debouncedFilter();
      });
    }

    if (this.elements.genreFilter) {
      addEvent(this.elements.genreFilter, 'change', (event) => {
        this.currentFilters.genre = event.target.value;
        this.debouncedFilter();
      });
    }

    // Clear all filters button
    if (this.elements.clearFiltersBtn) {
      addEvent(this.elements.clearFiltersBtn, 'click', () => {
        this.clearAllFilters();
      });
    }
  }

  /**
   * Fetch books from API
   */
  async fetchBooks() {
    try {
      this.showLoading();
      
      const data = await fetchDetailedJKRowlingBooks(100);
      this.displayBooks(data.books);
      this.showBooks();
      
      // Pre-generate descriptions for better modal performance
      this.preGenerateDescriptions(this.allBooks.slice(0, 10)); // Pre-generate for first 10 books
      
    } catch (error) {
      console.error('Error fetching books:', error);
      this.showError();
    }
  }

  /**
   * Display books in grid
   * @param {Array} books - Array of book objects
   */
  displayBooks(books) {
    const filteredBooks = this.filterBooks(books);
    this.allBooks = filteredBooks;
    this.filteredBooks = filteredBooks;
    this.populateFilterDropdowns();
    this.applyFilters();
  }

  /**
   * Filter books to remove duplicates and irrelevant entries
   * @param {Array} books - Raw books array
   * @returns {Array} Filtered books
   */
  filterBooks(books) {
    const seenTitles = new Set();
    
    return books
      .filter(book => book.title && book.first_publish_year)
      .filter(book => {
        const title = book.title.toLowerCase().trim();
        
        if (seenTitles.has(title)) {
          return false;
        }
        seenTitles.add(title);
        
        return !this.isExcludedTitle(title);
      })
      .sort((a, b) => {
        const yearDiff = (b.first_publish_year || 0) - (a.first_publish_year || 0);
        if (yearDiff !== 0) return yearDiff;
        return a.title.localeCompare(b.title);
      });
  }

  /**
   * Check if title should be excluded
   * @param {string} title - Book title in lowercase
   * @returns {boolean} True if should be excluded
   */
  isExcludedTitle(title) {
    const excludedTerms = [
      'large print', 'audio book', 'audiobook', '[microform]', 'braille',
      'box set', 'boxset', 'collection', 'complete series', 'complete set',
      'books 1-', 'books 1 ', 'volumes 1-', 'hardcover box set',
      'paperback box set', 'gift set', 'omnibus', 'anthology', 'collector',
      'special edition set', 'deluxe edition set', 'library set',
      'school set', 'classroom set'
    ];
    
    return excludedTerms.some(term => title.includes(term)) || title.length <= 2;
  }

  /**
   * Display filtered books with optimized rendering
   * @param {Array} books - Filtered books array
   */
  displayFilteredBooks(books) {
    const container = this.elements.booksContainer;
    
    // Clear container
    container.innerHTML = '';

    if (books.length === 0) {
      this.showNoResults();
      this.updateBooksCount(0);
      return;
    }

    // Use DocumentFragment for efficient DOM manipulation
    const fragment = document.createDocumentFragment();
    
    // Create all book elements first
    const bookElements = books.map((book, index) => {
      const bookElement = this.createBookElement(book);
      
      // Add staggered animation delay
      if (index < 12) { // Only animate first 12 for performance
        bookElement.style.animationDelay = `${index * 0.05}s`;
      } else {
        // Remove animation for later items to prevent lag
        bookElement.style.animation = 'none';
        bookElement.style.opacity = '1';
      }
      
      return bookElement;
    });
    
    // Batch append to fragment
    bookElements.forEach(element => fragment.appendChild(element));
    
    // Single DOM update
    container.appendChild(fragment);
    
    // Add fade-in class for smooth appearance
    container.classList.add('fade-in');
    
    this.updateBooksCount(books.length);
    
    // Remove fade-in class after animation
    setTimeout(() => {
      container.classList.remove('fade-in');
    }, 500);
  }

  /**
   * Create book element
   * @param {Object} book - Book object
   * @returns {HTMLElement} Book element
   */
  createBookElement(book) {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'book-item';

    const coverId = book.cover_i;
    const coverUrl = coverId 
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : 'https://via.placeholder.com/300x450/f0f0f0/666?text=No+Cover';

    const subjects = book.subject ? book.subject.slice(0, 3) : [];
    const subjectsHtml = subjects.length > 0 
      ? `<div class="book-subjects">
           ${subjects.map(subject => `<span class="subject-tag">${escapeHtml(subject)}</span>`).join('')}
         </div>`
      : '';

    const description = this.generateDescription(book);
    const currentQuery = this.currentFilters.search;
    const titleDisplay = currentQuery ? this.highlightSearchTerm(book.title, currentQuery) : escapeHtml(book.title);
    const descriptionDisplay = currentQuery ? this.highlightSearchTerm(description, currentQuery) : escapeHtml(description);

    bookDiv.innerHTML = `
      <img src="${coverUrl}" alt="${escapeHtml(book.title)}" onerror="this.src='https://via.placeholder.com/300x450/f0f0f0/666?text=No+Cover'">
      <h3>${titleDisplay}</h3>
      <p class="book-year">${book.first_publish_year || 'Unknown'}</p>
      <p class="book-description">${descriptionDisplay}</p>
      ${subjectsHtml}
      <div class="book-actions">
        <button class="details-btn" onclick="showBookDetails(${escapeHtml(JSON.stringify(book))})">
          <span class="details-icon">ℹ️</span>
          View Details
        </button>
      </div>
    `;

    // Add click event listener to the image
    const bookImage = bookDiv.querySelector('img');
    if (bookImage) {
      addEvent(bookImage, 'click', () => {
        this.modal.showWithBook(book);
      });
    }

    return bookDiv;
  }

  /**
   * Generate description for book
   * @param {Object} book - Book object
   * @returns {string} Generated description
   */
  generateDescription(book) {
    if (book.subtitle) {
      return book.subtitle;
    } else if (book.subject && book.subject.length > 0) {
      return `A work exploring themes of ${book.subject.slice(0, 2).join(' and ')}.`;
    } else {
      return 'A captivating work by J.K. Rowling.';
    }
  }

  /**
   * Populate filter dropdowns with available options
   */
  populateFilterDropdowns() {
    this.populateLanguageFilter();
    this.populateYearFilter();
    this.populateGenreFilter();
  }

  /**
   * Populate language filter dropdown
   */
  populateLanguageFilter() {
    if (!this.elements.languageFilter) return;
    
    const languages = new Set();
    this.allBooks.forEach(book => {
      if (book.language && Array.isArray(book.language)) {
        book.language.forEach(lang => {
          if (lang && lang.trim()) {
            languages.add(lang.trim());
          }
        });
      }
    });

    const sortedLanguages = Array.from(languages).sort();
    this.elements.languageFilter.innerHTML = '<option value="">All Languages</option>';
    
    sortedLanguages.forEach(language => {
      const option = document.createElement('option');
      option.value = language;
      option.textContent = this.getLanguageName(language);
      this.elements.languageFilter.appendChild(option);
    });
  }

  /**
   * Get readable language name from code
   * @param {string} langCode - Language code
   * @returns {string} Readable language name
   */
  getLanguageName(langCode) {
    const languageNames = {
      'eng': 'English',
      'en': 'English',
      'english': 'English',
      'fre': 'French',
      'fr': 'French',
      'french': 'French',
      'ger': 'German',
      'de': 'German',
      'german': 'German',
      'spa': 'Spanish',
      'es': 'Spanish',
      'spanish': 'Spanish',
      'ita': 'Italian',
      'it': 'Italian',
      'italian': 'Italian',
      'por': 'Portuguese',
      'pt': 'Portuguese',
      'portuguese': 'Portuguese',
      'rus': 'Russian',
      'ru': 'Russian',
      'russian': 'Russian',
      'jpn': 'Japanese',
      'ja': 'Japanese',
      'japanese': 'Japanese',
      'chi': 'Chinese',
      'zh': 'Chinese',
      'chinese': 'Chinese',
      'ara': 'Arabic',
      'ar': 'Arabic',
      'arabic': 'Arabic',
      'hin': 'Hindi',
      'hi': 'Hindi',
      'hindi': 'Hindi',
      'dut': 'Dutch',
      'nl': 'Dutch',
      'dutch': 'Dutch',
      'swe': 'Swedish',
      'sv': 'Swedish',
      'swedish': 'Swedish',
      'nor': 'Norwegian',
      'no': 'Norwegian',
      'norwegian': 'Norwegian',
      'dan': 'Danish',
      'da': 'Danish',
      'danish': 'Danish',
      'fin': 'Finnish',
      'fi': 'Finnish',
      'finnish': 'Finnish',
      'pol': 'Polish',
      'pl': 'Polish',
      'polish': 'Polish',
      'cze': 'Czech',
      'cs': 'Czech',
      'czech': 'Czech',
      'hun': 'Hungarian',
      'hu': 'Hungarian',
      'hungarian': 'Hungarian',
      'tur': 'Turkish',
      'tr': 'Turkish',
      'turkish': 'Turkish',
      'gre': 'Greek',
      'el': 'Greek',
      'greek': 'Greek',
      'heb': 'Hebrew',
      'he': 'Hebrew',
      'hebrew': 'Hebrew',
      'kor': 'Korean',
      'ko': 'Korean',
      'korean': 'Korean',
      'vie': 'Vietnamese',
      'vi': 'Vietnamese',
      'vietnamese': 'Vietnamese',
      'tha': 'Thai',
      'th': 'Thai',
      'thai': 'Thai'
    };
    
    const lowerCode = langCode.toLowerCase();
    return languageNames[lowerCode] || this.capitalizeFirst(langCode);
  }

  /**
   * Capitalize first letter of a string
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Populate year filter dropdown
   */
  populateYearFilter() {
    if (!this.elements.yearFilter) return;
    
    const years = new Set();
    this.allBooks.forEach(book => {
      if (book.first_publish_year) {
        years.add(book.first_publish_year);
      }
    });

    const sortedYears = Array.from(years).sort((a, b) => b - a);
    this.elements.yearFilter.innerHTML = '<option value="">All Years</option>';
    
    // Group years into decades
    const currentYear = new Date().getFullYear();
    const decades = new Map();
    
    sortedYears.forEach(year => {
      const decade = Math.floor(year / 10) * 10;
      if (!decades.has(decade)) {
        decades.set(decade, []);
      }
      decades.get(decade).push(year);
    });

    Array.from(decades.keys()).sort((a, b) => b - a).forEach(decade => {
      const years = decades.get(decade);
      const optgroup = document.createElement('optgroup');
      optgroup.label = `${decade}s`;
      
      years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        optgroup.appendChild(option);
      });
      
      this.elements.yearFilter.appendChild(optgroup);
    });
  }

  /**
   * Populate genre filter dropdown
   */
  populateGenreFilter() {
    if (!this.elements.genreFilter) return;
    
    const genres = new Set();
    this.allBooks.forEach(book => {
      if (book.subject && Array.isArray(book.subject)) {
        book.subject.forEach(subject => {
          if (subject && subject.trim()) {
            // Clean up and categorize subjects
            const cleanSubject = this.categorizeGenre(subject.trim());
            if (cleanSubject) {
              genres.add(cleanSubject);
            }
          }
        });
      }
    });

    const sortedGenres = Array.from(genres).sort();
    this.elements.genreFilter.innerHTML = '<option value="">All Genres</option>';
    
    sortedGenres.forEach(genre => {
      const option = document.createElement('option');
      option.value = genre;
      option.textContent = genre;
      this.elements.genreFilter.appendChild(option);
    });
  }

  /**
   * Categorize and clean genre names
   * @param {string} subject - Raw subject from book data
   * @returns {string|null} Cleaned genre name or null if should be excluded
   */
  categorizeGenre(subject) {
    if (!subject || typeof subject !== 'string') return null;
    
    const lowerSubject = subject.toLowerCase().trim();
    
    // Skip very specific, technical, or overly long subjects
    if (lowerSubject.length > 60 || 
        lowerSubject.includes('--') || 
        lowerSubject.includes('(') ||
        lowerSubject.includes('juvenile') ||
        lowerSubject.includes('accessible book') ||
        lowerSubject.includes('large type books') ||
        lowerSubject.includes('readers') ||
        lowerSubject.includes('grade') ||
        lowerSubject.match(/^\d+/) || // starts with numbers
        lowerSubject.includes('bibliography') ||
        lowerSubject.includes('indexes')) {
      return null;
    }

    // Enhanced mapping for J.K. Rowling's works
    const genreMapping = {
      // Fantasy & Magic
      'fantasy': 'Fantasy',
      'magic': 'Fantasy',
      'wizards': 'Fantasy',
      'witches': 'Fantasy',
      'magical': 'Fantasy',
      'supernatural': 'Fantasy',
      'mythology': 'Fantasy & Mythology',
      'fairy tales': 'Fantasy & Fairy Tales',
      
      // Mystery & Detective
      'detective': 'Mystery & Detective',
      'mystery': 'Mystery & Detective',
      'crime': 'Crime & Mystery',
      'thriller': 'Thriller',
      'suspense': 'Suspense',
      'police': 'Crime & Detective',
      
      // Fiction categories
      'fiction': 'Fiction',
      'literary fiction': 'Literary Fiction',
      'contemporary fiction': 'Contemporary Fiction',
      'historical fiction': 'Historical Fiction',
      'adventure': 'Adventure Fiction',
      'romance': 'Romance',
      
      // Age categories
      'children': 'Children\'s Literature',
      'young adult': 'Young Adult Fiction',
      'teen': 'Young Adult Fiction',
      'juvenile fiction': 'Children\'s Fiction',
      
      // Non-fiction
      'biography': 'Biography & Memoir',
      'autobiography': 'Biography & Memoir',
      'memoir': 'Biography & Memoir',
      'biography & autobiography': 'Biography & Memoir',
      
      // Academic & Educational
      'philosophy': 'Philosophy',
      'psychology': 'Psychology',
      'politics': 'Politics & Government',
      'history': 'History',
      'science': 'Science',
      'education': 'Education',
      'social': 'Social Issues',
      'sociology': 'Social Sciences',
      
      // Specific themes
      'friendship': 'Friendship & Relationships',
      'coming of age': 'Coming of Age',
      'school': 'School Stories',
      'boarding school': 'School Stories',
      'orphans': 'Family & Social Issues',
      'families': 'Family Stories',
      'london': 'British Literature',
      'england': 'British Literature',
      'british': 'British Literature',
      'scotland': 'Scottish Literature',
      
      // Media adaptations
      'film': 'Film Adaptations',
      'movie': 'Film Adaptations',
      'television': 'TV Adaptations',
      'adaptation': 'Adaptations',
      
      // Writing & Literature
      'authorship': 'Writing & Publishing',
      'literary criticism': 'Literary Criticism',
      'book clubs': 'Reading & Book Culture'
    };

    // Check for exact matches first
    if (genreMapping[lowerSubject]) {
      return genreMapping[lowerSubject];
    }

    // Check for partial matches
    for (const [key, value] of Object.entries(genreMapping)) {
      if (lowerSubject.includes(key)) {
        return value;
      }
    }

    // Special handling for compound subjects
    if (lowerSubject.includes(' and ')) {
      const parts = lowerSubject.split(' and ');
      for (const part of parts) {
        const trimmedPart = part.trim();
        if (genreMapping[trimmedPart]) {
          return genreMapping[trimmedPart];
        }
      }
    }

    // Handle "in literature" subjects
    if (lowerSubject.includes(' in literature')) {
      const theme = lowerSubject.replace(' in literature', '').trim();
      return `${this.capitalizeFirst(theme)} in Literature`;
    }

    // If no mapping found and it's a reasonable length, clean it up
    if (subject.length <= 40 && !lowerSubject.includes('/') && !lowerSubject.includes(',')) {
      // Clean up the subject
      return subject
        .split(' ')
        .map(word => this.capitalizeFirst(word))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return null;
  }

  /**
   * Apply all filters to the books
   */
  applyFilters() {
    // Add filtering class for animation
    this.elements.booksContainer.classList.add('filtering');
    
    setTimeout(() => {
      let filtered = [...this.allBooks];
      
      // Apply search filter
      if (this.currentFilters.search.trim()) {
        filtered = this.applySearchFilter(filtered, this.currentFilters.search);
      }
      
      // Apply language filter
      if (this.currentFilters.language) {
        filtered = filtered.filter(book => 
          book.language && book.language.includes(this.currentFilters.language)
        );
      }
      
      // Apply year filter
      if (this.currentFilters.year) {
        filtered = filtered.filter(book => 
          book.first_publish_year && book.first_publish_year.toString() === this.currentFilters.year
        );
      }
      
      // Apply genre filter
      if (this.currentFilters.genre) {
        filtered = filtered.filter(book => {
          if (!book.subject) return false;
          return book.subject.some(subject => {
            const cleanSubject = this.categorizeGenre(subject);
            return cleanSubject === this.currentFilters.genre;
          });
        });
      }
      
      this.filteredBooks = filtered;
      this.displayFilteredBooks(filtered);
      this.updateSearchResults();
      this.updateClearButtonVisibility();
      
      // Remove filtering class
      this.elements.booksContainer.classList.remove('filtering');
    }, 100);
  }

  /**
   * Apply search filter to books
   * @param {Array} books - Books to filter
   * @param {string} query - Search query
   * @returns {Array} Filtered books
   */
  applySearchFilter(books, query) {
    return books.filter(book => {
      return this.fuzzySearch(query, book.title) ||
             (book.first_publish_year && query.includes(book.first_publish_year.toString())) ||
             (book.subject && book.subject.some(subject => this.fuzzySearch(query, subject))) ||
             (book.subtitle && this.fuzzySearch(query, book.subtitle));
    });
  }

  /**
   * Clear all filters
   */
  clearAllFilters() {
    // Reset filter values
    this.currentFilters = {
      search: '',
      language: '',
      year: '',
      genre: ''
    };
    
    // Reset UI elements
    if (this.elements.searchInput) this.elements.searchInput.value = '';
    if (this.elements.languageFilter) this.elements.languageFilter.value = '';
    if (this.elements.yearFilter) this.elements.yearFilter.value = '';
    if (this.elements.genreFilter) this.elements.genreFilter.value = '';
    
    // Apply filters (which will show all books)
    this.applyFilters();
  }

  /**
   * Update visibility of clear button and filter results
   */
  updateClearButtonVisibility() {
    if (!this.elements.clearBtn) return;
    
    const hasSearchText = this.currentFilters.search.trim().length > 0;
    this.elements.clearBtn.style.display = hasSearchText ? 'block' : 'none';
  }

  /**
   * Update search results display
   */
  updateSearchResults() {
    if (!this.elements.searchResults) return;

    const query = this.currentFilters.search;
    const hasActiveFilters = this.currentFilters.language || this.currentFilters.year || this.currentFilters.genre;
    const filteredCount = this.filteredBooks.length;
    const totalCount = this.allBooks.length;

    if (!query && !hasActiveFilters) {
      this.elements.searchResults.textContent = '';
      return;
    }

    let resultText = '';
    
    if (filteredCount === 0) {
      resultText = hasActiveFilters || query 
        ? `<span style="color: #e74c3c;">No books found matching your criteria</span>`
        : '';
    } else if (filteredCount === totalCount) {
      resultText = `Showing all ${totalCount} books`;
    } else {
      const filterDesc = [];
      if (query) filterDesc.push(`search "${query}"`);
      if (this.currentFilters.language) filterDesc.push(`language "${this.getLanguageName(this.currentFilters.language)}"`);
      if (this.currentFilters.year) filterDesc.push(`year ${this.currentFilters.year}`);
      if (this.currentFilters.genre) filterDesc.push(`genre "${this.currentFilters.genre}"`);
      
      resultText = `Found ${filteredCount} of ${totalCount} books`;
      if (filterDesc.length > 0) {
        resultText += ` for ${filterDesc.join(', ')}`;
      }
    }
    
    this.elements.searchResults.innerHTML = resultText;
  }

  /**
   * Fuzzy search implementation
   * @param {string} query - Search query
   * @param {string} text - Text to search in
   * @returns {boolean} True if match found
   */
  fuzzySearch(query, text) {
    if (!query || !text) return false;
    
    query = query.toLowerCase();
    text = text.toLowerCase();
    
    if (text.includes(query)) return true;
    
    let queryIndex = 0;
    let textIndex = 0;
    let matches = 0;
    
    while (queryIndex < query.length && textIndex < text.length) {
      if (query[queryIndex] === text[textIndex]) {
        matches++;
        queryIndex++;
      }
      textIndex++;
    }
    
    return (matches / query.length) >= 0.7;
  }

  /**
   * Highlight search terms in text
   * @param {string} text - Text to highlight
   * @param {string} query - Search query
   * @returns {string} Text with highlighted terms
   */
  highlightSearchTerm(text, query) {
    if (!query || !text) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
  }

  /**
   * Update search results display
   * @param {string} query - Search query
   * @param {number} filteredCount - Number of filtered results
  /**
   * Update books count display
   * @param {number} count - Number of books
   */
  updateBooksCount(count) {
    const existingCount = document.querySelector('.books-count');
    if (existingCount) {
      existingCount.remove();
    }
    
    const countElement = document.createElement('p');
    countElement.className = 'books-count';
    countElement.textContent = `Showing ${count} individual books by J.K. Rowling`;
    this.elements.booksContainer.parentNode.insertBefore(countElement, this.elements.booksContainer);
  }

  /**
   * Show no results message
   */
  showNoResults() {
    const noResults = document.createElement('div');
    noResults.className = 'no-results';
    noResults.innerHTML = `
      <h3>No books found</h3>
      <p>Try adjusting your search terms or clear the search to see all books.</p>
    `;
    this.elements.booksContainer.appendChild(noResults);
  }

  /**
   * Show loading state
   */
  showLoading() {
    this.elements.loading.style.display = 'block';
    this.elements.error.style.display = 'none';
    this.elements.booksContainer.style.display = 'none';
  }

  /**
   * Show books container
   */
  showBooks() {
    this.elements.loading.style.display = 'none';
    this.elements.booksContainer.style.display = 'grid';
  }

  /**
   * Show error state
   */
  showError() {
    this.elements.loading.style.display = 'none';
    this.elements.error.style.display = 'block';
    this.elements.booksContainer.style.display = 'none';
  }

  /**
   * Pre-generate descriptions for popular books to improve modal performance
   * @param {Array} books - Array of book objects to pre-generate descriptions for
   */
  async preGenerateDescriptions(books) {
    if (this.isPreGeneratingDescriptions) return;
    this.isPreGeneratingDescriptions = true;

    try {
      // Process books in batches to avoid overwhelming the API
      const batchSize = 3;
      for (let i = 0; i < books.length; i += batchSize) {
        const batch = books.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (book) => {
            const cacheKey = this.getBookCacheKey(book);
            
            // Skip if already cached
            if (this.descriptionCache.has(cacheKey)) return;
            
            try {
              const description = await generateBookDescription(book);
              this.descriptionCache.set(cacheKey, description);
            } catch (error) {
              console.warn(`Failed to pre-generate description for ${book.title}:`, error);
            }
          })
        );
        
        // Small delay between batches to be API-friendly
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Error in pre-generation:', error);
    } finally {
      this.isPreGeneratingDescriptions = false;
    }
  }

  /**
   * Get cached description for a book
   * @param {Object} book - Book object
   * @returns {string|null} Cached description or null
   */
  getCachedDescription(book) {
    const cacheKey = this.getBookCacheKey(book);
    return this.descriptionCache.get(cacheKey) || null;
  }

  /**
   * Generate cache key for a book
   * @param {Object} book - Book object
   * @returns {string} Cache key
   */
  getBookCacheKey(book) {
    return `${book.title}_${book.first_publish_year || 'unknown'}`;
  }
}
