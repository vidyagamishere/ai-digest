window.aiSourceConfig = {
  sources: [
      // Major AI Companies
      { name: 'OpenAI', url: 'https://openai.com/blog', enabled: true, category: 'company' },
      { name: 'DeepMind', url: 'https://deepmind.google/discover/blog', enabled: true, category: 'company' },
      { name: 'Anthropic', url: 'https://www.anthropic.com/news', enabled: true, category: 'company' },
      { name: 'Meta AI', url: 'https://ai.meta.com/blog', enabled: true, category: 'company' },
      { name: 'Microsoft AI', url: 'https://azure.microsoft.com/en-us/blog', enabled: true, category: 'company' },
      { name: 'Google AI', url: 'https://blog.google/technology/ai', enabled: true, category: 'company' },
      { name: 'NVIDIA AI', url: 'https://blogs.nvidia.com/blog/category/artificial-intelligence', enabled: true, category: 'company' },
      { name: 'Stability AI', url: 'https://stability.ai/blog', enabled: true, category: 'company' },
      { name: 'Cohere', url: 'https://cohere.com/blog', enabled: true, category: 'company' },
      { name: 'AI21 Labs', url: 'https://www.ai21.com/blog', enabled: true, category: 'company' },
      
      // Research Institutions
      { name: 'MIT CSAIL', url: 'https://www.csail.mit.edu/news', enabled: true, category: 'research' },
      { name: 'Stanford HAI', url: 'https://hai.stanford.edu/news', enabled: true, category: 'research' },
      { name: 'Berkeley AI Research', url: 'https://bair.berkeley.edu/blog', enabled: true, category: 'research' },
      { name: 'CMU Machine Learning', url: 'https://blog.ml.cmu.edu', enabled: true, category: 'research' },
      { name: 'Allen Institute for AI', url: 'https://allenai.org/news', enabled: true, category: 'research' },
      { name: 'OpenAI Research', url: 'https://openai.com/research', enabled: true, category: 'research' },
      { name: 'DeepMind Research', url: 'https://deepmind.google/research', enabled: true, category: 'research' },
      { name: 'Facebook AI Research', url: 'https://ai.meta.com/research', enabled: true, category: 'research' },
      
      // AI News & Media
      { name: 'AI News', url: 'https://artificialintelligence-news.com', enabled: true, category: 'news' },
      { name: 'VentureBeat AI', url: 'https://venturebeat.com/ai', enabled: true, category: 'news' },
      { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence', enabled: true, category: 'news' },
      { name: 'The Verge AI', url: 'https://www.theverge.com/ai-artificial-intelligence', enabled: true, category: 'news' },
      { name: 'Wired AI', url: 'https://www.wired.com/tag/artificial-intelligence', enabled: true, category: 'news' },
      { name: 'IEEE Spectrum AI', url: 'https://spectrum.ieee.org/topic/artificial-intelligence', enabled: true, category: 'news' },
      { name: 'MIT Technology Review AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence', enabled: true, category: 'news' },
      { name: 'AI Magazine', url: 'https://onlinelibrary.wiley.com/journal/23719621', enabled: true, category: 'news' },
      
      // Platforms & Communities
      { name: 'Hugging Face', url: 'https://huggingface.co/blog', enabled: true, category: 'platform' },
      { name: 'Papers with Code', url: 'https://paperswithcode.com', enabled: true, category: 'platform' },
      { name: 'Kaggle Blog', url: 'https://medium.com/kaggle-blog', enabled: true, category: 'platform' },
      { name: 'Towards Data Science', url: 'https://towardsdatascience.com', enabled: true, category: 'platform' },
      { name: 'The Gradient', url: 'https://thegradient.pub', enabled: true, category: 'platform' },
      { name: 'Distill.pub', url: 'https://distill.pub', enabled: true, category: 'platform' },
      
      // Startups & Emerging
      { name: 'Midjourney', url: 'https://docs.midjourney.com/blog', enabled: true, category: 'startup' },
      { name: 'Runway', url: 'https://runwayml.com/blog', enabled: true, category: 'startup' },
      { name: 'Character.AI', url: 'https://blog.character.ai', enabled: true, category: 'startup' },
      { name: 'Replicate', url: 'https://replicate.com/blog', enabled: true, category: 'startup' },
      { name: 'Scale AI', url: 'https://scale.com/blog', enabled: true, category: 'startup' },
      { name: 'Weights & Biases', url: 'https://wandb.ai/blog', enabled: true, category: 'startup' },
      { name: 'LangChain', url: 'https://blog.langchain.dev', enabled: true, category: 'startup' },
      { name: 'Pinecone', url: 'https://www.pinecone.io/blog', enabled: true, category: 'startup' },
      
      // Government & Policy
      { name: 'AI.gov', url: 'https://www.ai.gov/news', enabled: true, category: 'policy' },
      { name: 'Partnership on AI', url: 'https://partnershiponai.org/news', enabled: true, category: 'policy' },
      { name: 'Future of Humanity Institute', url: 'https://www.fhi.ox.ac.uk/news', enabled: true, category: 'policy' },
      { name: 'Center for AI Safety', url: 'https://www.safe.ai/blog', enabled: true, category: 'policy' },
      
      // International Sources
      { name: 'Baidu Research', url: 'http://research.baidu.com/Blog', enabled: true, category: 'international' },
      { name: 'Tencent AI Lab', url: 'https://ai.tencent.com/ailab/en/news', enabled: true, category: 'international' },
      { name: 'DeepL', url: 'https://www.deepl.com/blog', enabled: true, category: 'international' },
      { name: 'Yandex Research', url: 'https://research.yandex.com/blog', enabled: true, category: 'international' },
      
      // Specialized AI
      { name: 'Boston Dynamics', url: 'https://www.bostondynamics.com/blog', enabled: true, category: 'robotics' },
      { name: 'Tesla AI', url: 'https://www.tesla.com/blog', enabled: true, category: 'automotive' },
      { name: 'DeepL', url: 'https://www.deepl.com/blog', enabled: true, category: 'language' },
      { name: 'Grammarly AI', url: 'https://www.grammarly.com/blog/engineering', enabled: true, category: 'language' },
      { name: 'DALL-E Labs', url: 'https://labs.openai.com', enabled: true, category: 'creative' },
      { name: 'Adobe Research', url: 'https://research.adobe.com/news', enabled: true, category: 'creative' }
  ],
  fallbackSearch: true,
  categories: ['company', 'research', 'news', 'platform', 'startup', 'policy', 'international', 'robotics', 'automotive', 'language', 'creative']
};