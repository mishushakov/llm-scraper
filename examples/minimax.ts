import { chromium } from 'playwright'
import { Output, wrapLanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import LLMScraper from './../src/index.js'

// Initialize MiniMax provider using OpenAI-compatible API
const minimax = createOpenAI({
  baseURL: 'https://api.minimax.io/v1',
  apiKey: process.env.MINIMAX_API_KEY,
  compatibility: 'compatible',
})

// MiniMax M2.7 is a thinking model that wraps responses with <think> tags.
// Use middleware to:
// 1. Downgrade json_schema to json_object (MiniMax doesn't support json_schema)
// 2. Embed the JSON schema in the system prompt so the model knows the format
// 3. Strip <think> tags from responses for clean structured output
const llm = wrapLanguageModel({
  model: minimax.chat('MiniMax-M2.7'),
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

// Launch a browser instance
const browser = await chromium.launch()

// Initialize a new LLMScraper with MiniMax model
const scraper = new LLMScraper(llm)

// Open the page
const page = await browser.newPage()
await page.goto('https://example.com')

// Define schema to extract contents into
const schema = z.object({
  h1: z.string().describe('The main heading of the page'),
})

// Run the scraper
const { data } = await scraper.run(page, Output.object({ schema }), {
  format: 'html',
})

console.log(data)

await page.close()
await browser.close()
