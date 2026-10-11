import React from 'react';
import {
  Network,
  ListFilter,
  FileCode,
  BookOpen,
  Sparkles,
  RefreshCw,
  Share2,
} from 'lucide-react';

interface HeaderProps {
  activeView: 'graph' | 'table' | 'python';
  setActiveView: (view: 'graph' | 'table' | 'python') => void;
  storyTitle: string;
  charactersCount: number;
  relationshipsCount: number;
  onOpenStoryEditor: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  setActiveView,
  storyTitle,
  charactersCount,
  relationshipsCount,
  onOpenStoryEditor,
  onRefresh,
  isLoading,
}) => {
  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950 px-4 flex items-center justify-between z-20 flex-shrink-0">
      {/* Brand & Story Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">CRES</span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-300 font-medium truncate max-w-xs">
                {storyTitle}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {charactersCount} Characters • {relationshipsCount} Relationships
            </div>
          </div>
        </div>
      </div>

      {/* Simplified Navigation Tabs */}
      <nav className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800">
        <button
          onClick={() => setActiveView('graph')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
            activeView === 'graph'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>Knowledge Graph</span>
        </button>

        <button
          onClick={() => setActiveView('table')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
            activeView === 'table'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>Characters & Relations</span>
        </button>

        <button
          onClick={() => setActiveView('python')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
            activeView === 'python'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Python & NetworkX</span>
        </button>
      </nav>

      {/* Right Story Selector & Run */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenStoryEditor}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
          <span>Select / Input Story</span>
        </button>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Re-extract with LLM"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </div>
    </header>
  );
};
