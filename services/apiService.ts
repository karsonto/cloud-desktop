
import { ChatMessage } from '../types';

const API_BASE_URL = 'http://localhost:8000'; // Default for local dev

export interface BackendResponse {
  role: string;
  content: string;
}

export const uploadFileToBackend = async (file: File): Promise<{ filename: string, path: string }> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('File upload failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

export const sendBackendChatRequest = async (
  messages: ChatMessage[],
  model: string,
  uploadedFilename?: string,
  apiBase?: string,
  apiKey?: string
): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.text })),
        model: model,
        filename: uploadedFilename,
        llm_api_base: apiBase,
        llm_api_key: apiKey
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend Error: ${response.statusText}`);
    }

    const data: BackendResponse = await response.json();
    return data.content;
  } catch (error: any) {
    console.error('Chat API Error:', error);
    throw new Error(`Failed to communicate with backend: ${error.message}`);
  }
};
