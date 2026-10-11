import React, { useState } from 'react';
import { SAMPLE_STORIES, StorySample } from '../nlp/sampleStories';
import {
  X,
  BookOpen,
  Upload,
  Play,
  FileText,
  CheckCircle,
  Sparkles,
} from 'lucide-react';

interface StoryEditorModalProps {
  currentText: string;
  isOpen: boolean;
  onClose: () => void;
  onRunPipeline: (text: string) => void;
  isLoading: boolean;
}

export const StoryEditorModal: React.FC<StoryEditorModalProps> = ({
  currentText,
  isOpen,
  onClose,
  onRunPipeline,
  isLoading,
}) => {
  const [selectedStoryId, setSelectedStoryId] = useState<string>('pride_and_prejudice');
  const [customText, setCustomText] = useState<string>(currentText);
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');

  if (!isOpen) return null;

  const handleSelectStory = (story: StorySample) => {
    setSelectedStoryId(story.id);
    setCustomText(story.text);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCustomText(content);
        setActiveTab('custom');
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRunPipeline(customText);
    onClose();
  };

  const currentSample = SAMPLE_STORIES.find((s) => s.id === selectedStoryId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <h2 className="font-bold text-sm text-white">Select or Paste Story</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  activeTab === 'presets' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sample Stories ({SAMPLE_STORIES.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  activeTab === 'custom' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Custom Story / Upload
              </button>
            </div>

            <label className="cursor-pointer text-xs flex items-center gap-1.5 text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800 border border-slate-700">
              <Upload className="w-3 h-3 text-indigo-400" />
              <span>Upload .txt</span>
              <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {activeTab === 'presets' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SAMPLE_STORIES.map((story) => (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => handleSelectStory(story)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    selectedStoryId === story.id
                      ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{story.genre}</span>
                    {selectedStoryId === story.id && (
                      <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                  </div>
                  <h4 className="font-semibold text-xs text-white mt-0.5">{story.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{story.description}</p>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'custom' && (
            <div>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Paste any narrative text, dialogue, or story excerpt here..."
                rows={11}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-serif leading-relaxed focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Extracted via Gemini 3.8 Flash + Python Network Engine</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !customText.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow"
            >
              {isLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Extracting...</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Run Extraction</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
