import {
  generateText,
  streamText,
  type LanguageModel,
  type UserContent,
  type Output,
  ModelMessage,
} from 'ai'
import { ScraperLLMOptions, ScraperGenerateOptions } from './index.js'
import { PreProcessResult } from './preprocess.js'

const systemPrompt =
  'You are a sophisticated web scraper. Extract the contents of the webpage'

const systemCodePrompt =
  "Provide a scraping function in JavaScript that extracts and returns data according to a schema from the current page. The function must be IIFE. No comments or imports. No console.log. The code you generate will be executed straight away, you shouldn't output anything besides runnable code."

function stripMarkdownBackticks(text: string) {
  let trimmed = text.trim()
  trimmed = trimmed.replace(/^```(?:javascript)?\s*/i, '')
  trimmed = trimmed.replace(/\s*```$/i, '')
  return trimmed
}

function prepareAISDKPage(page: PreProcessResult): UserContent {
  if (page.format === 'image') {
    return [
      {
        type: 'image',
        image: page.content,
      },
    ]
  }
  return [{ type: 'text', text: page.content }]
}

export async function generateAISDKCompletions<OUTPUT extends Output.Output = Output.Output<string, string>>(
  model: LanguageModel,
  page: PreProcessResult,
  output: OUTPUT,
  options?: ScraperLLMOptions
) {
  const pageContent = prepareAISDKPage(page)

  const { system = systemPrompt, messages: messagesOptions, ...rest } = options || {}
  const messages: ModelMessage[] = [
    { role: 'user' as const, content: pageContent },
    ...(messagesOptions || []),
  ]

  const result = await generateText({
    model,
    output,
    system,
    messages,
    ...rest,
  })

  return {
    data: result.output,
    url: page.url,
  }
}

export function streamAISDKCompletions<OUTPUT extends Output.Output = Output.Output<string, string>>(
  model: LanguageModel,
  page: PreProcessResult,
  output: OUTPUT,
  options?: ScraperLLMOptions
) {
  const pageContent = prepareAISDKPage(page)

  const { system = systemPrompt, messages: messagesOptions, ...rest } = options || {}
  const messages: ModelMessage[] = [
    { role: 'user' as const, content: pageContent },
    ...(messagesOptions || []),
  ]

  const { partialOutputStream } = streamText({
    model,
    output,
    system,
    messages,
    ...rest,
  })

  return {
    stream: partialOutputStream,
    url: page.url,
  }
}

export async function generateAISDKCode<OUTPUT extends Output.Output = Output.Output<string, string>>(
  model: LanguageModel,
  page: PreProcessResult,
  output: OUTPUT,
  options?: ScraperGenerateOptions
) {
  const responseFormat = await output.responseFormat

  // Extract JSON Schema from responseFormat (AI SDK already converts Zod schemas to JSON Schema)
  const jsonSchema =
    responseFormat.type === 'json' && 'schema' in responseFormat
      ? (responseFormat as { schema: unknown }).schema
      : output

  const { system = systemCodePrompt, messages: messagesOptions, ...rest } = options || {}
  const messages = [
    {
      role: 'user' as const,
      content: `Website: ${page.url}
      Schema: ${JSON.stringify(jsonSchema)}
      Content: ${page.content}`,
    },
    ...(messagesOptions || []),
  ]

  const result = await generateText({
    model,
    system,
    messages,
    ...rest,
  })

  return {
    code: stripMarkdownBackticks(result.text),
    url: page.url,
  }
}
