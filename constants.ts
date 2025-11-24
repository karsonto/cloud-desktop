import { FileText, Folder, HardDrive, Cpu, Settings, Globe } from 'lucide-react';
import { AppId, FileItem, WindowState } from './types';

export const INITIAL_FILES: FileItem[] = [
  { id: 'root', name: 'C:', type: 'folder', parentId: null },
  { id: 'docs', name: 'Documents', type: 'folder', parentId: 'root', dateModified: '2023-10-25' },
  { id: 'pics', name: 'Pictures', type: 'folder', parentId: 'root', dateModified: '2023-10-26' },
  { id: 'notes', name: 'Project_Notes.txt', type: 'file', parentId: 'docs', size: '2 KB', dateModified: '2023-10-27', content: '1. Integration with Python backend.\n2. Optimize AI agent latency.\n3. Deploy to private server.' },
  { id: 'resume', name: 'Resume.txt', type: 'file', parentId: 'docs', size: '15 KB', dateModified: '2023-09-15', content: 'Senior React Engineer with 10 years of experience...' },
  { id: 'budget', name: 'Budget_2024.txt', type: 'file', parentId: 'root', size: '1 KB', dateModified: '2023-10-28', content: 'Q1: $5000\nQ2: $7000\nQ3: $6000' },
];

export const INITIAL_WINDOWS: Record<AppId, WindowState> = {
  [AppId.FILE_EXPLORER]: {
    id: AppId.FILE_EXPLORER,
    title: 'File Explorer',
    icon: HardDrive,
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 1,
    position: { x: 100, y: 50 },
    size: { width: 800, height: 500 }
  },
  [AppId.GEMINI_CHAT]: {
    id: AppId.GEMINI_CHAT,
    title: 'Athlon Agent',
    icon: Cpu,
    isOpen: true, // Open by default for demo
    isMinimized: false,
    isMaximized: false,
    zIndex: 2,
    position: { x: 50, y: 50 },
    size: { width: 400, height: 600 }
  },
  [AppId.NOTEPAD]: {
    id: AppId.NOTEPAD,
    title: 'Notepad',
    icon: FileText,
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 1,
    position: { x: 200, y: 150 },
    size: { width: 600, height: 400 }
  },
  [AppId.SETTINGS]: {
    id: AppId.SETTINGS,
    title: 'Settings',
    icon: Settings,
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 1,
    position: { x: 300, y: 200 },
    size: { width: 500, height: 400 }
  },
  [AppId.BROWSER]: {
    id: AppId.BROWSER,
    title: 'Browser',
    icon: Globe,
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 1,
    position: { x: 150, y: 100 },
    size: { width: 900, height: 600 }
  }
};