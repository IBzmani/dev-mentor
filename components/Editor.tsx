import React from 'react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';

interface EditorProps {
  content: string;
  onChange: (val: string) => void;
  fileName: string;
}

const Editor: React.FC<EditorProps> = ({ content, onChange, fileName }) => {
  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    // You can configure the editor here after it mounts
    editor.focus();
  };

  // Determine language based on file extension
  const getLanguage = (fileName: string) => {
    if (fileName.endsWith('.py')) return 'python';
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return 'javascript';
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return 'typescript';
    if (fileName.endsWith('.html')) return 'html';
    if (fileName.endsWith('.css')) return 'css';
    if (fileName.endsWith('.json')) return 'json';
    return 'plaintext';
  };

  return (
    <div className="flex-1 overflow-hidden bg-[#1e1e1e]">
      <MonacoEditor
        height="100%"
        width="100%"
        language={getLanguage(fileName)}
        value={content}
        theme="vs-dark"
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          readOnly: false,
          automaticLayout: true,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          padding: { top: 16 }
        }}
      />
    </div>
  );
};

export default Editor;
