import React, { useState } from 'react';
import { SAMPLE_STORIES, StorySample } from '../nlp/sampleStories';
import {
  X,
  BookOpen,
  Upload,
  Play,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface StoryEditorModalProps {
  currentText: string;
  isOpen: boolean;
  onClose: () => void;
  onRunPipeline: (text: string) => Promise<void> | void;
  isLoading: boolean;
}


/**
 * Extracts plain text from all pages of a PDF file using PDF.js.
 */
async function extractTextFromPdf(file: File): Promise<string> {
  if (!(window as any).pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        try {
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(true);
        } catch {
          resolve(true);
        }
      };
      script.onerror = () =>
        reject(new Error('Failed to load PDF reader library. Please check your internet connection.'));
      document.head.appendChild(script);
    });
  }

  const pdfjsLib = (window as any).pdfjsLib;
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageString = textContent.items
      .map((item: any) => item.str || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageString) {
      pageTexts.push(pageString);
    }
  }

  return pageTexts.join('\n\n');
}

function cleanStoryText(raw: string): string {
  if (!raw) return '';
  let t = raw;

  // 1. Clean Mojibake sequences (e.g. â€¢, â€”, â€™)
  t = t
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€\x9d/g, '"')
    .replace(/â€”/g, '—')
    .replace(/â€“/g, '–')
    .replace(/â€¦/g, '...')
    .replace(/â€˜/g, "'")
    .replace(/â€¢/g, ' ')
    .replace(/â[^\x20-\x7E\s]+/g, ' ');

  // 2. Normalize smart typographical punctuation & bullets & PDF replacement boxes
  t = t
    .replace(/[\u2018\u2019\u201A\u201B\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, '—')
    .replace(/[\u2022\u25CF\u25CB\u25AA\u25AB\u25A0\u25A1\uFFFD\u00A0\uFEFF]/g, ' ');

  // 3. Strip textbook headers, footers and exercise markers (NCERT etc.)
  t = t.replace(/\b\d+\s+Footprints\s+without\s+Feet\b/gi, ' ');
  t = t.replace(/\bFootprints\s+without\s+Feet\s+\d*\b/gi, ' ');
  t = t.replace(/\bReprint\s+\d{4}-\d{2}\b/gi, ' ');
  t = t.replace(/\bThe\s+Thief['’]s\s+Story\s+\d+\b/gi, ' ');
  t = t.replace(/\bR\s*E\s*A\s*D\s+A\s*N\s*D\s+F\s*I\s*N\s*D\s+O\s*U\s*T\b/gi, ' ');
  t = t.replace(/\bREAD\s+AND\s+FIND\s+OUT\b/gi, ' ');
  t = t.replace(/\bThink\s+about\s+it\b/gi, ' ');
  t = t.replace(/\bTalk\s+about\s+it\b/gi, ' ');
  t = t.replace(/\bSuggested\s+reading\b/gi, ' ');

  return t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export const StoryEditorModal: React.FC<StoryEditorModalProps> = ({
  currentText,
  isOpen,
  onClose,
  onRunPipeline,
  isLoading,
}) => {
  const [selectedStoryId, setSelectedStoryId] = useState<string>('pride_and_prejudice');
  const [customText, setCustomText] = useState<string>(cleanStoryText(currentText));
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectStory = (story: StorySample) => {
    setSelectedStoryId(story.id);
    setCustomText(cleanStoryText(story.text));
    setFileError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    setIsParsingFile(true);

    try {
      const fileNameLower = file.name.toLowerCase();
      if (fileNameLower.endsWith('.pdf') || file.type === 'application/pdf') {
        const text = await extractTextFromPdf(file);
        if (!text || text.trim().length === 0) {
          throw new Error('No readable text layer found in this PDF. It may be a scanned image or protected.');
        }
        setCustomText(cleanStoryText(text));
        setActiveTab('custom');
      } else {
        // Text file
        const text = await file.text();
        setCustomText(cleanStoryText(text));
        setActiveTab('custom');
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setFileError(err.message || 'Failed to read file. Please try another file or paste the text.');
    } finally {
      setIsParsingFile(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isParsingFile || !customText.trim()) return;
    try {
      await onRunPipeline(customText);
      onClose();
    } catch (err) {
      console.error('Extraction error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <h2 className="font-bold text-sm text-white">Select or Paste Story</h2>
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-950/80 border border-indigo-800/80 px-3 py-1 rounded-full animate-pulse font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Extracting characters & relations...</span>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tabs & Upload */}
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

            <label
              className={`cursor-pointer text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                isParsingFile
                  ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed'
                  : 'bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border-slate-700'
              }`}
            >
              {isParsingFile ? (
                <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span>{isParsingFile ? 'Extracting text...' : 'Upload .txt or .pdf'}</span>
              <input
                type="file"
                accept=".txt,.pdf,text/plain,application/pdf"
                onChange={handleFileUpload}
                disabled={isParsingFile}
                className="hidden"
              />
            </label>
          </div>

          {fileError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{fileError}</span>
            </div>
          )}

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
            <div className="space-y-2">
              <textarea
                value={customText}
                onChange={(e) => setCustomText(cleanStoryText(e.target.value))}
                placeholder="Paste story text here, or upload a .txt / .pdf file using the button above..."
                rows={11}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-serif leading-relaxed focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Local Model Engine Active</span>
            {customText.trim() && (
              <>
                <span className="text-slate-600">•</span>
                <span>{customText.trim().split(/\s+/).length} words</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !customText.trim() || isParsingFile}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center gap-1.5 shadow transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
