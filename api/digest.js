// api/digest.js - Complete AI Digest API with Claude integration

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
            rss: [
                'https://openai.com/blog/rss.xml',
                'https://ai.googleblog.com/feeds/posts/default',
                'https://blog.anthropic.com/rss.xml',
                'https://www.deepmind.com/blog/rss.xml',
                'https://blogs.microsoft.com/ai/feed/',
                'https://research.google/blog/rss/',
                'https://engineering.fb.com/category/ai-research/feed/',
                'https://arxiv.org/rss/cs.AI'
            ],
            apis: [
                {
                    name: 'Reddit AI',
                    url: 'https://www.reddit.com/r/MachineLearning/hot.json?limit=10',
                    parser: 'reddit'
                }
            ]
        };
        this.rankingEngine = new AdvancedRankingEngine();
    }

    async generateDigest() {
        console.log('Starting content aggregation...');
        
        // Fetch content from multiple sources
        const allContent = await this.fetchAllContent();
        const rankedContent = this.rankingEngine.rankContent(allContent);
        const categorizedContent = this.categorizeContent(rankedContent);
        
        // Generate AI summary using Claude
        const summary = await this.generateClaudeSummary(categorizedContent);
        
        return {
            summary,
            content: categorizedContent,
            topStories: this.getTopStories(categorizedContent),
            metadata: {
                totalItems: allContent.length,
                generatedAt: new Date().toISOString()
            },
            timestamp: new Date().toISOString(),
            badge: this.getTimeOfDayBadge()
        };
    }

    async fetchAllContent() {
        const results = [];
        
        // Fetch RSS feeds
        for (const feedUrl of this.sources.rss) {
            try {
                const items = await this.fetchRSSFeed(feedUrl);
                results.push(...items);
                await this.delay(1000); // Rate limiting
            } catch (error) {
                console.warn(`RSS fetch failed for ${feedUrl}:`, error.message);
            }
        }
        
        // Fetch Reddit content
        try {
            const redditItems = await this.fetchRedditContent();
            results.push(...redditItems);
        } catch (error) {
            console.warn('Reddit fetch failed:', error.message);
        }
        
        return results;
    }

    async fetchRSSFeed(url) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'AI-Digest-Bot/1.0 (+https://vidyagam.com)',
                    'Accept': 'application/rss+xml, application/xml, text/xml'
                },
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const xmlText = await response.text();
            return this.parseRSSFeed(xmlText, url);
        } catch (error) {
            console.error(`Error fetching RSS from ${url}:`, error);
            return [];
        }
    }

    parseRSSFeed(xmlText, sourceUrl) {
        const items = [];
        
        try {
            const itemMatches = xmlText.match(/<item>(.*?)<\/item>/gs) || 
                               xmlText.match(/<entry>(.*?)<\/entry>/gs) || [];
            
            for (const itemXML of itemMatches) {
                const title = this.extractXMLContent(itemXML, 'title');
                const description = this.extractXMLContent(itemXML, 'description') || 
                                 this.extractXMLContent(itemXML, 'summary');
                const link = this.extractXMLContent(itemXML, 'link');
                const pubDate = this.extractXMLContent(itemXML, 'pubDate') ||
                               this.extractXMLContent(itemXML, 'updated');
                
                if (title && this.isRecentContent(pubDate)) {
                    items.push({
                        title: this.cleanText(title),
                        description: this.cleanText(description).substring(0, 300) + '...',
                        url: link,
                        source: this.extractSourceName(sourceUrl),
                        publishedAt: pubDate || new Date().toISOString(),
                        type: 'blog'
                    });
                }
            }
        } catch (error) {
            console.error(`RSS parsing error for ${sourceUrl}:`, error);
        }
        
        return items;
    }

    async fetchRedditContent() {
        try {
            const response = await fetch('https://www.reddit.com/r/MachineLearning/hot.json?limit=10', {
                headers: { 'User-Agent': 'AI-Digest-Bot/1.0' },
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) return [];

            const data = await response.json();
            const items = [];

            for (const post of data.data?.children || []) {
                const postData = post.data;
                if (this.isAIRelated(postData.title) && this.isRecentContent(postData.created_utc * 1000)) {
                    items.push({
                        title: postData.title,
                        description: postData.selftext ? 
                            postData.selftext.substring(0, 300) + '...' :
                            `Discussion with ${postData.num_comments} comments`,
                        url: `https://reddit.com${postData.permalink}`,
                        source: 'Reddit ML',
                        publishedAt: new Date(postData.created_utc * 1000).toISOString(),
                        type: 'blog'
                    });
                }
            }
            
            return items;
        } catch (error) {
            console.error('Reddit fetch error:', error);
            return [];
        }
    }

    categorizeContent(rankedContent) {
        const categories = {
            blog: [],
            audio: [],
            video: []
        };

        // Add real content to blog category
        for (const item of rankedContent) {
            if (categories.blog.length < 8) {
                categories.blog.push(this.enrichContentItem(item));
            }
        }

        // Add mock audio and video content
        categories.audio = this.getMockAudioContent();
        categories.video = this.getMockVideoContent();

        return categories;
    }

    enrichContentItem(item) {
        return {
            ...item,
            impact: this.rankingEngine.getImpactLevel(item.significanceScore || 5),
            time: this.formatTimeAgo(item.publishedAt),
            readTime: this.estimateReadTime(item.description),
            significanceScore: item.significanceScore || 5
        };
    }

    getTopStories(content) {
        const allItems = [...content.blog, ...content.video, ...content.audio];
        return allItems
            .sort((a, b) => (b.significanceScore || 0) - (a.significanceScore || 0))
            .slice(0, 3)
            .map(item => ({
                title: item.title,
                source: item.source,
                significanceScore: item.significanceScore || 5
            }));
    }

    async generateClaudeSummary(content) {
        const apiKey = process.env.CLAUDE_API_KEY;
        
        if (!apiKey) {
            console.warn('Claude API key not found, using fallback summary');
            return this.generateFallbackSummary(content);
        }

        try {
            const topItems = content.blog.slice(0, 5);
            const prompt = topItems.map(item => 
                `• ${item.title}: ${item.description}`
            ).join('\n');

            console.log('Generating Claude summary...');
            
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 400,
                    messages: [{
                        role: 'user',
                        content: `Create a compelling 3-4 sentence summary of today's most significant AI developments. Focus on breakthrough announcements and industry trends. Be specific about companies and technologies when possible:\n\n${prompt}`
                    }]
                }),
                signal: AbortSignal.timeout(30000)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Claude summary generated successfully');
                return result.content[0].text;
            } else {
                console.error('Claude API error:', response.status, response.statusText);
                return this.generateFallbackSummary(content);
            }
        } catch (error) {
            console.error('Claude API error:', error);
            return this.generateFallbackSummary(content);
        }
    }

    generateFallbackSummary(content) {
        const totalItems = content.blog.length;
        const topSources = [...new Set(content.blog.map(item => item.source))].slice(0, 3);

        return `Today's AI landscape features ${totalItems} significant developments across the industry. ` +
               `Key updates emerge from ${topSources.join(', ')}, showcasing continued innovation in ` +
               `machine learning, language models, and AI applications. The developments range from ` +
               `breakthrough research announcements to practical implementation updates that continue ` +
               `to drive the field forward.`;
    }

    // Helper methods
    extractXMLContent(xml, tag) {
        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const match = xml.match(regex);
        return match ? match[1].trim() : '';
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
            'gpt', 'transformer', 'nlp', 'computer vision', 'robotics'
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

    getTimeOfDayBadge() {
        const hour = new Date().getHours();
        return hour < 14 ? 'Morning Digest' : 'Evening Digest';
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

// Simplified ranking engine
class AdvancedRankingEngine {
    constructor() {
        this.keywordScores = {
            'breakthrough': 10, 'revolutionary': 10, 'first': 9, 'launch': 9,
            'gpt-5': 10, 'gpt-4': 8, 'claude': 8, 'gemini': 8, 'openai': 7,
            'anthropic': 7, 'google ai': 7, 'agi': 10, 'neural network': 6
        };
    }

    rankContent(content) {
        return content.map(item => ({
            ...item,
            significanceScore: this.calculateSignificanceScore(item)
        })).sort((a, b) => b.significanceScore - a.significanceScore);
    }

    calculateSignificanceScore(item) {
        let score = 5; // Base score
        const text = `${item.title} ${item.description}`.toLowerCase();

        // Keyword scoring
        for (const [keyword, points] of Object.entries(this.keywordScores)) {
            if (text.includes(keyword.toLowerCase())) {
                score += points * 0.1;
            }
        }

        // Recency bonus
        const hours = (Date.now() - new Date(item.publishedAt)) / (1000 * 60 * 60);
        if (hours < 6) score += 2;
        else if (hours < 24) score += 1;

        return Math.min(Math.round(score * 10) / 10, 10);
    }

    getImpactLevel(score) {
        if (score >= 7) return 'high';
        if (score >= 4) return 'medium';
        return 'low';
    }
}

// Fallback data
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
