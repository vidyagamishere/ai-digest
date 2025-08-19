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
            (b.significanceScore || 0)