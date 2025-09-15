import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  timeout: 60000, // 60 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout - the server took too long to respond');
    }
    
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.detail || error.response.data?.error || error.response.statusText;
      throw new Error(`Server Error (${error.response.status}): ${message}`);
    } else if (error.request) {
      // Request made but no response received
      throw new Error('Network Error: Unable to connect to the API server. Please check if the FastAPI server is running.');
    } else {
      // Something else happened
      throw new Error(`Request Error: ${error.message}`);
    }
  }
);

// API Functions

/**
 * Check API health and connection
 */
export const checkAPIHealth = async () => {
  try {
    const response = await api.get('/');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

/**
 * Ask a question about a PDF
 */
export const askQuestion = async (questionData) => {
  try {
    const response = await api.post('/ask', questionData);
    return response.data;
  } catch (error) {
    console.error('Ask question failed:', error);
    throw error;
  }
};

/**
 * Get correct citation for an answer
 */
export const getCorrectCitation = async (citationData) => {
  try {
    const response = await api.post('/correct-citation', citationData);
    return response.data;
  } catch (error) {
    console.error('Get correct citation failed:', error);
    throw error;
  }
};

/**
 * Fetch available PDFs
 */
export const fetchAvailablePDFs = async () => {
  try {
    const response = await api.get('/list-cloud-pdfs');
    return response.data;
  } catch (error) {
    console.error('Fetch PDFs failed:', error);
    throw error;
  }
};

/**
 * Inspect PDF content
 */
export const inspectPDF = async (pdfName) => {
  try {
    const response = await api.get(`/inspect/${pdfName}`);
    return response.data;
  } catch (error) {
    console.error('Inspect PDF failed:', error);
    throw error;
  }
};

/**
 * Get API root information
 */
export const getAPIInfo = async () => {
  try {
    const response = await api.get('/');
    return response.data;
  } catch (error) {
    console.error('Get API info failed:', error);
    throw error;
  }
};

export default api;
