import React, { useState } from 'react';
import { CRESResult } from '../types/cres';
import {
  generateNetworkXPython,
  generateGEXF,
  generateGraphJSON,
  generateCSV,
} from '../nlp/exportFormats';
import { Download, Copy, Check, Code, FileSpreadsheet, Network, FileCode } from 'lucide-react';

interface ExportStudioProps {
  result: CRESResult;
}

export const ExportStudio: React.FC<ExportStudioProps> = ({ result }) => {
  const [activeFormat, setActiveFormat] = useState<'networkx' | 'gexf' | 'json' | 'csv'>('networkx');
  const [copied, setCopied] = useState<boolean>(false);

  const pythonCode = generateNetworkXPython(result);
  const gexfXML = generateGEXF(result);
  const jsonGraph = generateGraphJSON(result);
  const { nodesCSV, edgesCSV } = generateCSV(result);

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Format Switcher */}
      <div className="flex border-b border-slate-800 bg-slate-900/80 p-3 items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveFormat('networkx')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFormat === 'networkx'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-800/40'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>NetworkX (.py)</span>
          </button>

          <button
            onClick={() => setActiveFormat('gexf')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFormat === 'gexf'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-800/40'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Gephi (.gexf)</span>
          </button>

          <button
            onClick={() => setActiveFormat('json')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFormat === 'json'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-800/40'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Graph JSON (.json)</span>
          </button>

          <button
            onClick={() => setActiveFormat('csv')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFormat === 'csv'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-800/40'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV (Nodes & Edges)</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activeFormat !== 'csv' && (
            <button
              onClick={() => {
                if (activeFormat === 'networkx') copyToClipboard(pythonCode);
                if (activeFormat === 'gexf') copyToClipboard(gexfXML);
                if (activeFormat === 'json') copyToClipboard(jsonGraph);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          )}

          {activeFormat === 'networkx' && (
            <button
              onClick={() => downloadFile(pythonCode, 'cres_networkx.py', 'text/x-python')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .py</span>
            </button>
          )}

          {activeFormat === 'gexf' && (
            <button
              onClick={() => downloadFile(gexfXML, 'cres_character_graph.gexf', 'application/xml')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .gexf</span>
            </button>
          )}

          {activeFormat === 'json' && (
            <button
              onClick={() => downloadFile(jsonGraph, 'cres_character_graph.json', 'application/json')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .json</span>
            </button>
          )}

          {activeFormat === 'csv' && (
            <div className="flex gap-2">
              <button
                onClick={() => downloadFile(nodesCSV, 'nodes.csv', 'text/csv')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Nodes CSV</span>
              </button>
              <button
                onClick={() => downloadFile(edgesCSV, 'edges.csv', 'text/csv')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Edges CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Code Display Area */}
      <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs text-slate-300">
        {activeFormat === 'networkx' && (
          <pre className="text-emerald-400 selection:bg-indigo-900 leading-relaxed whitespace-pre-wrap">
            {pythonCode}
          </pre>
        )}

        {activeFormat === 'gexf' && (
          <pre className="text-cyan-300 selection:bg-indigo-900 leading-relaxed whitespace-pre-wrap">
            {gexfXML}
          </pre>
        )}

        {activeFormat === 'json' && (
          <pre className="text-amber-300 selection:bg-indigo-900 leading-relaxed whitespace-pre-wrap">
            {jsonGraph}
          </pre>
        )}

        {activeFormat === 'csv' && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 font-sans block mb-1">
                nodes.csv ({result.characters.length} character entities)
              </span>
              <pre className="text-indigo-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800 whitespace-pre-wrap">
                {nodesCSV}
              </pre>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 font-sans block mb-1">
                edges.csv ({result.relationships.length} relationship edges)
              </span>
              <pre className="text-pink-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800 whitespace-pre-wrap">
                {edgesCSV}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
