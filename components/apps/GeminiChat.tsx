
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Terminal, Loader2, Settings, Server, Cpu, Paperclip, X, FileCode, Copy, Check, Trash2, Eye, Code } from 'lucide-react';
import { sendLocalChatRequest } from '../../services/geminiService';
import { uploadFileToBackend, sendBackendChatRequest } from '../../services/apiService';
import { ChatMessage, FileItem } from '../../types';

interface GeminiChatProps {
  fileSystem: FileItem[];
}

type LocalMode = 'direct' | 'interpreter';

interface AgentConfig {
  localMode: LocalMode;
  backendUrl: string; // Backend server URL for interpreter mode (e.g. http://localhost:8000)
  localModel: string; // Only for direct mode
  apiBaseUrl: string; // Only for direct mode (e.g. http://localhost:8000/v1)
  apiKey: string; // Only for direct mode
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

const HtmlPreviewBlock: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 确保 HTML 内容完整（如果没有 html/head/body 标签，自动包装）
  const getFullHtml = (html: string): string => {
    const trimmed = html.trim();
    // 如果已经包含完整的 HTML 结构，直接返回
    if (trimmed.toLowerCase().startsWith('<!doctype') || 
        (trimmed.toLowerCase().includes('<html') && trimmed.toLowerCase().includes('</html>'))) {
      return trimmed;
    }
    // 如果只有部分 HTML 标签，包装成完整文档
    if (trimmed.toLowerCase().startsWith('<html') || 
        trimmed.toLowerCase().startsWith('<head') || 
        trimmed.toLowerCase().startsWith('<body')) {
      return `<!DOCTYPE html>\n<html>\n<head><meta charset="UTF-8"></head>\n<body>\n${trimmed}\n</body>\n</html>`;
    }
    // 否则包装成完整的 HTML 文档
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HTML Preview</title>
</head>
<body>
${trimmed}
</body>
</html>`;
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-slate-700 bg-[#1e1e1e] shadow-lg">
      <div className="flex justify-between items-center px-4 py-2 bg-[#2d2d2d] border-b border-slate-700">
        <span className="text-xs font-mono text-slate-400 lowercase">html</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
            title={showPreview ? '查看源代码' : '预览 HTML'}
          >
            {showPreview ? <Code size={14} /> : <Eye size={14} />}
            {showPreview ? '源代码' : '预览'}
          </button>
          <button 
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      {showPreview ? (
        <div className="w-full bg-white border-t border-slate-700" style={{ minHeight: '300px', maxHeight: '600px', overflow: 'auto' }}>
          <iframe
            srcDoc={getFullHtml(value)}
            className="w-full border-0"
            style={{ minHeight: '300px', height: '100%', width: '100%' }}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            title="HTML Preview"
          />
        </div>
      ) : (
        <div className="p-4 overflow-x-auto">
          <pre className="font-mono text-sm text-slate-300 leading-relaxed whitespace-pre">
            <code>{value}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

const MessageRenderer: React.FC<{ text: string }> = ({ text }) => {
  // 使用更简单的正则表达式分割文本
  // 匹配代码块：```language\n...code...```
  const parts = text.split(/(```[\s\S]*?```|!\[.*?\]\(.*?\))/g);

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        // 检查是否为代码块
        if (part.startsWith('```')) {
          // 提取语言和代码 - 使用更可靠的正则表达式
          const codeBlockMatch = part.match(/```(\w+)?\s*\n([\s\S]*?)```/) || part.match(/```(\w+)?\s*([\s\S]*?)```/);
          if (codeBlockMatch) {
            const language = (codeBlockMatch[1] || '').trim().toLowerCase();
            const code = (codeBlockMatch[2] || '').trim();
            
            // 检测是否为 HTML - 更严格的检测逻辑
            const hasHtmlDoctype = /<!DOCTYPE\s+html\s*/i.test(code);
            const hasHtmlTag = /<html[\s>]/i.test(code);
            const hasHeadBody = /<head[\s>]/i.test(code) && /<body[\s>]/i.test(code);
            const hasHtmlElements = /<(div|p|h1|h2|h3|span|a|button|header|nav|footer|section|article|style)[\s>]/i.test(code);
            
            const isHtml = language === 'html' || 
                          hasHtmlDoctype ||
                          (hasHtmlTag && (hasHeadBody || hasHtmlElements)) ||
                          (language === '' && (hasHeadBody || (hasHtmlElements && code.includes('</'))));
            
            // 添加调试日志
            if (isHtml) {
              console.log('Detected HTML code block:', { language, hasHtmlDoctype, hasHtmlTag, hasHeadBody, hasHtmlElements, codeLength: code.length });
            }
            
            if (isHtml) {
              return <HtmlPreviewBlock key={index} value={code} />;
            }
            return <CodeBlock key={index} language={language} value={code} />;
          }
        } 
        // 检查是否为图片
        else if (part.startsWith('![') && part.includes('](')) {
          const imageMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
          if (imageMatch) {
            let url = imageMatch[2];
            if (url.startsWith('/static')) {
              url = `http://localhost:8000${url}`;
            }
            return (
              <div key={index} className="my-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-black">
                <img src={url} alt={imageMatch[1]} className="max-w-full h-auto" />
              </div>
            );
          }
        }
        
