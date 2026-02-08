/**
 * Hybrid Task Classifier
 * Enhanced keyword matching + Hugging Face API fallback for ambiguous cases
 */

import type { TaskType } from './types.js';

// ============== Keyword Patterns ==============

const TASK_PATTERNS: Record<string, string[]> = {
    development: [
        'build', 'create', 'make', 'develop', 'implement', 'app', 'tool', 'system',
        'platform', 'website', 'webapp', 'application', 'software', 'project',
        'startup', 'product', 'service', 'solution', 'automate', 'automation',
        'bot', 'cli', 'api', 'backend', 'frontend', 'fullstack', 'saas',
        'convert', 'converter', 'generator', 'builder', 'maker'
    ],
    code: [
        'code', 'coding', 'programming', 'debug', 'debugging', 'refactor',
        'function', 'script', 'algorithm', 'syntax', 'compile', 'runtime',
        'javascript', 'python', 'typescript', 'java', 'rust', 'golang',
        'react', 'vue', 'angular', 'nodejs', 'django', 'flask'
    ],
    audio: [
        'voice', 'audio', 'speech', 'sound', 'music', 'podcast', 'transcribe',
        'transcription', 'tts', 'text-to-speech', 'speech-to-text', 'stt',
        'voice clone', 'voice conversion', 'singing', 'song', 'spoken',
        'narration', 'audiobook', 'pronunciation', 'accent'
    ],
    video: [
        'video', 'animation', 'animate', 'animated', 'movie', 'film',
        'ppt', 'powerpoint', 'presentation', 'slides', 'slideshow',
        'youtube', 'stream', 'streaming', 'clip', 'montage', 'editing',
        'render', 'rendering', 'motion', 'visual effects', 'vfx'
    ],
    vision: [
        'image', 'photo', 'picture', 'ocr', 'screenshot', 'diagram',
        'visual', 'graphic', 'chart', 'infographic', 'scan', 'recognize',
        'detect object', 'face detection', 'image recognition'
    ],
    reasoning: [
        'reason', 'reasoning', 'math', 'mathematics', 'logic', 'logical',
        'analyze', 'analysis', 'calculate', 'calculation', 'complex',
        'problem solving', 'deduce', 'inference', 'prove', 'theorem'
    ],
    embedding: [
        'embed', 'embedding', 'search', 'similarity', 'vector', 'semantic',
        'rag', 'retrieval', 'nearest neighbor', 'cosine', 'vectorize'
    ],
    classification: [
        'classify', 'classification', 'categorize', 'category', 'label',
        'labeling', 'tag', 'tagging', 'detect', 'detection', 'sentiment',
        'spam', 'filter', 'sort'
    ],
    extraction: [
        'extract', 'extraction', 'parse', 'parsing', 'scrape', 'scraping',
        'pull', 'mine', 'mining', 'data extraction', 'web scraping'
    ],
    chat: [
        'chat', 'conversation', 'talk', 'discuss', 'question', 'answer',
        'help', 'explain', 'what is', 'how to', 'tell me', 'describe'
    ]
};

// ============== Classification Result ==============

export interface ClassificationResult {
    taskType: TaskType;
    confidence: 'high' | 'medium' | 'low';
    matchedKeywords: string[];
    allScores: Record<string, number>;
    usedFallback: boolean;
}

// ============== Keyword-based Classification ==============

function classifyByKeywords(task: string): ClassificationResult {
    const taskLower = task.toLowerCase();
    const scores: Record<string, number> = {};
    const matches: Record<string, string[]> = {};

    // Score each category
    for (const [category, keywords] of Object.entries(TASK_PATTERNS)) {
        scores[category] = 0;
        matches[category] = [];

        for (const keyword of keywords) {
            if (taskLower.includes(keyword)) {
                scores[category]++;
                matches[category].push(keyword);
            }
        }
    }

    // Find highest scoring category
    const sortedCategories = Object.entries(scores)
        .sort(([, a], [, b]) => b - a);

    const [topCategory, topScore] = sortedCategories[0];
    const [secondCategory, secondScore] = sortedCategories[1] || ['', 0];

    // Determine confidence
    let confidence: 'high' | 'medium' | 'low';
    if (topScore >= 3) {
        confidence = 'high';
    } else if (topScore >= 2 || (topScore >= 1 && topScore > secondScore)) {
        confidence = 'medium';
    } else {
        confidence = 'low';
    }

    // Handle ambiguous cases: development + another category
    // If both development and a specific domain (audio/video) match, prefer the domain
    if (topCategory === 'development' && secondScore >= 1) {
        if (['audio', 'video', 'vision'].includes(secondCategory)) {
            return {
                taskType: secondCategory as TaskType,
                confidence: 'medium',
                matchedKeywords: [...matches[secondCategory], ...matches['development']],
                allScores: scores,
                usedFallback: false
            };
        }
    }

    return {
        taskType: (topScore === 0 ? 'chat' : topCategory) as TaskType,
        confidence,
        matchedKeywords: matches[topCategory] || [],
        allScores: scores,
        usedFallback: false
    };
}

// ============== Hugging Face Fallback ==============

const HF_API_URL = 'https://api-inference.huggingface.co/models/facebook/bart-large-mnli';
const HF_LABELS = ['software development', 'code programming', 'audio voice', 'video animation', 'image vision', 'reasoning math', 'text embedding search', 'classification', 'data extraction', 'chat conversation'];
const LABEL_TO_TASK: Record<string, TaskType> = {
    'software development': 'development',
    'code programming': 'code',
    'audio voice': 'audio',
    'video animation': 'video',
    'image vision': 'vision',
    'reasoning math': 'reasoning',
    'text embedding search': 'embedding',
    'classification': 'classification',
    'data extraction': 'extraction',
    'chat conversation': 'chat',
};

async function classifyWithHuggingFace(task: string): Promise<TaskType | null> {
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    // If no API key, skip HF
    if (!apiKey) {
        return null;
    }

    try {
        const response = await fetch(HF_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: task,
                parameters: {
                    candidate_labels: HF_LABELS,
                },
            }),
            signal: AbortSignal.timeout(5000), // 5s timeout
        });

        if (!response.ok) {
            return null;
        }

        const result = await response.json() as { labels: string[]; scores: number[] };

        if (result.labels && result.labels.length > 0) {
            const topLabel = result.labels[0];
            return LABEL_TO_TASK[topLabel] || 'chat';
        }
    } catch {
        // Silently fail - fallback to keyword result
    }

    return null;
}

// ============== Main Classifier ==============

export async function classifyTask(task: string): Promise<ClassificationResult> {
    // First, try keyword-based classification
    const keywordResult = classifyByKeywords(task);

    // If confidence is low, try Hugging Face fallback
    if (keywordResult.confidence === 'low') {
        const hfResult = await classifyWithHuggingFace(task);

        if (hfResult) {
            return {
                ...keywordResult,
                taskType: hfResult,
                usedFallback: true,
            };
        }
    }

    return keywordResult;
}

// Sync version for backward compatibility (no HF fallback)
export function classifyTaskSync(task: string): ClassificationResult {
    return classifyByKeywords(task);
}
