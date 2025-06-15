import Anthropic from '@anthropic-ai/sdk';

export interface LLMConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class LLMService {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: LLMConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey
    });
    
    this.model = config.model || 'claude-3-opus-20240229';
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature || 0.7;
  }

  async complete(prompt: string, options?: Partial<LLMConfig>): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: options?.model || this.model,
        max_tokens: options?.maxTokens || this.maxTokens,
        temperature: options?.temperature || this.temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }
      
      throw new Error('Unexpected response type from LLM');
    } catch (error) {
      console.error('LLM completion error:', error);
      throw error;
    }
  }

  async completeWithSystem(
    systemPrompt: string, 
    userPrompt: string, 
    options?: Partial<LLMConfig>
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: options?.model || this.model,
        max_tokens: options?.maxTokens || this.maxTokens,
        temperature: options?.temperature || this.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }
      
      throw new Error('Unexpected response type from LLM');
    } catch (error) {
      console.error('LLM completion error:', error);
      throw error;
    }
  }

  async stream(prompt: string, options?: Partial<LLMConfig>): Promise<AsyncIterable<string>> {
    const stream = await this.client.messages.create({
      model: options?.model || this.model,
      max_tokens: options?.maxTokens || this.maxTokens,
      temperature: options?.temperature || this.temperature,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: true
    });

    return this.createAsyncIterableFromStream(stream);
  }

  private async *createAsyncIterableFromStream(
    stream: AsyncIterable<Anthropic.MessageStreamEvent>
  ): AsyncIterable<string> {
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}