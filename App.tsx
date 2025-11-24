import React, { useState, useEffect } from 'react';
import { AppId, FileItem, WindowState } from './types';
import { INITIAL_WINDOWS, INITIAL_FILES } from './constants';
import Window from './components/os/Window';
import Taskbar from './components/os/Taskbar';
import StartMenu from './components/os/StartMenu';
import LoginScreen from './components/LoginScreen';
import FileExplorer from './components/apps/FileExplorer';
import GeminiChat from './components/apps/GeminiChat';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [windows, setWindows] = useState<Record<AppId, WindowState>>(INITIAL_WINDOWS);
  const [activeWindowId, setActiveWindowId] = useState<AppId | null>(null);
  const [maxZIndex, setMaxZIndex] = useState(10);
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [fileSystem, setFileSystem] = useState<FileItem[]>(INITIAL_FILES);

  // --- Window Management ---
  const openApp = (id: AppId) => {
    setWindows(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        isOpen: true,
        isMinimized: false,
        zIndex: maxZIndex + 1
      }
    }));
    setMaxZIndex(prev => prev + 1);
    setActiveWindowId(id);
    setIsStartOpen(false);
  };

  const closeApp = (id: AppId) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], isOpen: false }
    }));
    if (activeWindowId === id) setActiveWindowId(null);
  };

  const minimizeApp = (id: AppId) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], isMinimized: true }
    }));
    setActiveWindowId(null);
  };

  const maximizeApp = (id: AppId) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], isMaximized: !prev[id].isMaximized }
    }));
    focusApp(id);
  };

  const focusApp = (id: AppId) => {
    if (activeWindowId === id) return;
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], zIndex: maxZIndex + 1, isMinimized: false }
    }));
    setMaxZIndex(prev => prev + 1);
    setActiveWindowId(id);
  };

  const updateWindowPosition = (id: AppId, x: number, y: number) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], position: { x, y } }
    }));
  };

  const handleTaskbarAppClick = (id: AppId) => {
    const app = windows[id];
    if (app.isOpen && !app.isMinimized && activeWindowId === id) {
      minimizeApp(id);
    } else {
      openApp(id); // Handles un-minimizing too
      focusApp(id);
    }
  };

  const toggleStartMenu = () => setIsStartOpen(prev => !prev);

  // Close start menu when clicking outside
  useEffect(() => {
    const handleClick = () => setIsStartOpen(false);
    if (isStartOpen) window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [isStartOpen]);


  if (!isLoggedIn) {
    return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div 
      className="h-screen w-screen overflow-hidden bg-cover bg-center select-none font-sans"
      style={{ backgroundImage: `url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop')` }}
    >
      {/* Desktop Area - Icons can be added here in a grid */}
      <div className="absolute top-4 left-4 grid gap-6">
        {Object.values(windows).filter((w: WindowState) => w.id !== AppId.SETTINGS && w.id !== AppId.NOTEPAD).map((app: WindowState) => (
            <div 
              key={app.id} 
              onDoubleClick={() => openApp(app.id)}
              className="w-20 flex flex-col items-center gap-1 group cursor-pointer"
            >
                <div className="w-12 h-12 bg-white/10 group-hover:bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-lg transition border border-white/5">
                    <app.icon size={28} className="text-white drop-shadow-md" />
                </div>
                <span className="text-xs text-white font-medium drop-shadow-md bg-black/20 px-1.5 rounded text-center leading-tight">
                    {app.title}
                </span>
            </div>
        ))}
      </div>

      {/* Windows Layer */}
      {Object.values(windows).map((app: WindowState) => (
        <Window
          key={app.id}
          windowState={app}
          onClose={() => closeApp(app.id)}
          onMinimize={() => minimizeApp(app.id)}
          onMaximize={() => maximizeApp(app.id)}
          onFocus={() => focusApp(app.id)}
          onMove={(x, y) => updateWindowPosition(app.id, x, y)}
        >
          {app.id === AppId.FILE_EXPLORER && <FileExplorer fileSystem={fileSystem} />}
          {app.id === AppId.GEMINI_CHAT && <GeminiChat fileSystem={fileSystem} />}
          {app.id === AppId.NOTEPAD && (
             <textarea className="w-full h-full p-4 resize-none focus:outline-none bg-transparent" placeholder="Start typing..." />
          )}
          {app.id === AppId.SETTINGS && (
              <div className="p-8 text-center text-slate-500">Settings panel under construction.</div>
          )}
          {app.id === AppId.BROWSER && (
              <div className="flex flex-col h-full">
                  <div className="h-8 bg-gray-100 border-b flex items-center px-2 text-xs text-gray-500">https://www.google.com</div>
                  <iframe src="https://www.google.com/webhp?igu=1" title="browser" className="flex-1 w-full bg-white" />
              </div>
          )}
        </Window>
      ))}

      {/* Start Menu Layer */}
      <StartMenu 
        isOpen={isStartOpen} 
        onClose={() => setIsStartOpen(false)} 
        apps={windows} 
        onLaunch={openApp}
      />

      {/* Taskbar */}
      <Taskbar 
        windows={windows} 
        activeWindowId={activeWindowId} 
        onAppClick={handleTaskbarAppClick} 
        onStartClick={(e) => { e.stopPropagation(); toggleStartMenu(); }}
        isStartOpen={isStartOpen}
      />
    </div>
  );
};

export default App;