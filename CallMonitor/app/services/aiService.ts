import { logger } from '@/lib/logger'

export interface AIInferenceParams {
    model: string
    inputs: any
}

export async function runAIInference(params: AIInferenceParams) {
    try {
        const ai = (globalThis as any).AI
        if (!ai) {
            throw new Error('Cloudflare AI binding not found')
        }

        const response = await ai.run(params.model, params.inputs)
        return response
    } catch (err: any) {
        logger.error('aiService: inference failed', err)
        throw err
    }
}

export const MODELS = {
    WHISPER: '@cf/openai/whisper',
    LLAMA_3: '@cf/meta/llama-3-8b-instruct',
    TRANSLATION: '@cf/meta/m2m100-1.2b'
}
