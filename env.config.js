// Environment configuration for AI Digest Frontend
// This file sets up the API URL based on the deployment environment

(function() {
    // Set global environment variables
    window.ENV_CONFIG = {
        // Production API URL
        API_URL: 'https://ai-news-scraper.vercel.app',
        
        // Feature flags
        ENABLE_REAL_TIME_UPDATES: true,
        ENABLE_AUDIO_CONTENT: true,
        ENABLE_VIDEO_CONTENT: true,
        
        // Google OAuth Configuration
        GOOGLE_CLIENT_ID: '450435096536-tbor1sbkbq27si62ps7khr5fdat5indb.apps.googleusercontent.com',
        
        // Development settings
        DEBUG_MODE: true // Always debug for now
    };
    
    // Make API URL available globally for the main app
    window.ENV_API_URL = window.ENV_CONFIG.API_URL;
    
    console.log('Environment Config loaded:', window.ENV_CONFIG);
    console.log('ENV_API_URL set to:', window.ENV_API_URL);
})();