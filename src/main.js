// Import all modules
import { addEvent, generateUniqueId, debounce, escapeHtml } from './modules/utils.js';
import { Navigation } from './modules/navigation.js';
import { FeaturedBooksCarousel } from './modules/featuredBooksCarousel.js';
import { BooksPageManager } from './modules/booksPage.js';
import { searchBooksFromOpenLibrary, generateBookDescription } from './modules/apiService.js';
import { BooksPageModal } from './modules/modals.js';

// Global instances
let navigation;
let featuredCarousel;
let booksPageManager;
let booksModal;

// Global variable to track if we're on home page for carousel
let isHomePage = false;

// Check if we're on home page
function checkHomePage() {
    const path = window.location.pathname;
    isHomePage = path === '/' || path.endsWith('/') || path.includes('home.html') || path.includes('index.html');
    return isHomePage;
}

// ========== CARD SLIDER ==========
function initCardSlider({
  sliderId = 'cardSlider',
  cardSelector = '.card',
  visibleCount = 3,
  autoScroll = true,
  interval = 4000
} = {}) {
  const slider = document.getElementById(sliderId);
  const cards = document.querySelectorAll(cardSelector);
  if (!slider || cards.length === 0) return;

  let currentSlide = 0;
  const totalCards = cards.length;

  function updateSlider() {
    const cardWidth = cards[0].offsetWidth + 20; // adjust gap if needed
    slider.style.transform = `translateX(${-currentSlide * cardWidth}px)`;
  }

  function slideLeft() {
    currentSlide = currentSlide > 0 ? currentSlide - 1 : totalCards - visibleCount;
    updateSlider();
  }

  function slideRight() {
    currentSlide = currentSlide < totalCards - visibleCount ? currentSlide + 1 : 0;
    updateSlider();
  }

  // Auto-scroll
  if (autoScroll) {
    setInterval(slideRight, interval);
  }

  updateSlider();
}

// ========== CONTACT FORM ==========
function initContactForm() {
  const contactForm = document.getElementById('contactForm');
  
  if (!contactForm) return; // Not on contact page

  addEvent(contactForm, 'submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(contactForm);
    const name = formData.get('name');
    const email = formData.get('email');
    const message = formData.get('message');
    
    console.log('Form submission:', { name, email, message });
    
    // Here you would typically send the data to a server
    alert('Thank you for your message! We\'ll get back to you soon.');
    contactForm.reset();
  });
}

// ========== ABOUT CARDS ==========
function initAboutCards() {
  const aboutCards = document.querySelectorAll('.about-card');
  
  aboutCards.forEach(card => {
    addEvent(card, 'click', () => {
      const cardType = card.dataset.card;
      if (cardType) {
        showAboutModal(cardType);
      }
    });
  });
}

function showAboutModal(cardType) {
  if (!document.getElementById('aboutModal')) {
    createAboutModal();
  }
  
  populateAboutModal(cardType);
  
  const modal = document.getElementById('aboutModal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function createAboutModal() {
  const modalHTML = `
    <div id="aboutModal" class="modal">
      <div class="modal-content about-modal-content">
        <span class="close" onclick="closeAboutModal()">&times;</span>
        <h2 id="aboutModalTitle"></h2>
        <div id="aboutModalContent"></div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Close modal when clicking outside
  addEvent(document.getElementById('aboutModal'), 'click', (e) => {
    if (e.target.id === 'aboutModal') {
      closeAboutModal();
    }
  });
}

function populateAboutModal(cardType) {
  const titleElement = document.getElementById('aboutModalTitle');
  const contentElement = document.getElementById('aboutModalContent');
  
  const content = {
    personal: {
      title: "Personal Journey",
      content: `
        <p>J.K. Rowling's journey from struggling single mother to world-renowned author is one of the most inspiring stories in literature. Born in Yate, England, she conceived the idea for Harry Potter during a delayed train journey in 1990.</p>
        <p>After facing numerous rejections from publishers, Bloomsbury finally accepted her manuscript in 1997. The rest, as they say, is magical history.</p>
        <ul>
          <li>Born: July 31, 1965</li>
          <li>Birthplace: Yate, Gloucestershire, England</li>
          <li>Education: University of Exeter</li>
          <li>First book published: 1997</li>
        </ul>
      `
    },
    achievements: {
      title: "Literary Achievements",
      content: `
        <p>J.K. Rowling's achievements extend far beyond the Harry Potter series, though that alone would cement her legacy in literary history.</p>
        <div class="achievement-grid">
          <div class="achievement-item">
            <h4>Awards & Honours</h4>
            <ul>
              <li>Order of the British Empire (OBE) - 2001</li>
              <li>Companion of Honour - 2017</li>
              <li>Hans Christian Andersen Literature Award - 2010</li>
              <li>Multiple Hugo Awards</li>
            </ul>
          </div>
          <div class="achievement-item">
            <h4>Sales & Records</h4>
            <ul>
              <li>Over 500 million books sold worldwide</li>
              <li>Translated into 80+ languages</li>
              <li>First billionaire author</li>
              <li>Fastest-selling book series in history</li>
            </ul>
          </div>
        </div>
      `
    },
    philanthropy: {
      title: "Philanthropy & Social Impact",
      content: `
        <p>Beyond her literary success, J.K. Rowling is known for her extensive charitable work and social activism.</p>
        <div class="philanthropy-section">
          <h4>Major Initiatives</h4>
          <ul>
            <li><strong>Lumos:</strong> Founded in 2005 to help disadvantaged children worldwide</li>
            <li><strong>Multiple Sclerosis Research:</strong> Significant donations to MS research in honor of her mother</li>
            <li><strong>Single Parent Support:</strong> Advocacy and support for single parents</li>
            <li><strong>Education:</strong> Funding for literacy programs and educational initiatives</li>
          </ul>
          
          <h4>Social Causes</h4>
          <p>Rowling has been vocal about social justice issues, women's rights, and has used her platform to raise awareness about various humanitarian causes. Her commitment to giving back has seen her donate millions to charity.</p>
        </div>
      `
    }
  };
  
  const cardContent = content[cardType];
  if (cardContent) {
    titleElement.textContent = cardContent.title;
    contentElement.innerHTML = cardContent.content;
  }
}

function closeAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

// Global function to show book details (called from HTML)
window.showBookDetails = function(book) {
  if (booksModal) {
    booksModal.showWithBook(book);
  }
};

// Make about modal functions globally accessible
window.showAboutModal = showAboutModal;
window.closeAboutModal = closeAboutModal;

// ========== INIT APP ==========
document.addEventListener('DOMContentLoaded', async () => {
  // Redirect to home.html if on index.html or site root
  if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
    window.location.href = "home.html";
    return; // stop running inits before redirect
  }

  // Initialize modules
  try {
    // Initialize navigation
    navigation = new Navigation();
    navigation.init();

    // Initialize books page manager
    booksPageManager = new BooksPageManager();
    await booksPageManager.init();

    // Initialize featured books carousel for home page
    checkHomePage();
    if (isHomePage) {
      featuredCarousel = new FeaturedBooksCarousel();
      await featuredCarousel.init();
    }

    // Initialize books modal
    booksModal = new BooksPageModal();

    // Initialize legacy functionality
    initCardSlider();
    initContactForm();
    initAboutCards();
    
    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Error initializing application:', error);
  }
});

// Close modals when pressing Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAboutModal();
  }
});
