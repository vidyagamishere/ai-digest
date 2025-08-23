// Environment configuration for AI Digest Frontend
// This file sets up the API URL based on the deployment environment

(function() {
    // Set global environment variables
    window.ENV_CONFIG = {
        // Production API URL - will be replaced by Vercel environment variables
        API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://ai-news-scraper-5o2nddh7z.vercel.app',
        
        // Feature flags
        ENABLE_REAL_TIME_UPDATES: true,
        ENABLE_AUDIO_CONTENT: true,
        ENABLE_VIDEO_CONTENT: true,
        
        // Development settings
        DEBUG_MODE: process.env.NODE_ENV !== 'production'
    };
    
    // Make API URL available globally for the main app
    window.ENV_API_URL = window.ENV_CONFIG.API_URL;
    
    if (window.ENV_CONFIG.DEBUG_MODE) {
        console.log('Environment Config:', window.ENV_CONFIG);
    }
})();