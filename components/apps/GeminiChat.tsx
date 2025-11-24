
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Terminal, Loader2, Settings, Server, Cloud, Cpu, Paperclip, X, FileCode, Copy, Check, Trash2 } from 'lucide-react';
import { getGeminiClient, executeTool, SYSTEM_INSTRUCTION, tools, sendLocalChatRequest } from '../../services/geminiService';
import { uploadFileToBackend, sendBackendChatRequest } from '../../services/apiService';
import { ChatMessage, FileItem } from '../../types';

interface GeminiChatProps {
  fileSystem: FileItem[];
}

type Provider = 'cloud' | 'local';
type LocalMode = 'direct' | 'interpreter';

interface AgentConfig {
  provider: Provider;
  localMode: LocalMode;
  localModel: string;
  apiBaseUrl: string; // e.g. http://localhost:8000/v1
  apiKey: string;
}

interface Attachment {
  name: string;
  fileObject?: File; // Added to store actual file for backend upload
  type: string;
  content?: string; // For preview only
}

// --- Helper Components for Markdown/Code Rendering ---

const CodeBlock: React.FC<{ language: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-slate-700 bg-[#1e1e1e] shadow-lg">
      <div className="flex justify-between items-center px-4 py-2 bg-[#2d2d2d] border-b border-slate-700">
        <span className="text-xs font-mono text-slate-400 lowercase">{language || 'code'}</span>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="font-mono text-sm text-slate-300 leading-relaxed whitespace-pre">
          <code>{value}</code>
        </pre>
      </div>
    </div>
  );
};

const MessageRenderer: React.FC<{ text: string }> = ({ text }) => {
  // Regex to split by code blocks AND markdown images
  // Matches ```code``` OR ![alt](url)
  const parts = text.split(/(```[\s\S]*?```|!\[.*?\]\(.*?\))/g);

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w*)?\n?([\s\S]*?)```/);
          if (match) {
            const language = match[1] || '';
            const code = match[2] || '';
            return <CodeBlock key={index} language={language} value={code.trim()} />;
          }
        } else if (part.startsWith('![') && part.includes('](')) {
            // Render Image, fixing backend URL path if needed
            // The backend returns /static/xxx.png. We assume backend is at localhost:8000 for now.
            const match = part.match(/!\[(.*?)\]\((.*?)\)/);
            if (match) {
                let url = match[2];
                if (url.startsWith('/static')) {
                    url = `http://localhost:8000${url}`;
                }
                return (
                    <div key={index} className="my-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-black">
                        <img src={url} alt={match[1]} className="max-w-full h-auto" />
                    </div>
                );
            }
        }
        
        if (!part.trim()) return null;

        // Render regular text with formatting
        return (
            <div key={index} className="whitespace-pre-wrap">
                {part.split(/(\*\*.*?\*\*)/g).map((subPart, i) => {
                    if (subPart.startsWith('**') && subPart.endsWith('**')) {
                        return <strong key={i}>{subPart.slice(2, -2)}</strong>;
                    }
                    return subPart;
                })}
            </div>
        );
      })}
    </div>
  );
};

// --- Main Component ---

