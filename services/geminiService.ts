
import { GoogleGenAI, FunctionDeclaration, Type, Tool } from '@google/genai';
import { FileItem, ChatMessage } from '../types';

// IMPORTANT: In a real app, this should be a secure backend call.
// For this demo, we use the client-side SDK with a key from env.
// Lazy initialization to avoid errors when API_KEY is not set
let genAI: GoogleGenAI | null = null;

const getGenAI = (): GoogleGenAI => {
  if (!genAI) {
    const apiKey = process.env.API_KEY || '';
    if (!apiKey) {
      throw new Error('API Key is not set. Please set the API_KEY environment variable or configure it in your environment.');
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
};

// Define tools for the agent
const listFilesTool: FunctionDeclaration = {
  name: 'listFiles',
  description: 'List all files and folders in the simulated file system.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  }
};

const readFileTool: FunctionDeclaration = {
  name: 'readFile',
  description: 'Read the content of a specific file by its exact name.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      fileName: {
        type: Type.STRING,
        description: 'The exact name of the file to read (e.g., "Project_Notes.txt")',
      },
    },
    required: ['fileName'],
  },
};

const tools: Tool[] = [{
  functionDeclarations: [listFilesTool, readFileTool]
}];

export const getGeminiClient = () => {
  return getGenAI();
};

// Helper to execute tools locally since we don't have a real backend connected yet
export const executeTool = (name: string, args: any, fileSystem: FileItem[]): string => {
  if (name === 'listFiles') {
    const files = fileSystem.map(f => `[${f.type.toUpperCase()}] ${f.name} (ID: ${f.id})`).join('\n');
    return `Here are the current files in the system:\n${files}`;
  }
  
  if (name === 'readFile') {
    const file = fileSystem.find(f => f.name === args.fileName && f.type === 'file');
    if (!file) return `Error: File "${args.fileName}" not found.`;
    return `Content of ${file.name}:\n---\n${file.content}\n---`;
  }

  return 'Error: Unknown tool.';
};

export const SYSTEM_INSTRUCTION = `
You are Athlon Agent, an intelligent AI agent integrated into a web-based operating system.

CORE BEHAVIORS:
1. **Markdown is Mandatory**: Always formatting your response using Markdown. 
   - Use \`\`\`language code \`\`\` blocks for ALL code snippets.
   - Use **bold** for emphasis.
   - Use lists for steps.
2. **File Handling**: 
   - You have access to the user's simulated file system via tools (listFiles, readFile).
   - The user may also "upload" files directly to the chat context. If a user provides file content in the prompt, analyze it thoroughly.
3. **Coding Capability**:
   - When asked to write code, provide the full code in a copyable block.
   - If analyzing a provided file, reference specific lines or sections.
4. **Tone**: Concise, professional, and helpful.
`;

export { tools };

// --- Local LLM Integration (Direct Frontend -> LLM) ---

export const sendLocalChatRequest = async (
  apiBaseUrl: string, 
  model: string, 
  messages: ChatMessage[],
  apiKey?: string
): Promise<string> => {
  
  const apiMessages = messages.map(m => ({
    role: m.role === 'model' ? 'assistant' : m.role,
    content: m.text
  }));

  // Add system instruction
  if (apiMessages.length > 0 && apiMessages[0].role !== 'system') {
    apiMessages.unshift({
      role: 'system',
      content: 'You are Athlon Agent, running locally. ' + SYSTEM_INSTRUCTION
    });
  }

  // Construct URL. Check if user provided full path or just base.
  // Standard OpenAI/vLLM is /v1/chat/completions
  let endpoint = apiBaseUrl;
  if (!endpoint.endsWith('/chat/completions')) {
      // Avoid double slash if user ends with /
      endpoint = endpoint.replace(/\/$/, "") + "/chat/completions";
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: model,
        messages: apiMessages,
        stream: false 
      }),
    });

    if (!response.ok) {
      throw new Error(`Local LLM Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Handle OpenAI/vLLM format
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }
    // Handle Ollama legacy format
    else if (data.message && data.message.content) {
      return data.message.content;
    } 

    return "Error: Could not parse response from local model.";
  } catch (error: any) {
    console.error("Failed to connect to local LLM:", error);
    throw new Error(`Connection failed: ${error.message}. Check URL and CORS.`);
  }
};
