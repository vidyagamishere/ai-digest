// api/digest.js - Complete production API for Vercel deployment

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const contentAggregator = new ProductionContentAggregator();
        const digest = await contentAggregator.generateDigest();
        
        // Add cache headers
        res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
        
        res.status(200).json(digest);
    } catch (error) {
        console.error('Digest generation error:', error);
        res.status(500).json({ 
            error: 'Failed to generate digest',
            fallback: true,
            data: getFallbackDigest()
        });
    }
}

class ProductionContentAggregator {
    constructor() {
        this.sources = {
            // Tier 1: Most reliable (RSS + Direct APIs)
            tier1: {
                rss: [
                    'https://openai.com/blog/rss.xml',
                    'https://ai.googleblog.com/feeds/posts/default',
                    'https://blog.anthropic.com/rss.xml',
                    'https://www.deepmind.com/blog/rss.xml',
                    'https://blogs.microsoft.com/ai/feed/',
                    'https://research.google/blog/rss/',
                    'https://engineering.fb.com/category/ai-research/feed/',
                    'https://arxiv.org/rss/cs.AI',
                    'https://arxiv.org/rss/cs.LG'
                ],
                apis: [
                    {
                        name: 'Reddit AI',
                        url: 'https://www.reddit.com/r/MachineLearning/hot.json?limit=15',
                        parser: 'reddit'
                    },
                    {
                        name: 'Hacker News',
                        url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
                        parser: 'hackernews'
                    }
                ]
            },
            
            // Tier 2: Proxy-based fallbacks
            tier2: {
                proxied: [
                    'https://techcrunch.com/category/artificial-intelligence/feed/',
                    'https://venturebeat.com/ai/feed/'
                ]
            }
        };

        this.rankingEngine = new AdvancedRankingEngine();
        this.contentFilter = new ContentQualityFilter();
    }

    async generateDigest() {
        console.log('Starting content aggregation...');
        
        // Phase 1: Reliable sources
        const tier1Content = await this.fetchTier1Content();
        console.log(`Tier 1 content: ${tier1Content.length} items`);
        
        // Phase 2: If we need more content, try proxied sources
        let tier2Content = [];
        if (tier1Content.length < 15) {
            tier2Content = await this.fetchTier2Content();
            console.log(`Tier 2 content: ${tier2Content.length} items`);
        }
        
        // Combine and process content
        const allContent = [...tier1Content, ...tier2Content];
        const filteredContent = this.contentFilter.filterContent(allContent);
        const rankedContent = this.rankingEngine.rankContent(filteredContent);
        
        // Categorize and limit
        const categorizedContent = this.categorizeContent(rankedContent);
        
        // Generate AI summary
        const summary = await this.generateAISummary(categorizedContent);
        
        return {
            summary,
            content: categorizedContent,
            topStories: this.getTopStories(categorizedContent),
            metadata: {
                totalItems: allContent.length,
                filteredItems: filteredContent.length,
                sources: this.getSourceStats(allContent),
                generatedAt: new Date().toISOString()
            },
            timestamp: new Date().toISOString(),
            badge: this.getTimeOfDayBadge()
        };
    }

    async fetchTier1Content() {
        const results = [];
        
        // Fetch RSS feeds
        const rssPromises = this.sources.tier1.rss.map(url => 
            this.fetchRSSWithRetry(url).catch(err => {
                console.warn(`RSS failed: ${url}`, err.message);
                return [];
            })
        );
        
        const rssResults = await Promise.all(rssPromises);
        results.push(...rssResults.flat());
        
        // Fetch direct APIs
        const apiPromises = this.sources.tier1.apis.map(api => 
            this.fetchAPIWithRetry(api).catch(err => {
                console.warn(`API failed: ${api.name}`, err.message);
                return [];
            })
        );
        
        const apiResults = await Promise.all(apiPromises);
        results.push(...apiResults.flat());
        
        return results;
    }

