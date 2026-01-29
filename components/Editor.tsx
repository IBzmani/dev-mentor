
import React from 'react';

interface EditorProps {
  content: string;
  onChange: (val: string) => void;
  fileName: string;
}

const Editor: React.FC<EditorProps> = ({ content, onChange, fileName }) => {
  // Simple syntax highlighting simulator for Python
  const renderHighlightedCode = (text: string) => {
    return text.split('\n').map((line, idx) => {
      const parts = line.split(/(\s+|#.*|['"].*?['"]|[().,:[\]])/);
      return (
        <div key={idx} className="flex min-h-[24px]">
          <div className="w-12 text-[#3b4354] text-right select-none shrink-0 pr-4 border-r border-border-gray mr-4">
            {idx + 1}
          </div>
          <div className="whitespace-pre">
            {parts.map((part, pIdx) => {
              if (part.startsWith('#')) return <span key={pIdx} className="text-[#5c6370] italic">{part}</span>;
              if (part.startsWith("'") || part.startsWith('"')) return <span key={pIdx} className="text-[#98c379]">{part}</span>;
              if (['def', 'import', 'from', 'return', 'for', 'in', 'if', 'else', 'elif', 'while', 'as', 'try', 'except'].includes(part)) {
                return <span key={pIdx} className="text-[#c678dd]">{part}</span>;
              }
              if (['math', 'len', 'print', 'range', 'list', 'dict', 'set', 'int', 'float', 'str', 'sum', 'min', 'max'].includes(part)) {
                return <span key={pIdx} className="text-[#61afef]">{part}</span>;
              }
              if (/^\d+$/.test(part)) return <span key={pIdx} className="text-[#d19a66]">{part}</span>;
              return <span key={pIdx} className="text-[#d1d5db]">{part}</span>;
            })}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex-1 overflow-auto bg-editor-bg p-0 font-mono text-sm leading-6 relative group">
      <div className="p-4">
        {renderHighlightedCode(content)}
      </div>
      <textarea
        className="absolute inset-0 opacity-0 cursor-text resize-none p-4 pl-20"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
};

export default Editor;