const GeminiChat: React.FC<GeminiChatProps> = ({ fileSystem }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hello! I am Athlon Agent. Connect me to vLLM, Ollama or cloud models.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploadedBackendFilename, setUploadedBackendFilename] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<AgentConfig>({
    provider: 'local',
    localMode: 'interpreter', 
    localModel: 'athlon-coder',
    apiBaseUrl: 'http://localhost:8000/v1', // Default Ollama/vLLM local address
    apiKey: ''
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, attachment]);

  // Init Cloud Session (Legacy/Optional)
  const initCloudSession = () => {
      const client = getGeminiClient();
      chatSessionRef.current = client.chats.create({
          model: 'gemini-2.5-flash',
          config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              tools: tools,
          }
      });
  };

  const handleClearChat = () => {
      setMessages([
        { role: 'model', text: 'Hello! I am Athlon Agent. Ready to assist.' }
      ]);
      setAttachment(null);
      setUploadedBackendFilename(undefined);
      if (config.provider === 'cloud') {
          initCloudSession();
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachment({
        name: file.name,
        type: file.name.split('.').pop() || 'file',
        fileObject: file,
        content: "File ready for upload..." 
    });
    
    e.target.value = '';
  };

  const processMessage = async () => {
      if ((!input.trim() && !attachment) || isLoading) return;
      
      let userDisplayMessage = input;
      if (attachment) {
          userDisplayMessage = `[Uploaded ${attachment.name}] ${input}`;
      }

      const newMessages = [...messages, { role: 'user', text: userDisplayMessage } as ChatMessage];
      setMessages(newMessages);
      setInput('');
      setIsLoading(true);
      
      // Store current attachment locally to handle upload, then clear UI state
      const currentAttachment = attachment;
      setAttachment(null);

      try {
          if (config.provider === 'cloud') {
              // Cloud logic
              let textToSend = input;
               if (currentAttachment && currentAttachment.fileObject) {
                  textToSend += `\n[User attached file: ${currentAttachment.name}]`;
               }
               await processCloudMessage(textToSend);
          } else {
              // LOCAL LOGIC
              let responseText = "";

              // Decide: Direct connection OR Backend Interpreter?
              if (config.localMode === 'interpreter') {
                  // INTERPRETER MODE (Uses Python Backend to execute code)
                  let filenameForRequest = uploadedBackendFilename;

                  // Upload file if new attachment
                  if (currentAttachment && currentAttachment.fileObject) {
                      setMessages(prev => [...prev, { role: 'model', text: `Uploading ${currentAttachment.name} to analysis backend...` }]);
                      const uploadResult = await uploadFileToBackend(currentAttachment.fileObject);
                      filenameForRequest = uploadResult.filename;
                      setUploadedBackendFilename(filenameForRequest);
                  }

                  responseText = await sendBackendChatRequest(
                      newMessages, 
                      config.localModel,
                      filenameForRequest,
                      config.apiBaseUrl,
                      config.apiKey
                  );
              } else {
                  // DIRECT MODE (Frontend -> vLLM directly, no code execution)
                  responseText = await sendLocalChatRequest(
                      config.apiBaseUrl,
                      config.localModel,
                      newMessages,
                      config.apiKey
                  );
              }
              
              setMessages(prev => [...prev, { role: 'model', text: responseText }]);
          }
      } catch (err: any) {
          console.error(err);
          setMessages(prev => [...prev, { role: 'model', text: `Error: ${err.message}`, isError: true }]);
      } finally {
          setIsLoading(false);
      }
  };

  const processCloudMessage = async (text: string) => {
      if (!chatSessionRef.current) initCloudSession();
      const response = await chatSessionRef.current.sendMessage({ message: text });
      if (response.text) {
         setMessages(prev => [...prev, { role: 'model', text: response.text }]);
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 relative">
      {/* Header */}
      <div className="absolute top-0 left-0 w-full h-10 flex justify-between items-center px-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur z-10 border-b border-gray-200 dark:border-gray-700">
         <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
             {config.provider === 'cloud' ? <Cloud size={12} /> : <Server size={12} />}
             <span>{config.provider === 'cloud' ? 'Gemini Cloud' : `Local (${config.localMode})`}</span>
         </div>
         <div className="flex items-center gap-1">
             <button onClick={handleClearChat} className="p-1 hover:bg-red-100 text-slate-500 transition rounded"><Trash2 size={14} /></button>
             <button onClick={() => setShowSettings(!showSettings)} className="p-1 hover:bg-slate-200 text-slate-500 transition rounded"><Settings size={14} /></button>
         </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-10 right-0 w-72 bg-white dark:bg-slate-800 shadow-xl border-l border-b border-gray-200 dark:border-gray-700 p-4 z-20 max-h-[500px] overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Settings</h3>
            <div className="space-y-4">
                <div className="flex bg-slate-100 dark:bg-slate-900 rounded p-1">
                    <button onClick={() => setConfig({...config, provider: 'cloud'})} className={`flex-1 text-xs py-1 rounded ${config.provider === 'cloud' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Cloud</button>
                    <button onClick={() => setConfig({...config, provider: 'local'})} className={`flex-1 text-xs py-1 rounded ${config.provider === 'local' ? 'bg-white shadow text-green-600' : 'text-slate-500'}`}>Local</button>
                </div>
                
                {config.provider === 'local' && (
                    <>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700">
                            <label className="text-xs font-semibold text-slate-500 block mb-2">Mode</label>
                            <div className="flex gap-2">
                                <label className="flex items-center gap-1 text-xs cursor-pointer">
                                    <input type="radio" name="mode" checked={config.localMode === 'interpreter'} onChange={() => setConfig({...config, localMode: 'interpreter'})} />
                                    Interpreter (Python)
                                </label>
                                <label className="flex items-center gap-1 text-xs cursor-pointer">
                                    <input type="radio" name="mode" checked={config.localMode === 'direct'} onChange={() => setConfig({...config, localMode: 'direct'})} />
                                    Direct Chat
                                </label>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                                {config.localMode === 'interpreter' 
                                 ? 'Runs code on backend (port 8000). Backend connects to LLM.'
                                 : 'Connects directly to LLM API from browser.'}
                            </p>
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 block mb-1">Model Name</label>
                            <input 
                                type="text" 
                                value={config.localModel} 
                                onChange={(e) => setConfig({...config, localModel: e.target.value})} 
                                className="w-full text-xs px-2 py-1 bg-slate-50 border rounded" 
                                placeholder="e.g. llama3, qwen2.5"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 block mb-1">API Base URL</label>
                            <input 
                                type="text" 
                                value={config.apiBaseUrl} 
                                onChange={(e) => setConfig({...config, apiBaseUrl: e.target.value})} 
                                className="w-full text-xs px-2 py-1 bg-slate-50 border rounded" 
                                placeholder="e.g. http://localhost:11434/v1"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                                For vLLM/OpenAI compatible servers. Ensure it ends with /v1 if needed.
                            </p>
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 block mb-1">API Key (Optional)</label>
                            <input 
                                type="password" 
                                value={config.apiKey} 
                                onChange={(e) => setConfig({...config, apiKey: e.target.value})} 
                                className="w-full text-xs px-2 py-1 bg-slate-50 border rounded" 
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 pt-12 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
             {msg.role === 'model' && (
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-lg ${config.provider === 'local' ? 'bg-green-600' : 'bg-indigo-600'}`}>
                     {config.provider === 'local' ? <Cpu size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
                 </div>
             )}
             <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                 msg.role === 'user' 
                 ? 'bg-blue-600 text-white rounded-br-none' 
                 : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-100 dark:border-slate-700'
             }`}>
                {msg.isError ? <span className="text-red-500">{msg.text}</span> : <MessageRenderer text={msg.text} />}
             </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center animate-pulse">...</div>
                <div className="text-xs text-slate-400 self-center">Processing...</div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-gray-700">
        {attachment && (
            <div className="mb-2 flex items-center gap-2 bg-blue-50 p-2 rounded border border-blue-100">
                <FileCode size={14} className="text-blue-500" />
                <span className="text-xs text-blue-700 truncate">{attachment.name}</span>
                <button onClick={() => setAttachment(null)}><X size={14} className="text-blue-400" /></button>
            </div>
        )}
        <div className="flex gap-2 items-center bg-gray-100 dark:bg-slate-900 rounded-xl p-2 border border-transparent focus-within:border-blue-500 transition">
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-gray-400 hover:text-blue-600"><Paperclip size={18} /></button>
          <input
            className="flex-1 bg-transparent border-none focus:outline-none text-sm text-slate-800 dark:text-slate-200 px-2"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && processMessage()}
          />
          <button onClick={processMessage} disabled={(!input.trim() && !attachment) || isLoading} className="p-2 bg-blue-600 text-white rounded-lg"><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
};

export default GeminiChat;
