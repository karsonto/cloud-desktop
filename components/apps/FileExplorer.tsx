import React, { useState, useMemo } from 'react';
import { Folder, FileText, ArrowLeft, Search, File, HardDrive } from 'lucide-react';
import { FileItem } from '../../types';

interface FileExplorerProps {
  fileSystem: FileItem[];
}

const FileExplorer: React.FC<FileExplorerProps> = ({ fileSystem }) => {
  const [currentPath, setCurrentPath] = useState<string>('root');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const currentFiles = useMemo(() => {
    return fileSystem.filter(f => f.parentId === currentPath);
  }, [fileSystem, currentPath]);

  const currentFolder = fileSystem.find(f => f.id === currentPath);
  
  const handleNavigate = (file: FileItem) => {
    if (file.type === 'folder') {
      setCurrentPath(file.id);
      setSelectedFile(null);
    } else {
      setSelectedFile(file.id);
    }
  };

  const goUp = () => {
    if (currentFolder && currentFolder.parentId) {
      setCurrentPath(currentFolder.parentId);
      setSelectedFile(null);
    }
  };

  return (
    <div className="flex flex-col h-full text-slate-800 dark:text-slate-100">
      {/* Toolbar */}
      <div className="h-12 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-4 bg-gray-50 dark:bg-slate-800/50">
        <button 
          onClick={goUp} 
          disabled={!currentFolder?.parentId}
          className={`p-1 rounded ${!currentFolder?.parentId ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        >
          <ArrowLeft size={18} />
        </button>
        
        <div className="flex-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-1 text-sm flex items-center">
          <HardDrive size={14} className="mr-2 opacity-50" />
          <span>{currentPath === 'root' ? 'C:' : currentFolder?.name}</span>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-2 top-1.5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search" 
            className="pl-8 pr-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-700 focus:outline-none w-48"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 bg-gray-50 dark:bg-slate-800/30 border-r border-gray-200 dark:border-gray-700 p-2 text-sm hidden sm:block">
          <div className="flex items-center gap-2 p-2 hover:bg-blue-100 dark:hover:bg-slate-700 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium">
             <HardDrive size={16} />
             <span>Local Disk (C:)</span>
          </div>
        </div>

        {/* Main View */}
        <div className="flex-1 p-4 overflow-y-auto">
          {currentFiles.length === 0 ? (
            <div className="text-gray-400 text-center mt-10">This folder is empty</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {currentFiles.map(file => (
                <div 
                  key={file.id}
                  onClick={() => handleNavigate(file)}
                  className={`flex flex-col items-center p-2 rounded cursor-pointer border border-transparent hover:bg-blue-50 dark:hover:bg-slate-700/50 hover:border-blue-100 dark:hover:border-slate-600 transition ${selectedFile === file.id ? 'bg-blue-100 dark:bg-slate-700 border-blue-200' : ''}`}
                >
                  <div className="w-12 h-12 flex items-center justify-center mb-2">
                    {file.type === 'folder' ? (
                      <Folder size={40} className="text-yellow-500 fill-yellow-500/20" />
                    ) : (
                      <FileText size={40} className="text-blue-500" />
                    )}
                  </div>
                  <span className="text-xs text-center truncate w-full px-1 select-none">
                    {file.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Preview Pane (Optional simple implementation) */}
        {selectedFile && (
          <div className="w-64 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 p-4 overflow-y-auto hidden md:block">
            <div className="flex items-center gap-2 mb-4">
               <File size={32} className="text-blue-500" />
               <h3 className="font-semibold truncate">{fileSystem.find(f => f.id === selectedFile)?.name}</h3>
            </div>
            <div className="text-xs text-gray-500 space-y-2">
               <p>Type: {fileSystem.find(f => f.id === selectedFile)?.type === 'folder' ? 'File folder' : 'Text Document'}</p>
               <p>Size: {fileSystem.find(f => f.id === selectedFile)?.size || '--'}</p>
               <p>Modified: {fileSystem.find(f => f.id === selectedFile)?.dateModified || '--'}</p>
            </div>
            {fileSystem.find(f => f.id === selectedFile)?.content && (
              <div className="mt-6 p-2 bg-gray-100 dark:bg-slate-900 rounded text-xs font-mono whitespace-pre-wrap">
                {fileSystem.find(f => f.id === selectedFile)?.content}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;