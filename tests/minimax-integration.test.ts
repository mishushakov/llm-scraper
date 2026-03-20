import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createOpenAI } from '@ai-sdk/openai'
import { wrapLanguageModel } from 'ai'
import { z } from 'zod'
import { Output } from 'ai'
import { chromium, Browser } from 'playwright'
import LLMScraper from '../src/index.js'

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY

// Middleware for MiniMax M2.7:
// 1. Downgrade json_schema to json_object (MiniMax doesn't support json_schema)
// 2. Embed schema in system prompt so the model knows the expected format
// 3. Strip <think>...</think> tags from responses
function createMiniMaxModel(modelId: string, apiKey: string) {
  const minimax = createOpenAI({
    baseURL: 'https://api.minimax.io/v1',
    apiKey,
    compatibility: 'compatible',
  })

  return wrapLanguageModel({
    model: minimax.chat(modelId),
    middleware: {
      transformParams: async ({ params }) => {
        if (params.responseFormat?.type === 'json' && params.responseFormat?.schema) {
          const schemaStr = JSON.stringify(params.responseFormat.schema)
          const jsonInstruction = `\n\nYou MUST respond with ONLY valid JSON matching this schema: ${schemaStr}`
          const newPrompt = Array.isArray(params.prompt)
            ? params.prompt.map((msg: any) =>
                msg.role === 'system' && typeof msg.content === 'string'
                  ? { ...msg, content: msg.content + jsonInstruction }
                  : msg
              )
            : params.prompt
          return { ...params, responseFormat: { type: 'json' }, prompt: newPrompt }
        }
        return params
      },
      wrapGenerate: async ({ doGenerate }) => {
        const result = await doGenerate()
        return {
          ...result,
          content: result.content?.map((part: any) =>
            part.type === 'text'
              ? { ...part, text: part.text?.replace(/<think>[\s\S]*?<\/think>\s*/g, '') }
              : part
          ),
        }
      },
      wrapStream: async ({ doStream }) => {
        const { stream, ...rest } = await doStream()
        let thinking = false
        return {
          stream: stream.pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                if (chunk.type === 'text-delta') {
                  let text = (chunk as any).delta || chunk.textDelta || ''
                  if (text.includes('<think>')) thinking = true
                  if (thinking) {
                    const endIdx = text.indexOf('</think>')
                    if (endIdx !== -1) {
                      thinking = false
                      text = text.slice(endIdx + '</think>'.length)
                    } else {
                      return
                    }
                  }
                  if (text)
                    controller.enqueue({ ...chunk, delta: text, textDelta: text })
                } else {
                  controller.enqueue(chunk)
                }
              },
            })
          ),
          ...rest,
        }
      },
    },
  })
}

const describeIntegration = MINIMAX_API_KEY ? describe : describe.skip

describeIntegration('MiniMax integration tests', () => {
  let browser: Browser
  let scraper: LLMScraper

  beforeAll(async () => {
    browser = await chromium.launch({ channel: 'chrome' })
    scraper = new LLMScraper(createMiniMaxModel('MiniMax-M2.7', MINIMAX_API_KEY!))
  }, 30000)

  afterAll(async () => {
    if (browser) {
      await browser.close()
    }
  })

  it('scrapes example.com heading with MiniMax', async () => {
    const page = await browser.newPage()
    await page.goto('https://example.com')

    const schema = z.object({
      h1: z.string().describe('The main heading of the page'),
    })

    const { data } = await scraper.run(page, Output.object({ schema }), {
      format: 'html',
    })

    expect(data).toBeDefined()
    expect(data.h1).toBe('Example Domain')

    await page.close()
  }, 60000)

  it('scrapes example.com with streaming using MiniMax', async () => {
    const page = await browser.newPage()
    await page.goto('https://example.com')

    const schema = z.object({
      h1: z.string().describe('The main heading of the page'),
    })

    const { stream } = await scraper.stream(page, Output.object({ schema }))

    let text = ''
    for await (const item of stream) {
      text = item.h1 || ''
    }

    expect(text).toBe('Example Domain')

    await page.close()
  }, 60000)

  it('scrapes example.com with markdown format using MiniMax', async () => {
    const page = await browser.newPage()
    await page.goto('https://example.com')

    const schema = z.object({
      title: z.string().describe('The title or main heading of the page'),
      description: z.string().describe('A brief description found on the page'),
    })

    const { data } = await scraper.run(page, Output.object({ schema }), {
      format: 'markdown',
    })

    expect(data).toBeDefined()
    expect(data.title).toBeTruthy()
    expect(data.description).toBeTruthy()

    await page.close()
  }, 60000)
})
