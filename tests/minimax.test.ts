import { describe, it, expect } from 'vitest'
import { createOpenAI } from '@ai-sdk/openai'

describe('MiniMax provider configuration', () => {
  it('creates a MiniMax provider with correct baseURL and compatibility mode', () => {
    const minimax = createOpenAI({
      baseURL: 'https://api.minimax.io/v1',
      apiKey: 'test-key',
      compatibility: 'compatible',
    })

    expect(minimax).toBeDefined()
    expect(typeof minimax).toBe('function')
  })

  it('creates a chat model instance for MiniMax-M2.7', () => {
    const minimax = createOpenAI({
      baseURL: 'https://api.minimax.io/v1',
      apiKey: 'test-key',
      compatibility: 'compatible',
    })

    const model = minimax.chat('MiniMax-M2.7')
    expect(model).toBeDefined()
    expect(model.modelId).toBe('MiniMax-M2.7')
  })

  it('creates a chat model instance for MiniMax-M2.7-highspeed', () => {
    const minimax = createOpenAI({
      baseURL: 'https://api.minimax.io/v1',
      apiKey: 'test-key',
      compatibility: 'compatible',
    })

    const model = minimax.chat('MiniMax-M2.7-highspeed')
    expect(model).toBeDefined()
    expect(model.modelId).toBe('MiniMax-M2.7-highspeed')
  })

  it('uses MINIMAX_API_KEY from environment', () => {
    const originalKey = process.env.MINIMAX_API_KEY
    process.env.MINIMAX_API_KEY = 'env-test-key'

    const minimax = createOpenAI({
      baseURL: 'https://api.minimax.io/v1',
      apiKey: process.env.MINIMAX_API_KEY,
      compatibility: 'compatible',
    })

    const model = minimax.chat('MiniMax-M2.7')
    expect(model).toBeDefined()

    if (originalKey !== undefined) {
      process.env.MINIMAX_API_KEY = originalKey
    } else {
      delete process.env.MINIMAX_API_KEY
    }
  })
})

describe('MiniMax provider with LLMScraper', () => {
  it('initializes LLMScraper with MiniMax model', async () => {
    const { default: LLMScraper } = await import('../src/index.js')
    const minimax = createOpenAI({
      baseURL: 'https://api.minimax.io/v1',
      apiKey: 'test-key',
      compatibility: 'compatible',
    })

    const scraper = new LLMScraper(minimax.chat('MiniMax-M2.7'))
    expect(scraper).toBeDefined()
    expect(scraper).toBeInstanceOf(LLMScraper)
  })

  it('initializes LLMScraper with MiniMax-M2.7-highspeed', async () => {
    const { default: LLMScraper } = await import('../src/index.js')
    const minimax = createOpenAI({
      baseURL: 'https://api.minimax.io/v1',
      apiKey: 'test-key',
      compatibility: 'compatible',
    })

    const scraper = new LLMScraper(minimax.chat('MiniMax-M2.7-highspeed'))
    expect(scraper).toBeDefined()
    expect(scraper).toBeInstanceOf(LLMScraper)
  })
})
