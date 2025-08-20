// api/digest.js - Fixed Claude API integration

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
        
        res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
        res.status(200).json(digest);
    } catch (error) {
        console.error('Digest generation error:', error);
        res.status(500).json({ 
            error: 'Failed to generate digest',
            data: getFallbackDigest()
        });
    }
}

class ProductionContentAggregator {
    async generateDigest() {
        console.log('=== Starting Digest Generation ===');
        
        // Get content
        const mockContent = this.getMockContent();
        
        // Generate Claude summary
        const summary = await this.generateClaudeSummary(mockContent);
        
        return {
            summary,
            content: mockContent,
            topStories: this.getTopStories(mockContent),
            metadata: {
                claudeApiUsed: !!process.env.CLAUDE_API_KEY,
                claudeKeyLength: process.env.CLAUDE_API_KEY?.length || 0,
                generatedAt: new Date().toISOString()
            },
            timestamp: new Date().toISOString(),
            badge: this.getTimeOfDayBadge()
        };
    }

    async generateClaudeSummary(content) {
        const apiKey = process.env.CLAUDE_API_KEY;
        
        console.log('=== Claude API Attempt ===');
        console.log('API Key exists:', !!apiKey);
        console.log('API Key length:', apiKey?.length || 0);
        console.log('Environment vars available:', Object.keys(process.env).filter(k => k.includes('CLAUDE')));
        
        if (!apiKey) {
            console.log('❌ No Claude API key found in environment');
            return this.getFallbackSummary();
        }

        try {
            console.log('🔄 Making Claude API request...');
            
            const requestBody = {
                model: 'claude-3-haiku-20240307',
                max_tokens: 200,
                messages: [{
                    role: 'user',
                    content: `Create a 2-3 sentence summary of these AI developments:

- ${content.blog[0]?.title}: ${content.blog[0]?.description}
- ${content.blog[1]?.title}: ${content.blog[1]?.description}
- ${content.blog[2]?.title}: ${content.blog[2]?.description}

Focus on the most significant trends and breakthroughs.`
                }]
            };

            console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(30000)
            });

            console.log('📥 Response status:', response.status);
            console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

            if (response.ok) {
                const result = await response.json();
                console.log('📄 Full response:', JSON.stringify(result, null, 2));
                
                if (result.content && result.content[0] && result.content[0].text) {
                    console.log('✅ Claude API Success!');
                    return result.content[0].text;
                } else {
                    console.log('❌ Unexpected response format');
                    return this.getFallbackSummary();
                }
            } else {
                const errorText = await response.text();
                console.log('❌ Claude API Error:', response.status, response.statusText);
                console.log('❌ Error body:', errorText);
                return this.getFallbackSummary();
            }

        } catch (error) {
            console.log('❌ Fetch error:', error.name, error.message);
            console.log('❌ Error stack:', error.stack);
            return this.getFallbackSummary();
        }
    }

    getFallbackSummary() {
        return "Today's AI landscape showcases remarkable developments in machine learning and artificial intelligence applications. Major technology companies continue to advance language model capabilities while researchers push the boundaries of AI reasoning and multimodal understanding. These innovations highlight the rapid evolution of AI technology across various industry sectors.";
    }

    getMockContent() {
        return {
            blog: [
                {
                    title: "OpenAI Advances Language Model Reasoning",
                    description: "Recent developments demonstrate significant improvements in complex reasoning tasks, mathematical problem-solving, and logical inference capabilities across diverse domains.",
                    source: "OpenAI",
                    time: "2 hours ago",
                    impact: "high",
                    type: "blog",
                    url: "https://openai.com/blog",
                    readTime: "5 min read",
                    significanceScore: 8.7
                },
                {
                    title: "Google Introduces Multimodal AI Architecture",
                    description: "Breakthrough integration of text, image, and audio processing within a unified model architecture, enabling seamless cross-modal understanding and generation.",
                    source: "Google AI",
                    time: "4 hours ago",
                    impact: "high",
                    type: "blog",
                    url: "https://ai.google",
                    readTime: "6 min read",
                    significanceScore: 8.3
                },
                {
                    title: "Microsoft Expands Enterprise AI Integration",
                    description: "Enhanced Copilot capabilities now available across productivity suites with improved workflow automation, document intelligence, and collaborative AI features.",
                    source: "Microsoft",
                    time: "6 hours ago",
                    impact: "medium",
                    type: "blog",
                    url: "https://blogs.microsoft.com",
                    readTime: "4 min read",
                    significanceScore: 7.2
                },
                {
                    title: "Neural Architecture Research Breakthrough",
                    description: "Scientists develop efficient neural network designs that reduce computational requirements by 60% while maintaining state-of-the-art performance across benchmarks.",
                    source: "arXiv",
                    time: "8 hours ago",
                    impact: "medium",
                    type: "blog",
                    url: "https://arxiv.org",
                    readTime: "7 min read",
                    significanceScore: 6.9
                }
            ],
            audio: [{
                title: "AI Weekly: Industry Analysis and Future Trends",
                description: "Comprehensive discussion of current AI developments with leading researchers and industry experts sharing insights on technological advancement directions.",
                source: "AI Weekly Podcast",
                time: "3 hours ago",
                impact: "medium",
                type: "audio",
                url: "#",
                duration: "45 min",
                significanceScore: 6.5
            }],
            video: [{
                title: "Live AI Capability Demonstrations",
                description: "Real-time showcase of cutting-edge AI applications including natural language processing, computer vision, and advanced reasoning demonstrations.",
                source: "AI Demos Channel",
                time: "1 hour ago",
                impact: "high",
                type: "video",
                url: "#",
                duration: "20 min",
                significanceScore: 7.8
            }]
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

    getTimeOfDayBadge() {
        const hour = new Date().getHours();
        return hour < 14 ? 'Morning Digest' : 'Evening Digest';
    }
}

function getFallbackDigest() {
    return {
        summary: "AI development continues with significant progress across multiple sectors.",
        content: {
            blog: [{
                title: "AI Industry Continues Development",
                description: "Ongoing progress in artificial intelligence research and applications.",
                source: "AI News",
                time: "1 hour ago",
                impact: "medium",
                type: "blog",
                readTime: "3 min read",
                significanceScore: 5.0
            }],
            audio: [],
            video: []
        },
        topStories: [],
        timestamp: new Date().toISOString(),
        badge: "Fallback Digest"
    };
}
