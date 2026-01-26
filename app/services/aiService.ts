import { getRequestContext } from '@cloudflare/next-on-pages'
import { logger } from '@/lib/logger'

export interface AIInferenceParams {
    model: string
    inputs: any
}

export async function runAIInference(params: AIInferenceParams) {
    try {
        const ctx = getRequestContext()
        if (!ctx?.env?.AI) {
            throw new Error('Cloudflare AI binding not found')
        }

        const response = await ctx.env.AI.run(params.model, params.inputs)
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
