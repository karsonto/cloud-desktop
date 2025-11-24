import React from 'react';
import { Search, Power, User } from 'lucide-react';
import { AppId, WindowState } from '../../types';

interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  apps: Record<AppId, WindowState>;
  onLaunch: (id: AppId) => void;
}

const StartMenu: React.FC<StartMenuProps> = ({ isOpen, onClose, apps, onLaunch }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="absolute bottom-14 left-3 w-[360px] h-[500px] glass-panel dark:dark-glass-panel rounded-lg shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.2s_ease-out] z-50"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search Bar */}
      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Type here to search" 
            className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      </div>

      {/* Pinned / All Apps */}
      <div className="flex-1 overflow-y-auto p-4 pt-2">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pinned</span>
          <button className="text-xs text-blue-500 hover:underline bg-white/50 px-2 py-0.5 rounded">All apps</button>
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          {Object.values(apps).map((app: WindowState) => (
            <button 
              key={app.id} 
              onClick={() => onLaunch(app.id)}
              className="flex flex-col items-center gap-2 p-2 rounded hover:bg-white/40 dark:hover:bg-white/10 transition group"
            >
              <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-lg shadow-sm flex items-center justify-center group-hover:scale-105 transition">
                <app.icon size={24} className="text-slate-700 dark:text-slate-200" />
              </div>
              <span className="text-xs text-center text-slate-700 dark:text-slate-200 font-medium">{app.title}</span>
            </button>
          ))}
        </div>
        
        <div className="mt-6 mb-3">
             <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recommended</span>
        </div>
        <div className="space-y-1">
             <div className="flex items-center gap-3 p-2 hover:bg-white/40 dark:hover:bg-white/10 rounded cursor-pointer">
                 <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center text-blue-600 font-bold text-xs">W</div>
                 <div className="flex flex-col">
                     <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Project_Plan.docx</span>
                     <span className="text-[10px] text-slate-500">Recently opened</span>
                 </div>
             </div>
             <div className="flex items-center gap-3 p-2 hover:bg-white/40 dark:hover:bg-white/10 rounded cursor-pointer">
                 <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center text-green-600 font-bold text-xs">X</div>
                 <div className="flex flex-col">
                     <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Budget_Q4.xlsx</span>
                     <span className="text-[10px] text-slate-500">10 min ago</span>
                 </div>
             </div>
        </div>
      </div>

      {/* Footer */}
      <div className="h-14 bg-slate-100/50 dark:bg-slate-900/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
        <div className="flex items-center gap-3 hover:bg-white/50 p-1.5 rounded-lg cursor-pointer transition">
           <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white">
               <User size={16} />
           </div>
           <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Admin User</span>
        </div>
        <button className="p-2 hover:bg-white/50 rounded-lg text-slate-700 dark:text-slate-300 transition">
           <Power size={18} />
        </button>
      </div>
    </div>
  );
};

export default StartMenu;