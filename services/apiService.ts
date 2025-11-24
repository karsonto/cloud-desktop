
import { ChatMessage } from '../types';

const API_BASE_URL = 'http://localhost:8000'; // Default for local dev

export interface BackendResponse {
  role: string;
  content: string;
}

export const uploadFileToBackend = async (file: File, backendUrl?: string): Promise<{ filename: string, path: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  const baseUrl = backendUrl || API_BASE_URL;

  try {
    const response = await fetch(`${baseUrl}/upload`, {
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
  backendUrl: string,
  uploadedFilename?: string
): Promise<string> => {
  try {
    const response = await fetch(`${backendUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.text })),
        filename: uploadedFilename
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
