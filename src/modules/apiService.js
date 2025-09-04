/**
 * API service for external data fetching with caching
 */

// Get Hugging Face token from environment variables
const HUGGING_FACE_TOKEN = import.meta.env.VITE_HUGGING_FACE_TOKEN || '';
const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org';
const HUGGING_FACE_BASE_URL = 'https://api-inference.huggingface.co';

// Cache for API responses
const apiCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Cached fetch wrapper
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise} Response
 */
async function cachedFetch(url, options = {}) {
  const cacheKey = `${url}_${JSON.stringify(options)}`;
  const cached = apiCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  
  apiCache.set(cacheKey, {
    data: { ...response, json: () => Promise.resolve(data) },
    timestamp: Date.now()
  });
  
  return { ...response, json: () => Promise.resolve(data) };
}

/**
 * Fetch books from Open Library API
 * @param {string} authorId - Author ID for Open Library
 * @param {number} limit - Number of books to fetch
 * @returns {Promise<Object>} API response
 */
export async function fetchBooksFromOpenLibrary(authorId = 'OL23919A', limit = 50) {
  try {
    const response = await fetch(`${OPEN_LIBRARY_BASE_URL}/authors/${authorId}/works.json?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching books from Open Library:', error);
    throw error;
  }
}

/**
 * Search books from Open Library
 * @param {string} author - Author name
 * @param {number} limit - Number of results
 * @returns {Promise<Object>} Search results
 */
export async function searchBooksFromOpenLibrary(author = 'J.K.+Rowling', limit = 100) {
  try {
    const response = await fetch(`${OPEN_LIBRARY_BASE_URL}/search.json?author=${author}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error searching books from Open Library:', error);
    throw error;
  }
}

/**
 * Fetch detailed book information including languages and subjects from J.K. Rowling works
 * @param {number} limit - Number of books to fetch
 * @returns {Promise<Object>} Books with detailed information
 */
export async function fetchDetailedJKRowlingBooks(limit = 100) {
  try {
    // Use cached fetch for better performance
    const [worksResponse, searchResponse] = await Promise.all([
      cachedFetch(`${OPEN_LIBRARY_BASE_URL}/authors/OL23919A/works.json?limit=${limit}`),
      cachedFetch(`${OPEN_LIBRARY_BASE_URL}/search.json?author=J.K.+Rowling&limit=${limit}`)
    ]);
    
    if (!worksResponse.ok || !searchResponse.ok) {
      throw new Error('API request failed');
    }
    
    const [worksData, searchData] = await Promise.all([
      worksResponse.json(),
      searchResponse.json()
    ]);
    
    // Try to enhance the data, but fall back to search data if enhancement fails
    let enhancedBooks;
    try {
      enhancedBooks = await enhanceBookData(worksData.entries, searchData.docs);
    } catch (enhanceError) {
      console.warn('Enhancement failed, using search data:', enhanceError);
      enhancedBooks = searchData.docs || [];
    }
    
    return {
      books: enhancedBooks,
      total: enhancedBooks.length
    };
  } catch (error) {
    console.error('Error fetching detailed J.K. Rowling books:', error);
    // Fallback to simple search
    try {
      const searchResponse = await cachedFetch(`${OPEN_LIBRARY_BASE_URL}/search.json?author=J.K.+Rowling&limit=${limit}`);
      const searchData = await searchResponse.json();
      return {
        books: searchData.docs || [],
        total: searchData.docs?.length || 0
      };
    } catch (fallbackError) {
      console.error('Fallback search also failed:', fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Enhance book data by combining works and search results
 * @param {Array} works - Works from author endpoint
 * @param {Array} searchBooks - Books from search endpoint
 * @returns {Promise<Array>} Enhanced books array
 */
async function enhanceBookData(works, searchBooks) {
  const enhancedBooks = [];
  const processedTitles = new Set();
  
  // Create a map of search books for quick lookup
  const searchBooksMap = new Map();
  if (Array.isArray(searchBooks)) {
    searchBooks.forEach(book => {
      if (book.title) {
        const normalizedTitle = book.title.toLowerCase().trim();
        searchBooksMap.set(normalizedTitle, book);
      }
    });
  }
  
  // Process works and enhance with search data
  const worksToProcess = Array.isArray(works) ? works : [];
  
  for (const work of worksToProcess) {
    if (!work.title || processedTitles.has(work.title.toLowerCase())) {
      continue;
    }
    
    processedTitles.add(work.title.toLowerCase());
    
    // Find matching search result
    const searchMatch = searchBooksMap.get(work.title.toLowerCase());
    
    // Get detailed work information (with timeout and error handling)
    let detailedWork = null;
    if (work.key) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const workResponse = await fetch(`${OPEN_LIBRARY_BASE_URL}${work.key}.json`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (workResponse.ok) {
          detailedWork = await workResponse.json();
        }
      } catch (error) {
        console.warn(`Failed to fetch detailed work for ${work.title}:`, error.message);
      }
    }
    
    // Combine all data sources
    const enhancedBook = {
      title: work.title,
      key: work.key,
      covers: work.covers || [],
      cover_i: searchMatch?.cover_i || (work.covers && work.covers[0]),
      first_publish_year: searchMatch?.first_publish_year || work.first_publish_date,
      first_publish_date: work.first_publish_date || searchMatch?.first_publish_date,
      
      // Enhanced data from search results
      language: searchMatch?.language || [],
      publisher: searchMatch?.publisher || [],
      isbn: searchMatch?.isbn || [],
      subject: searchMatch?.subject || detailedWork?.subjects || [],
      
      // Additional metadata
      edition_count: searchMatch?.edition_count || 1,
      author_key: searchMatch?.author_key || ['OL23919A'],
      author_name: searchMatch?.author_name || ['J.K. Rowling'],
      
      // Description from detailed work
      description: detailedWork?.description?.value || detailedWork?.description || work.description,
      
      // Work-specific data
      subtitle: detailedWork?.subtitle || work.subtitle,
      dewey_decimal_class: detailedWork?.dewey_decimal_class || [],
      lc_classifications: detailedWork?.lc_classifications || [],
    };
    
    enhancedBooks.push(enhancedBook);
  }
  
  // Add any search results not found in works
  if (Array.isArray(searchBooks)) {
    searchBooks.forEach(searchBook => {
      if (searchBook.title && !processedTitles.has(searchBook.title.toLowerCase())) {
        processedTitles.add(searchBook.title.toLowerCase());
        enhancedBooks.push({
          ...searchBook,
          key: searchBook.key || null,
          covers: searchBook.cover_i ? [searchBook.cover_i] : [],
          author_key: searchBook.author_key || ['OL23919A'],
          author_name: searchBook.author_name || ['J.K. Rowling']
        });
      }
    });
  }
  
  return enhancedBooks;
}

/**
 * Generate book description using Hugging Face AI
 * @param {Object} book - Book object
 * @returns {Promise<string>} Generated description
 */
export async function generateBookDescription(book) {
  try {
    // First try to get description from Goodreads dataset
    const goodreadsDescription = await fetchFromGoodreadsDataset(book);
    if (goodreadsDescription) {
      return goodreadsDescription;
    }
  } catch (error) {
    console.log('Goodreads dataset not available, using fallback description');
  }
  
  // Skip AI generation and use fallback directly to avoid API errors
  return getFallbackDescription(book);
}

/**
 * Fetch description from Goodreads dataset
 * @param {Object} book - Book object
 * @returns {Promise<string|null>} Description or null
 */
async function fetchFromGoodreadsDataset(book) {
  const DATASET_URL = 'https://datasets-server.huggingface.co/rows?dataset=booksouls/goodreads-book-descriptions&config=default&split=train';
  
  try {
    const response = await fetch(DATASET_URL, {
      headers: {
        'Authorization': `Bearer ${HUGGING_FACE_TOKEN}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Dataset API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.rows) {
      const matchingBook = data.rows.find(row => {
        const dataTitle = row.row.title?.toLowerCase() || '';
        const dataAuthor = row.row.authors?.toLowerCase() || '';
        const bookTitle = book.title.toLowerCase();
        
        return (dataTitle.includes(bookTitle.substring(0, 10)) || bookTitle.includes(dataTitle.substring(0, 10))) &&
               dataAuthor.includes('rowling');
      });
      
      if (matchingBook && matchingBook.row.description) {
        let description = matchingBook.row.description.trim();
        
        const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 10);
        if (sentences.length > 2) {
          description = sentences.slice(0, 2).join('. ') + '.';
        }
        
        return description.length > 50 ? description : null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching from Goodreads dataset:', error);
    return null;
  }
}

/**
 * Generate AI description using Hugging Face models
 * @param {Object} book - Book object
 * @returns {Promise<string>} Generated description
 */
async function generateAIDescription(book) {
  const API_URL = `${HUGGING_FACE_BASE_URL}/models/facebook/blenderbot-400M-distill`;
  const prompt = createBookSpecificPrompt(book);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGING_FACE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_length: 150,
          temperature: 0.7,
          do_sample: true,
          top_p: 0.9,
          repetition_penalty: 1.2
        }
      })
    });

    if (!response.ok) {
      if (response.status === 503) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return generateBookDescriptionFallback(book);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data[0] && data[0].generated_text) {
      const description = cleanGeneratedDescription(data[0].generated_text.trim(), book);
      return description || getFallbackDescription(book);
    } else {
      return getFallbackDescription(book);
    }
    
  } catch (error) {
    console.error('Hugging Face API error:', error);
    return generateBookDescriptionFallback(book);
  }
}

/**
 * Fallback description generation using GPT-2
 * @param {Object} book - Book object
 * @returns {Promise<string>} Generated description
 */
async function generateBookDescriptionFallback(book) {
  const API_URL = `${HUGGING_FACE_BASE_URL}/models/gpt2`;
  const prompt = `${book.title} by J.K. Rowling is a captivating book that`;
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGING_FACE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_length: 100,
          temperature: 0.8,
          do_sample: true,
          top_p: 0.9
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data[0] && data[0].generated_text) {
        return cleanGeneratedDescription(data[0].generated_text.trim(), book);
      }
    }
  } catch (error) {
    console.error('Fallback API error:', error);
  }
  
  return getFallbackDescription(book);
}

/**
 * Create book-specific prompt for AI
 * @param {Object} book - Book object
 * @returns {string} Prompt text
 */
function createBookSpecificPrompt(book) {
  return `Write a professional book description for "${book.title}" by J.K. Rowling in the style of Goodreads or bookstore descriptions. Make it engaging, informative, and 4-6 sentences long:`;
}

/**
 * Clean generated description text
 * @param {string} text - Raw generated text
 * @param {Object} book - Book object
 * @returns {string} Cleaned description
 */
function cleanGeneratedDescription(text, book) {
  if (!text) return '';
  
  text = text.replace(/^(Book summary:|Book description:|Description:)/i, '').trim();
  text = text.replace(/^\W+/, '').trim();
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  if (sentences.length > 0) {
    let description = sentences[0].trim();
    
    if (description.length < 80 && sentences.length > 1) {
      description += '. ' + sentences[1].trim();
    }
    
    if (!description.match(/[.!?]$/)) {
      description += '.';
    }
    
    description = description.charAt(0).toUpperCase() + description.slice(1);
    
    if (description.length > 200) {
      description = description.substring(0, 200);
      const lastPeriod = description.lastIndexOf('.');
      if (lastPeriod > 100) {
        description = description.substring(0, lastPeriod + 1);
      } else {
        description = description.substring(0, description.lastIndexOf(' ')) + '.';
      }
    }
    
    return description;
  }
  
  return getFallbackDescription(book);
}

/**
 * Get fallback description for book
 * @param {Object} book - Book object
 * @returns {string} Fallback description
 */
function getFallbackDescription(book) {
  const title = book.title.toLowerCase();
  const subjects = book.subject || [];
  const subjectStr = subjects.join(' ').toLowerCase();
  
  // Specific fallbacks for known series/types
  if (title.includes('harry potter')) {
    if (title.includes('philosopher') || title.includes('sorcerer')) {
      return 'The magical journey begins as young Harry Potter discovers his true identity and enters the enchanting world of Hogwarts School of Witchcraft and Wizardry.';
    } else if (title.includes('chamber')) {
      return 'Harry returns to Hogwarts for his second year, where ancient secrets and a mysterious monster threaten the school.';
    } else if (title.includes('prisoner')) {
      return 'Harry\'s third year brings new revelations about his past and the escape of a dangerous prisoner from Azkaban.';
    } else if (title.includes('goblet')) {
      return 'Harry faces his most dangerous challenges yet as he competes in the legendary Triwizard Tournament.';
    } else if (title.includes('phoenix')) {
      return 'As Voldemort returns to power, Harry must unite his friends and form a secret organization to fight against the darkness.';
    } else if (title.includes('prince')) {
      return 'Harry delves into Voldemort\'s dark past while preparing for the ultimate confrontation between good and evil.';
    } else if (title.includes('hallows')) {
      return 'The epic conclusion to Harry\'s journey as he faces his destiny and the final battle against Voldemort.';
    } else {
      return 'Join Harry Potter on an unforgettable magical adventure filled with friendship, courage, and the triumph of good over evil.';
    }
  }
  
  if (title.includes('strike') || title.includes('cuckoo') || title.includes('silkworm') || 
      title.includes('evil') || title.includes('white') || title.includes('blood') || 
      title.includes('heart') || title.includes('grave')) {
    return 'Follow private detective Cormoran Strike as he unravels complex mysteries in this gripping crime series that showcases Rowling\'s masterful storytelling beyond the wizarding world.';
  }
  
  if (title.includes('casual vacancy')) {
    return 'A darkly comic and deeply moving novel that explores the hidden tensions and conflicts within a seemingly idyllic English town.';
  }
  
  if (title.includes('fantastic beasts')) {
    return 'Explore the magical world of fantastic creatures in this enchanting companion to the Harry Potter universe.';
  }
  
  // Genre-based fallbacks
  if (subjectStr.includes('fantasy') || subjectStr.includes('magic')) {
    return 'A spellbinding fantasy tale that transports readers to a world of magic, adventure, and unforgettable characters created by the masterful J.K. Rowling.';
  } else if (subjectStr.includes('mystery') || subjectStr.includes('crime')) {
    return 'A compelling mystery that weaves together intricate plotlines and complex characters in J.K. Rowling\'s signature storytelling style.';
  } else if (subjectStr.includes('young adult') || subjectStr.includes('children')) {
    return 'An engaging tale that captures the imagination of readers young and old with its rich storytelling and memorable characters.';
  }
  
  return 'A captivating work by J.K. Rowling that demonstrates her exceptional ability to craft compelling stories with depth, emotion, and unforgettable characters.';
}
