export default function handler(req, res) {
    res.json({
        claudeKeyExists: !!process.env.CLAUDE_API_KEY,
        claudeKeyLength: process.env.CLAUDE_API_KEY?.length || 0,
        claudeKeyPrefix: process.env.CLAUDE_API_KEY?.substring(0, 20) + '...' || 'Not found',
        allEnvVars: Object.keys(process.env).filter(key => key.includes('CLAUDE'))
    });
}