        // 渲染普通文本
        if (!part.trim()) return null;
        
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
    { role: 'model', text: 'Hello! I am Athlon Agent. Connect me to vLLM or Ollama.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploadedBackendFilename, setUploadedBackendFilename] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<AgentConfig>({
    localMode: 'interpreter', 
    backendUrl: 'http://localhost:8000', // Default backend server
    localModel: 'athlon-coder',
    apiBaseUrl: 'http://localhost:8000/v1', // Default Ollama/vLLM local address
    apiKey: ''
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, attachment]);

  const handleClearChat = () => {
      setMessages([
        { role: 'model', text: 'Hello! I am Athlon Agent. Ready to assist.' }
      ]);
      setAttachment(null);
      setUploadedBackendFilename(undefined);
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
          let responseText = "";

          // Decide: Direct connection OR Backend Interpreter?
          if (config.localMode === 'interpreter') {
              // INTERPRETER MODE (Uses Python Backend to execute code)
              // Backend handles all LLM configuration
              let filenameForRequest = uploadedBackendFilename;

              // Upload file if new attachment
              if (currentAttachment && currentAttachment.fileObject) {
                  setMessages(prev => [...prev, { role: 'model', text: `Uploading ${currentAttachment.name} to analysis backend...` }]);
                  const uploadResult = await uploadFileToBackend(currentAttachment.fileObject, config.backendUrl);
                  filenameForRequest = uploadResult.filename;
                  setUploadedBackendFilename(filenameForRequest);
              }

              responseText = await sendBackendChatRequest(
                  newMessages, 
                  config.backendUrl,
                  filenameForRequest
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
      } catch (err: any) {
          console.error(err);
          setMessages(prev => [...prev, { role: 'model', text: `Error: ${err.message}`, isError: true }]);
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 relative">
      {/* Header */}
      <div className="absolute top-0 left-0 w-full h-10 flex justify-between items-center px-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur z-10 border-b border-gray-200 dark:border-gray-700">
         <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
             <Server size={12} />
             <span>Local ({config.localMode})</span>
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
                <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">Mode</label>
                    <div className="flex gap-2">
                        <label className="flex items-center gap-1 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                            <input type="radio" name="mode" checked={config.localMode === 'interpreter'} onChange={() => setConfig({...config, localMode: 'interpreter'})} />
                            Interpreter (Python)
                        </label>
                        <label className="flex items-center gap-1 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                            <input type="radio" name="mode" checked={config.localMode === 'direct'} onChange={() => setConfig({...config, localMode: 'direct'})} />
                            Direct Chat
                        </label>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-tight">
                        {config.localMode === 'interpreter' 
                         ? 'Runs code on backend. Backend handles LLM configuration in Docker.'
                         : 'Connects directly to LLM API from browser.'}
                    </p>
                </div>

                {config.localMode === 'interpreter' ? (
                    <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Backend Server URL</label>
                        <input 
                            type="text" 
                            value={config.backendUrl} 
                            onChange={(e) => setConfig({...config, backendUrl: e.target.value})} 
                            className="w-full text-xs px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                            placeholder="e.g. http://localhost:8000"
                        />
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                            Backend server address. LLM configuration is handled in Docker.
                        </p>
                    </div>
                ) : (
                    <>
                        <div>
                            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Model Name</label>
                            <input 
                                type="text" 
                                value={config.localModel} 
                                onChange={(e) => setConfig({...config, localModel: e.target.value})} 
                                className="w-full text-xs px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                                placeholder="e.g. llama3, qwen2.5"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">API Base URL</label>
                            <input 
                                type="text" 
                                value={config.apiBaseUrl} 
                                onChange={(e) => setConfig({...config, apiBaseUrl: e.target.value})} 
                                className="w-full text-xs px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                                placeholder="e.g. http://localhost:11434/v1"
                            />
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                For vLLM/OpenAI compatible servers. Ensure it ends with /v1 if needed.
                            </p>
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">API Key (Optional)</label>
                            <input 
                                type="password" 
                                value={config.apiKey} 
                                onChange={(e) => setConfig({...config, apiKey: e.target.value})} 
                                className="w-full text-xs px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500" 
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
                 <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-lg bg-green-600">
                     <Cpu size={16} className="text-white" />
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
