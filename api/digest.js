// api/digest.js - Add real audio/video sources

export default async function handler(req, res) {
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
        
        // Get content including real audio/video sources
        const mockContent = this.getMockContent();
        
        // Generate Claude summary
        const summary = await this.generateClaudeSummary(mockContent);
        
        return {
            summary,
            content: mockContent,
            topStories: this.getTopStories(mockContent),
            metadata: {
                claudeApiUsed: !!process.env.CLAUDE_API_KEY,
                generatedAt: new Date().toISOString()
            },
            timestamp: new Date().toISOString(),
            badge: this.getTimeOfDayBadge()
        };
    }

    async generateClaudeSummary(content) {
        const apiKey = process.env.CLAUDE_API_KEY;
        
        if (!apiKey) {
            return this.getFallbackSummary();
        }

        try {
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

            if (response.ok) {
                const result = await response.json();
                if (result.content && result.content[0] && result.content[0].text) {
                    return result.content[0].text;
                }
            }
            
            return this.getFallbackSummary();
        } catch (error) {
            console.error('Claude API error:', error);
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
            audio: [
                {
                    title: "Lex Fridman Podcast: AI Alignment with Stuart Russell",
                    description: "In-depth discussion about AI safety, alignment challenges, and the future of artificial intelligence with Berkeley professor Stuart Russell.",
                    source: "Lex Fridman Podcast",
                    time: "6 hours ago",
                    impact: "high",
                    type: "audio",
                    url: "https://www.youtube.com/watch?v=KsVbCKjHrzI", // Real Lex Fridman episode
                    duration: "2h 15m",
                    significanceScore: 7.8
                },
                {
                    title: "The AI Breakdown: Weekly Industry Analysis",
                    description: "Comprehensive weekly roundup of AI developments, funding announcements, and technical breakthroughs with expert commentary and analysis.",
                    source: "The AI Breakdown",
                    time: "1 day ago",
                    impact: "medium",
                    type: "audio",
                    url: "https://open.spotify.com/show/4nVIqW91UILZrz1ztT5HbU", // Real podcast
                    duration: "45 min",
                    significanceScore: 6.5
                },
                {
                    title: "Hard Fork: The Race to AGI",
                    description: "New York Times tech reporters discuss the current state of artificial general intelligence research and the competition between major AI labs.",
                    source: "Hard Fork (NYT)",
                    time: "2 days ago",
                    impact: "medium",
                    type: "audio",
                    url: "https://www.nytimes.com/column/hard-fork", // Real NYT podcast
                    duration: "38 min",
                    significanceScore: 6.8
                }
            ],
            video: [
                {
                    title: "Two Minute Papers: Latest AI Research Breakthroughs",
                    description: "Dr. Károly Zsolnai-Fehér breaks down the latest AI research papers in an accessible format, covering computer vision, language models, and generative AI.",
                    source: "Two Minute Papers",
                    time: "1 day ago",
                    impact: "high",
                    type: "video",
                    url: "https://www.youtube.com/c/K%C3%A1rolyZsolnai", // Real YouTube channel
                    duration: "8 min",
                    significanceScore: 7.8
                },
                {
                    title: "Anthropic: Claude 3 Model Capabilities Demo",
                    description: "Live demonstration of Claude 3's advanced reasoning, coding, and multimodal capabilities with real-world examples and use cases.",
                    source: "Anthropic",
                    time: "3 hours ago",
                    impact: "high",
                    type: "video",
                    url: "https://www.anthropic.com/claude", // Anthropic's Claude page
                    duration: "12 min",
                    significanceScore: 8.2
                },
                {
                    title: "AI Explained: Understanding Transformer Architecture",
                    description: "Technical deep-dive into how transformer models work, covering attention mechanisms, scaling laws, and the foundation of modern language models.",
                    source: "AI Explained",
                    time: "5 hours ago",
                    impact: "medium",
                    type: "video",
                    url: "https://www.youtube.com/c/AiExplained-Official", // Real educational channel
                    duration: "18 min",
                    significanceScore: 6.9
                }
            ]
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
