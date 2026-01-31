
import React, { useState, useCallback } from 'react';
import { INITIAL_FILES, LOGO_SVG } from './constants';
import { FileItem, TerminalLine } from './types';
import Editor from './components/Editor';
import MentorPanel from './components/MentorPanel';
import { loadPyodide } from './utils/pyodide';

const App: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>(INITIAL_FILES);
  const [activeFileName, setActiveFileName] = useState<string>('two_sum.py');
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    { text: '$ python main.py', type: 'command' },
    { text: 'Processing load: 25', type: 'output' }
  ]);

  const activeFile = files.find(f => f.name === activeFileName) || files[0];

  const handleFileChange = (newContent: string) => {
    setFiles(prev => prev.map(f => f.name === activeFileName ? { ...f, content: newContent } : f));
  };

  const [isPyodideLoading, setIsPyodideLoading] = useState(false);

  const handleRun = async () => {
    setTerminalLines(prev => [
      ...prev,
      { text: `$ python ${activeFileName}`, type: 'command' },
      { text: `Executing ${activeFileName}...`, type: 'output' }
    ]);

    setIsPyodideLoading(true);
    try {
      // Lazy load pyodide on first run
      const { runPythonArgs } = await import('./utils/pyodide');

      const { output, error } = await runPythonArgs(activeFile.content);

      setTerminalLines(prev => {
        const lines = [...prev];
        if (output) lines.push({ text: output, type: 'output' });
        if (error) lines.push({ text: error, type: 'error' });
        return lines;
      });
    } catch (e: any) {
      setTerminalLines(prev => [...prev, { text: `System Error: ${e.message}`, type: 'error' }]);
    }
    setIsPyodideLoading(false);
  };

  const handleRunTests = useCallback(async () => {
    setTerminalLines(prev => [...prev, { text: '$ python tests.py', type: 'command' }]);
    setIsPyodideLoading(true);

    try {
      const { runPythonArgs } = await import('./utils/pyodide');

      // Combine user code and test code
      const userCode = files.find(f => f.name === 'two_sum.py')?.content || '';
      const testCode = files.find(f => f.name === 'tests.py')?.content || '';

      // We need to write the user code to a virtual file so the test can import it
      const pyodide = await loadPyodide();
      pyodide.FS.writeFile('two_sum.py', userCode);

      const { output, error } = await runPythonArgs(testCode);

      setTerminalLines(prev => {
        const lines = [...prev];
        if (output) lines.push({ text: output, type: 'output' });
        if (error) lines.push({ text: error, type: 'error' });
        return lines;
      });

      return output || error || "";
    } catch (e: any) {
      const err = `System Error: ${e.message}`;
      setTerminalLines(prev => [...prev, { text: err, type: 'error' }]);
      return err;
    } finally {
      setIsPyodideLoading(false);
    }
  }, [files]);

  return (
    <div className="flex flex-col h-screen bg-background-dark text-white overflow-hidden">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-border-gray px-6 py-2 shrink-0 bg-background-dark">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {LOGO_SVG}
            <h1 className="text-white text-lg font-bold tracking-tight">Dev-Mentor</h1>
          </div>
          <div className="h-6 w-px bg-border-gray mx-2"></div>
          <nav className="flex items-center gap-4 text-sm text-[#9da6b9]">
            {['File', 'Edit', 'Selection', 'View'].map(item => (
              <button key={item} className="hover:text-white transition-colors">{item}</button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={isPyodideLoading}
            className={`flex items-center justify-center gap-2 rounded-lg h-9 px-4 text-white text-sm font-bold transition-all shadow-lg ${isPyodideLoading ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/80 shadow-primary/20'}`}>
            {isPyodideLoading ? <span className="material-symbols-outlined text-sm animate-spin">sync</span> : <span className="material-symbols-outlined text-sm">play_arrow</span>}
            <span>{isPyodideLoading ? 'Loading...' : 'Run'}</span>
          </button>
          <button
            onClick={handleRunTests}
            disabled={isPyodideLoading}
            className={`flex items-center justify-center gap-2 rounded-lg h-9 px-4 text-black text-sm font-bold transition-all shadow-lg ${isPyodideLoading ? 'bg-[#e5c07b]/50 cursor-not-allowed' : 'bg-[#e5c07b] hover:bg-[#d1b06f] shadow-[#e5c07b]/20'}`}>
            <span className="material-symbols-outlined text-sm">science</span>
            <span>Test</span>
          </button>
          <button className="flex items-center justify-center gap-2 rounded-lg h-9 px-4 bg-[#282e39] text-white text-sm font-bold hover:bg-[#3b4354]">
            <span className="material-symbols-outlined text-sm">settings_voice</span>
            <span>Voice Settings</span>
          </button>
          <button className="flex items-center justify-center rounded-lg h-9 w-9 bg-[#282e39] text-white hover:bg-[#3b4354]">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-8 ml-2 border-2 border-primary/50"
            style={{ backgroundImage: 'url("https://picsum.photos/id/64/100/100")' }}>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-border-gray flex flex-col bg-background-dark shrink-0">
          <div className="p-4 flex flex-col gap-6">
            <div>
              <h3 className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-wider mb-4">Project Explorer</h3>
              <div className="flex flex-col gap-1">
                {files.map(file => (
                  <button
                    key={file.name}
                    onClick={() => setActiveFileName(file.name)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeFileName === file.name ? 'bg-primary/20 border border-primary/30' : 'hover:bg-[#282e39] border border-transparent'}`}>
                    <span className={`material-symbols-outlined text-[20px] ${activeFileName === file.name ? 'text-primary' : 'text-[#9da6b9]'}`}>
                      {file.name.endsWith('.txt') ? 'settings_ethernet' : 'description'}
                    </span>
                    <p className={`text-sm font-medium ${activeFileName === file.name ? 'text-white' : 'text-[#9da6b9]'}`}>{file.name}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-wider mb-4">Quick Actions</h3>
              <div className="flex flex-col gap-1 text-[#9da6b9]">
                {[
                  { icon: 'search', label: 'Global Search' },
                  { icon: 'account_tree', label: 'Git Source' },
                  { icon: 'bug_report', label: 'Debug Session' }
                ].map(action => (
                  <button key={action.label} className="flex items-center gap-3 px-3 py-2 hover:bg-[#282e39] hover:text-white rounded-lg transition-all">
                    <span className="material-symbols-outlined text-[20px]">{action.icon}</span>
                    <p className="text-sm font-medium">{action.label}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-auto p-4 border-t border-border-gray">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[#9da6b9]">
                <div className="size-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs">Python 3.10 Env</span>
              </div>
              <span className="material-symbols-outlined text-sm text-[#3b4354]">refresh</span>
            </div>
          </div>
        </aside>

        {/* Editor Center Area */}
        <section className="flex-1 flex flex-col overflow-hidden bg-editor-bg">
          {/* Editor Tabs */}
          <div className="flex border-b border-border-gray bg-background-dark/50">
            {files.map(file => (
              <button
                key={file.name}
                onClick={() => setActiveFileName(file.name)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${activeFileName === file.name ? 'border-primary bg-editor-bg' : 'border-transparent hover:bg-[#282e39]'}`}>
                <span className={`material-symbols-outlined text-[16px] ${activeFileName === file.name ? 'text-primary' : 'text-[#9da6b9]'}`}>description</span>
                <span className={`text-sm font-medium ${activeFileName === file.name ? 'text-white' : 'text-[#9da6b9]'}`}>{file.name}</span>
              </button>
            ))}
          </div>

          <Editor
            content={activeFile.content}
            onChange={handleFileChange}
            fileName={activeFile.name}
          />

          {/* Terminal */}
          <div className="h-48 border-t border-border-gray bg-background-dark flex flex-col">
            <div className="flex gap-4 border-b border-border-gray px-4 py-2 text-[#9da6b9] text-[10px] uppercase font-bold tracking-widest">
              <span className="text-white border-b border-white pb-2 -mb-2">Output & Tests</span>
              <span className="cursor-pointer hover:text-white transition-colors">Debug Console</span>
            </div>
            <div className="flex-1 p-4 font-mono text-[11px] overflow-auto scrollbar-hide bg-black/20">
              {terminalLines.map((line, i) => (
                <div key={i} className={`mb-1 ${line.type === 'command' ? 'text-primary font-bold' : line.type === 'error' ? 'text-red-400' : 'text-[#d1d5db]'}`}>
                  {line.type === 'command' && <span className="mr-2 opacity-50">❯</span>}
                  {line.text}
                </div>
              ))}
              <div className="text-primary animate-pulse inline-block h-3 w-1.5 align-middle ml-1 bg-primary"></div>
            </div>
          </div>
        </section>

        {/* Right AI Sidebar */}
        <MentorPanel codeContent={activeFile.content} onRunTests={handleRunTests} />
      </main>

      {/* Footer Status Bar */}
      <footer className="h-6 bg-primary flex items-center justify-between px-4 text-[10px] font-medium shrink-0 text-white uppercase tracking-tighter">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">sync</span>
            <span>Cloud Connected</span>
          </div>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-white/20 px-2 h-full">
            <span className="material-symbols-outlined text-[12px]">psychology</span>
            <span>Senior Socratic Guidance: Online</span>
          </div>
          <span>Python 3.10.12</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
