import React from 'react';
import { LucideIcon } from 'lucide-react';

export enum AppId {
  FILE_EXPLORER = 'file-explorer',
  GEMINI_CHAT = 'gemini-chat',
  SETTINGS = 'settings',
  NOTEPAD = 'notepad',
  BROWSER = 'browser'
}

export interface WindowState {
  id: AppId;
  title: string;
  icon: LucideIcon;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string; // For mock text files
  parentId: string | null;
  size?: string;
  dateModified?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

export interface OSContextType {
  windows: Record<AppId, WindowState>;
  activeWindowId: AppId | null;
  openApp: (id: AppId) => void;
  closeApp: (id: AppId) => void;
  minimizeApp: (id: AppId) => void;
  maximizeApp: (id: AppId) => void;
  focusApp: (id: AppId) => void;
  updateWindowPosition: (id: AppId, x: number, y: number) => void;
  fileSystem: FileItem[];
  setFileSystem: React.Dispatch<React.SetStateAction<FileItem[]>>;
}