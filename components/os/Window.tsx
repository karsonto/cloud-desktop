import React, { useRef, useState, useEffect } from 'react';
import { X, Minus, Maximize2, Minimize2 } from 'lucide-react';
import { AppId, WindowState } from '../../types';

interface WindowProps {
  windowState: WindowState;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  children: React.ReactNode;
}

const Window: React.FC<WindowProps> = ({
  windowState,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  onMove,
  children
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (windowState.isMaximized) return;
    onFocus();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - windowState.position.x,
      y: e.clientY - windowState.position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Basic boundary checks
      const safeX = Math.max(0, Math.min(window.innerWidth - 100, newX));
      const safeY = Math.max(0, Math.min(window.innerHeight - 100, newY));
      
      onMove(safeX, safeY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, onMove]);

  if (!windowState.isOpen || windowState.isMinimized) return null;

  const style: React.CSSProperties = windowState.isMaximized
    ? { top: 0, left: 0, width: '100%', height: 'calc(100% - 48px)', borderRadius: 0 }
    : {
        top: windowState.position.x < 0 ? 0 : windowState.position.y, // Safety for y, x handled by logic
        left: windowState.position.x,
        width: windowState.size.width,
        height: windowState.size.height,
        borderRadius: '0.5rem'
      };

  return (
    <div
      ref={windowRef}
      className={`absolute flex flex-col glass-panel shadow-2xl transition-shadow duration-200 overflow-hidden text-slate-800 dark:text-slate-100 ${windowState.isMaximized ? '' : 'border border-white/20'}`}
      style={{
        ...style,
        zIndex: windowState.zIndex,
      }}
      onMouseDown={onFocus}
    >
      {/* Title Bar */}
      <div
        className="h-10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md flex items-center justify-between px-3 select-none cursor-default"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <windowState.icon size={16} className="text-slate-600 dark:text-slate-300" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{windowState.title}</span>
        </div>
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          <button onClick={onMinimize} className="p-1.5 hover:bg-white/30 rounded text-slate-600 dark:text-slate-300 transition">
            <Minus size={14} />
          </button>
          <button onClick={onMaximize} className="p-1.5 hover:bg-white/30 rounded text-slate-600 dark:text-slate-300 transition">
            {windowState.isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-red-500 hover:text-white rounded text-slate-600 dark:text-slate-300 transition group">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white/80 dark:bg-slate-900/80 relative">
        {children}
      </div>
    </div>
  );
};

export default Window;