    async fetchTier2Content() {
        const results = [];
        
        // Try proxied sources
        for (const url of this.sources.tier2.proxied) {
            try {
                const content = await this.fetchWithProxy(url);
                results.push(...content);
                
                // Rate limiting
                await this.delay(2000);
                
                if (results.length >= 10) break; // Enough backup content
            } catch (error) {
                console.warn(`Proxied fetch failed: ${url}`, error.message);
            }
        }
        
        return results;
    }

    async fetchRSSWithRetry(url, maxRetries = 2) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'AI-Digest-Bot/1.0 (+https://vidyagam.com)',
                        'Accept': 'application/rss+xml, application/xml, text/xml'
                    },
                    signal: AbortSignal.timeout(15000)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const xmlText = await response.text();
                return this.parseRSSFeed(xmlText, url);
                
            } catch (error) {
                if (attempt === maxRetries) throw error;
                await this.delay(attempt * 1000);
            }
        }
    }

    async fetchAPIWithRetry(api, maxRetries = 2) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(api.url, {
                    headers: {
                        'User-Agent': 'AI-Digest-Bot/1.0'
                    },
                    signal: AbortSignal.timeout(10000)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                return this.parseAPIResponse(data, api.parser, api.name);
                
            } catch (error) {
                if (attempt === maxRetries) throw error;
                await this.delay(attempt * 1000);
            }
        }
    }

    async fetchWithProxy(url) {
        const proxyStrategies = [
            () => this.fetchWithAllOrigins(url),
            () => this.fetchDirect(url)
        ];

        for (const strategy of proxyStrategies) {
            try {
                return await strategy();
            } catch (error) {
                console.warn('Proxy strategy failed:', error.message);
            }
        }

        throw new Error('All proxy strategies failed');
    }

    async fetchWithAllOrigins(url) {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        
        const response = await fetch(proxyUrl, { 
            signal: AbortSignal.timeout(20000) 
        });
        
        if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`);
        
        const data = await response.json();
        if (!data.contents) throw new Error('No content from proxy');
        
        return this.parseRSSFeed(data.contents, url);
    }

    async fetchDirect(url) {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AI-Digest/1.0)'
            },
            signal: AbortSignal.timeout(15000)
        });
        
        if (!response.ok) throw new Error(`Direct HTTP ${response.status}`);
        
        const xmlText = await response.text();
        return this.parseRSSFeed(xmlText, url);
    }

    parseRSSFeed(xmlText, sourceUrl) {
        const items = [];
        
        try {
            // Extract items from RSS/Atom feeds
            const itemMatches = xmlText.match(/<item>(.*?)<\/item>/gs) || 
                               xmlText.match(/<entry>(.*?)<\/entry>/gs) || [];
            
            for (const itemXML of itemMatches) {
                const title = this.extractXMLContent(itemXML, 'title');
                const description = this.extractXMLContent(itemXML, 'description') || 
                                 this.extractXMLContent(itemXML, 'summary') ||
                                 this.extractXMLContent(itemXML, 'content');
                const link = this.extractXMLContent(itemXML, 'link') ||
                            this.extractXMLAttribute(itemXML, 'link', 'href');
                const pubDate = this.extractXMLContent(itemXML, 'pubDate') ||
                               this.extractXMLContent(itemXML, 'updated') ||
                               this.extractXMLContent(itemXML, 'published');
                
                if (title && this.isRecentContent(pubDate)) {
                    items.push({
                        title: this.cleanText(title),
                        description: this.cleanText(description).substring(0, 300) + '...',
                        url: link,
                        source: this.extractSourceName(sourceUrl),
                        publishedAt: pubDate || new Date().toISOString(),
                        type: 'blog',
                        sourceUrl: sourceUrl
                    });
                }
            }
        } catch (error) {
            console.error(`RSS parsing error for ${sourceUrl}:`, error);
        }
        
        return items;
    }

    async parseAPIResponse(data, parser, sourceName) {
        const items = [];
        
        try {
            if (parser === 'reddit') {
                const posts = data.data?.children || [];
                
                for (const post of posts) {
                    const postData = post.data;
                    if (this.isAIRelated(postData.title) && this.isRecentContent(postData.created_utc * 1000)) {
                        items.push({
                            title: postData.title,
                            description: postData.selftext ? 
                                postData.selftext.substring(0, 300) + '...' :
                                `Discussion with ${postData.num_comments} comments`,
                            url: `https://reddit.com${postData.permalink}`,
                            source: sourceName,
                            publishedAt: new Date(postData.created_utc * 1000).toISOString(),
                            type: 'blog',
                            engagement: postData.score
                        });
                    }
                }
            }
            
            if (parser === 'hackernews') {
                // HN returns array of story IDs, need to fetch individual stories
                const storyIds = data.slice(0, 30); // Limit to first 30
                
                for (const storyId of storyIds) {
                    try {
                        const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
                        const story = await storyResponse.json();
                        
                        if (story.title && this.isAIRelated(story.title) && this.isRecentContent(story.time * 1000)) {
                            items.push({
                                title: story.title,
                                description: story.text ? 
                                    this.cleanText(story.text).substring(0, 300) + '...' :
                                    `HN discussion with ${story.descendants || 0} comments`,
                                url: story.url || `https://news.ycombinator.com/item?id=${storyId}`,
                                source: sourceName,
                                publishedAt: new Date(story.time * 1000).toISOString(),
                                type: 'blog',
                                engagement: story.score
                            });
                        }
                        
                        await this.delay(100); // Rate limiting for HN
                    } catch (error) {
                        console.warn(`Failed to fetch HN story ${storyId}`);
                    }
                }
            }
        } catch (error) {
            console.error(`API parsing error for ${sourceName}:`, error);
        }
        
        return items;
    }

    categorizeContent(rankedContent) {
        const categories = {
            blog: [],
            audio: [],
            video: []
        };

        // Sort content by significance score
        const sortedContent = rankedContent.sort((a, b) => 
            (b.significanceScore || 0) - (a.significanceScore || 0)
        );

        // Distribute content across categories
        for (const item of sortedContent) {
            if (item.type === 'video' && categories.video.length < 4) {
                categories.video.push(this.enrichContentItem(item));
            } else if (item.type === 'audio' && categories.audio.length < 4) {
                categories.audio.push(this.enrichContentItem(item));
            } else if (categories.blog.length < 8) {
                categories.blog.push(this.enrichContentItem(item));
            }
        }

        // Add mock content if categories are empty
        if (categories.audio.length === 0) {
            categories.audio = this.getMockAudioContent();
        }
        if (categories.video.length === 0) {
            categories.video = this.getMockVideoContent();
        }

        return categories;
    }

    enrichContentItem(item) {
        return {
            ...item,
            impact: this.rankingEngine.getImpactLevel(item.significanceScore || 5),
            time: this.formatTimeAgo(item.publishedAt),
            readTime: item.type === 'blog' ? this.estimateReadTime(item.description) : undefined,
            duration: item.type !== 'blog' ? this.generateDuration(item.type) : undefined
        };
    }

    getTopStories(content) {
        const allItems = [
            ...content.blog,
            ...content.video,
            ...content.audio
        ];

        return allItems
            .sort((a, b) => (b.significanceScore || 0) - (a.significanceScore || 0))
            .slice(0, 3)
            .map(item => ({
                title: item.title,
                source: item.source,
                significanceScore: item.significanceScore || 5
            }));
    }

    async generateAISummary(content) {
        if (!process.env.CLAUDE_API_KEY) {
            return this.generateFallbackSummary(content);
        }

        try {
            const topItems = [
                ...content.blog.slice(0, 3),
                ...content.video.slice(0, 1),
                ...content.audio.slice(0, 1)
            ].sort((a, b) => (b.significanceScore || 0) - (a.significanceScore || 0));

            const prompt = topItems.map(item => 
                `[${item.impact?.toUpperCase()} IMPACT] ${item.title}: ${item.description}`
            ).join('\n\n');

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.CLAUDE_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 400,
                    messages: [{
                        role: 'user',
                        content: `Create a compelling 3-4 sentence summary of today's most significant AI developments. Focus on breakthrough announcements and industry-changing news. Be specific about companies and technologies:\n\n${prompt}`
                    }]
                })
            });

            if (response.ok) {
                const result = await response.json();
                return result.content[0].text;
            }
        } catch (error) {
            console.error('Claude API error:', error);
        }

        return this.generateFallbackSummary(content);
    }

    generateFallbackSummary(content) {
        const totalItems = Object.values(content).reduce((sum, items) => sum + items.length, 0);
        const topSources = [...new Set(
            Object.values(content).flat().map(item => item.source)
        )].slice(0, 3);

        return `Today's AI landscape features ${totalItems} significant developments across the industry. ` +
               `Key updates emerge from ${topSources.join(', ')}, showcasing continued innovation in ` +
               `machine learning, language models, and AI applications. Breakthrough announcements ` +
               `and research findings continue to drive the field forward.`;
    }

    // Helper methods
    extractXMLContent(xml, tag) {
        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const match = xml.match(regex);
        return match ? match[1].trim() : '';
    }

    extractXMLAttribute(xml, tag, attr) {
        const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']*?)["'][^>]*>`, 'i');
        const match = xml.match(regex);
        return match ? match[1] : '';
    }

    cleanText(text) {
        return text
            .replace(/<[^>]*>/g, '')
            .replace(/&[^;]+;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    isRecentContent(dateInput) {
        const date = typeof dateInput === 'number' ? new Date(dateInput) : new Date(dateInput);
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        return date > threeDaysAgo;
    }

    isAIRelated(title) {
        const aiKeywords = [
            'ai', 'artificial intelligence', 'machine learning', 'deep learning',
            'neural network', 'chatgpt', 'openai', 'claude', 'gemini', 'llm',
            'gpt', 'transformer', 'nlp', 'computer vision', 'robotics',
            'anthropic', 'midjourney', 'stable diffusion'
        ];
        
        return aiKeywords.some(keyword => title.toLowerCase().includes(keyword));
    }

    extractSourceName(url) {
        try {
            const hostname = new URL(url).hostname.replace('www.', '');
            const nameMap = {
                'openai.com': 'OpenAI',
                'ai.googleblog.com': 'Google AI',
                'blog.anthropic.com': 'Anthropic',
                'deepmind.com': 'DeepMind',
                'blogs.microsoft.com': 'Microsoft',
                'arxiv.org': 'arXiv'
            };
            return nameMap[hostname] || hostname;
        } catch {
            return 'Unknown Source';
        }
    }

    formatTimeAgo(dateString) {
        const hours = Math.floor((Date.now() - new Date(dateString)) / (1000 * 60 * 60));
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days !== 1 ? 's' : ''} ago`;
    }

    estimateReadTime(text) {
        const words = text.split(' ').length;
        const minutes = Math.ceil(words / 200);
        return `${minutes} min read`;
    }

    generateDuration(type) {
        const durations = {
            video: ['3 min', '8 min', '12 min', '18 min', '25 min'],
            audio: ['15 min', '25 min', '35 min', '45 min', '60 min']
        };
        const options = durations[type] || durations.video;
        return options[Math.floor(Math.random() * options.length)];
    }

    getTimeOfDayBadge() {
        const hour = new Date().getHours();
        return hour < 14 ? 'Morning Digest' : 'Evening Digest';
    }

    getSourceStats(content) {
        const stats = {};
        content.forEach(item => {
            stats[item.source] = (stats[item.source] || 0) + 1;
        });
        return stats;
    }

    getMockAudioContent() {
        return [{
            title: "AI Weekly: Industry Roundup",
            description: "Expert analysis of this week's most significant AI developments and their industry implications.",
            source: "AI Weekly Podcast",
            time: "4 hours ago",
            impact: "medium",
            type: "audio",
            url: "#",
            duration: "32 min",
            significanceScore: 6.5
        }];
    }

    getMockVideoContent() {
        return [{
            title: "AI Breakthrough Demonstrations",
            description: "Latest AI model capabilities showcased through real-world applications and use cases.",
            source: "AI Demos Channel",
            time: "2 hours ago",
            impact: "high",
            type: "video",
            url: "#",
            duration: "15 min",
            significanceScore: 7.8
        }];
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Content quality filter
class ContentQualityFilter {
    filterContent(content) {
        return content.filter(item => {
            // Remove duplicates
            if (this.isDuplicate(item, content)) return false;
            
            // Remove low-quality content
            if (item.title.length < 10) return false;
            if (item.description.length < 50) return false;
            
            // Remove non-English content (basic check)
            if (!this.isEnglish(item.title)) return false;
            
            return true;
        });
    }

    isDuplicate(item, allContent) {
        return allContent.some(other => 
            other !== item && 
            this.similarity(item.title, other.title) > 0.8
        );
    }

    similarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    isEnglish(text) {
        // Basic English detection
        const englishPattern = /^[a-zA-Z0-9\s\-.,!?'"()]+$/;
        return englishPattern.test(text.substring(0, 50));
    }
}

// Advanced ranking engine
class AdvancedRankingEngine {
    constructor() {
        this.weights = {
            source: 0.25,
            keywords: 0.30,
            recency: 0.20,
            engagement: 0.15,
            novelty: 0.10
        };

        this.keywordScores = {
            // Breakthrough terms (highest impact)
            'breakthrough': 10,
            'revolutionary': 10,
            'first': 9,
            'launch': 9,
            'release': 9,
            'unveil': 8,
            'announce': 8,
            
            // Company/Product names (high significance)
            'gpt-5': 10,
            'gpt-4': 8,
            'claude': 8,
            'gemini': 8,
            'chatgpt': 7,
            'openai': 7,
            'anthropic': 7,
            'google ai': 7,
            'microsoft': 6,
            'meta ai': 6,
            
            // Technical terms (medium-high impact)
            'artificial general intelligence': 10,
            'agi': 10,
            'neural network': 6,
            'transformer': 6,
            'machine learning': 5,
            'deep learning': 5,
            'llm': 6,
            'multimodal': 7,
            
            // Business impact terms
            'billion': 8,
            'investment': 6,
            'funding': 6,
            'partnership': 5,
            'acquisition': 7,
            'ipo': 8,
            
            // Research terms
            'paper': 4,
            'research': 4,
            'study': 4,
            'benchmark': 5,
            'dataset': 4,
            
            // Application areas
            'autonomous': 6,
            'robotics': 6,
            'healthcare': 5,
            'finance': 5,
            'education': 4,
            'climate': 5,
            
            // Regulatory/Safety
            'regulation': 6,
            'safety': 6,
            'ethics': 5,
            'alignment': 7,
            'copyright': 5,
            'lawsuit': 6
        };

        this.sourceScores = {
            'openai.com': 10,
            'blog.anthropic.com': 10,
            'ai.googleblog.com': 10,
            'deepmind.com': 10,
            'research.microsoft.com': 9,
            'ai.facebook.com': 9,
            'blogs.nvidia.com': 8,
            'techcrunch.com': 7,
            'reuters.com': 8,
            'bloomberg.com': 8,
            'theverge.com': 6,
            'wired.com': 7,
            'mit.edu': 9,
            'stanford.edu': 9,
            'arxiv.org': 8,
            'nature.com': 9,
            'science.org': 9
        };
    }

    rankContent(content) {
        return content.map(item => ({
            ...item,
            significanceScore: this.calculateSignificanceScore(item)
        })).sort((a, b) => b.significanceScore - a.significanceScore);
    }

    calculateSignificanceScore(item) {
        const sourceScore = this.getSourceScore(item);
        const keywordScore = this.getKeywordScore(item);
        const recencyScore = this.getRecencyScore(item);
        const engagementScore = this.getEngagementScore(item);
        const noveltyScore = this.getNoveltyScore(item);

        const totalScore = 
            (sourceScore * this.weights.source) +
            (keywordScore * this.weights.keywords) +
            (recencyScore * this.weights.recency) +
            (engagementScore * this.weights.engagement) +
            (noveltyScore * this.weights.novelty);

        return Math.round(totalScore * 10) / 10;
    }

    getSourceScore(item) {
        const domain = this.extractDomain(item.url || item.source);
        const baseScore = this.sourceScores[domain] || 3;
        
        if (domain.includes('openai') || domain.includes('anthropic') || 
            domain.includes('google') || domain.includes('microsoft')) {
            return Math.min(baseScore + 2, 10);
        }
        
        return baseScore;
    }

    getKeywordScore(item) {
        const text = `${item.title} ${item.description}`.toLowerCase();
        let score = 0;
        let matches = 0;

        for (const [keyword, weight] of Object.entries(this.keywordScores)) {
            if (text.includes(keyword.toLowerCase())) {
                score += weight;
                matches++;
            }
        }

        if (matches > 2) score *= 1.2;
        if (matches > 4) score *= 1.4;

        return Math.min(score, 10);
    }

    getRecencyScore(item) {
        const publishDate = new Date(item.publishedAt || item.time);
        const now = new Date();
        const hoursAgo = (now - publishDate) / (1000 * 60 * 60);

        if (hoursAgo < 1) return 10;
        if (hoursAgo < 3) return 9;
        if (hoursAgo < 6) return 8;
        if (hoursAgo < 12) return 7;
        if (hoursAgo < 24) return 6;
        if (hoursAgo < 48) return 4;
        return 2;
    }

    getEngagementScore(item) {
        let score = 5;

        const title = item.title.toLowerCase();
        
        if (title.includes('first') || title.includes('new') || 
            title.includes('breakthrough') || title.includes('revolutionary')) {
            score += 2;
        }

        if (title.includes('?') || title.includes('how')) {
            score += 1;
        }

        if (/\d+/.test(title)) {
            score += 1;
        }

        return Math.min(score, 10);
    }

    getNoveltyScore(item) {
        const text = `${item.title} ${item.description}`.toLowerCase();
        let score = 5;

        const noveltyIndicators = [
            'first time', 'never before', 'unprecedented', 'novel',
            'innovative', 'unique', 'original', 'pioneering'
        ];

        noveltyIndicators.forEach(indicator => {
            if (text.includes(indicator)) score += 1;
        });

        const commonTerms = [
            'update', 'improve', 'enhance', 'minor', 'patch'
        ];

        commonTerms.forEach(term => {
            if (text.includes(term)) score -= 0.5;
        });

        return Math.max(Math.min(score, 10), 1);
    }

    extractDomain(url) {
        try {
            if (!url || url === '#') return 'unknown';
            if (!url.startsWith('http')) url = 'https://' + url;
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return 'unknown';
        }
    }

    getImpactLevel(score) {
        if (score >= 7) return 'high';
        if (score >= 4) return 'medium';
        return 'low';
    }
}

// Fallback digest for errors
function getFallbackDigest() {
    return {
        summary: "AI development continues with significant progress across multiple sectors, including language models, computer vision, and robotics applications.",
        content: {
            blog: [{
                title: "AI Industry Continues Rapid Development",
                description: "The artificial intelligence sector maintains its momentum with ongoing research breakthroughs and commercial applications.",
                source: "AI News",
                time: "1 hour ago",
                impact: "medium",
                type: "blog",
                url: "#",
                readTime: "3 min read",
                significanceScore: 5.0
            }],
            audio: [],
            video: []
        },
        topStories: [{
            title: "AI Industry Continues Rapid Development",
            source: "AI News",
            significanceScore: 5.0
        }],
        timestamp: new Date().toISOString(),
        badge: "Fallback Digest"
    };
}