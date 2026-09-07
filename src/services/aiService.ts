export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Gemini AI Service with model gemini-3.7-flash (and rotation on server)
 */
export const GEMINI_CONFIG = {
  modelName: 'gemini-3.7-flash',
};

/**
 * Sends prompt to the server-side /api/chat endpoint which handles API key rotation seamlessly
 */
export async function askGemini(prompt: string, model?: string, systemInstruction?: string): Promise<string> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model: model || GEMINI_CONFIG.modelName,
        systemInstruction,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server chat error (${response.status})`);
    }

    const data = await response.json();
    return data.text || 'Tidak ada respon dari Gemini AI.';
  } catch (error: any) {
    console.error('Gagal memanggil AI Assistant:', error);
    throw error;
  }
}

/**
 * Helper class matching Kotlin generativeModel.generateContent(prompt).text pattern
 */
export class GenerativeModel {
  private model?: string;

  constructor(model?: string) {
    this.model = model;
  }

  async generateContent(prompt: string): Promise<{ text: string }> {
    const text = await askGemini(prompt, this.model);
    return { text };
  }
}

export function createGenerativeModel(model?: string): GenerativeModel {
  return new GenerativeModel(model);
}

/**
 * Sends messages/prompt to the server-side /api/openrouter/chat endpoint
 * keeping OPENROUTER_API_KEY secure on the server.
 */
export async function askOpenRouter(
  messagesOrPrompt: ChatMessage[] | string,
  model: string = 'openai/gpt-4o'
): Promise<string> {
  try {
    const payload =
      typeof messagesOrPrompt === 'string'
        ? { prompt: messagesOrPrompt, model }
        : { messages: messagesOrPrompt, model };

    const response = await fetch('/api/openrouter/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `OpenRouter server error (${response.status})`);
    }

    const data = await response.json();
    return data.text || 'Tidak ada respon dari OpenRouter AI.';
  } catch (error) {
    console.error('Gagal memanggil OpenRouter AI:', error);
    throw error;
  }
}

