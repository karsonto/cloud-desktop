import React, { useState, useEffect } from 'react';
import { LayoutGrid, Wifi, Volume2, Battery } from 'lucide-react';
import { AppId, WindowState } from '../../types';

interface TaskbarProps {
  windows: Record<AppId, WindowState>;
  activeWindowId: AppId | null;
  onAppClick: (id: AppId) => void;
  onStartClick: () => void;
  isStartOpen: boolean;
}

const Taskbar: React.FC<TaskbarProps> = ({ windows, activeWindowId, onAppClick, onStartClick, isStartOpen }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-12 w-full glass-panel dark:dark-glass-panel fixed bottom-0 left-0 z-50 flex items-center justify-between px-3 select-none">
      <div className="flex items-center gap-3 h-full">
        {/* Start Button */}
        <button
          onClick={onStartClick}
          className={`h-9 w-9 rounded flex items-center justify-center transition hover:bg-white/40 active:scale-95 ${isStartOpen ? 'bg-white/40' : ''}`}
        >
          <LayoutGrid className="text-blue-600 dark:text-blue-400" size={22} fill="currentColor" fillOpacity={0.2} />
        </button>

        {/* Separator */}
        <div className="w-[1px] h-6 bg-gray-400/30 mx-1"></div>

        {/* Open Apps */}
        <div className="flex items-center gap-1">
          {Object.values(windows).filter((w: WindowState) => w.isOpen).map((app: WindowState) => (
            <button
              key={app.id}
              onClick={() => onAppClick(app.id)}
              className={`
                h-9 px-3 rounded flex items-center gap-2 transition hover:bg-white/30
                ${activeWindowId === app.id && !app.isMinimized ? 'bg-white/40 dark:bg-white/10 shadow-sm' : 'opacity-80 hover:opacity-100'}
                relative group
              `}
            >
              <app.icon size={18} className="text-slate-700 dark:text-slate-200" />
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200 hidden sm:block max-w-[80px] truncate">
                {app.title}
              </span>
              {/* Indicator for open app */}
              <div className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${activeWindowId === app.id && !app.isMinimized ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
            </button>
          ))}
        </div>
      </div>

      {/* System Tray */}
      <div className="flex items-center gap-4 h-full pl-4">
        <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
           <Wifi size={16} />
           <Volume2 size={16} />
           <Battery size={16} />
        </div>
        <div className="flex flex-col items-end justify-center h-full text-xs text-slate-800 dark:text-slate-200 leading-tight cursor-default px-2 hover:bg-white/20 rounded transition">
          <span className="font-medium">{formatTime(time)}</span>
          <span className="text-slate-600 dark:text-slate-400">{formatDate(time)}</span>
        </div>
      </div>
    </div>
  );
};

export default Taskbar;