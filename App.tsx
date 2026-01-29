
import React, { useState } from 'react';
import { INITIAL_FILES, LOGO_SVG } from './constants';
import { FileItem, TerminalLine } from './types';
import Editor from './components/Editor';
import MentorPanel from './components/MentorPanel';

const App: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>(INITIAL_FILES);
  const [activeFileName, setActiveFileName] = useState<string>('main.py');
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    { text: '$ python main.py', type: 'command' },
    { text: 'Processing load: 25', type: 'output' }
  ]);

  const activeFile = files.find(f => f.name === activeFileName) || files[0];

  const handleFileChange = (newContent: string) => {
    setFiles(prev => prev.map(f => f.name === activeFileName ? { ...f, content: newContent } : f));
  };

  const handleRun = () => {
    setTerminalLines(prev => [
      ...prev,
      { text: `$ python ${activeFileName}`, type: 'command' },
      { text: `Executing ${activeFileName}...`, type: 'output' },
      { text: `Processing load: 25`, type: 'output' }
    ]);
  };

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
            className="flex items-center justify-center gap-2 rounded-lg h-9 px-4 bg-primary text-white text-sm font-bold transition-all hover:bg-primary/80">
            <span className="material-symbols-outlined text-sm">play_arrow</span>
            <span>Run</span>
          </button>
          <button className="flex items-center justify-center gap-2 rounded-lg h-9 px-4 bg-[#282e39] text-white text-sm font-bold hover:bg-[#3b4354]">
            <span className="material-symbols-outlined text-sm">settings_voice</span>
            <span>Voice Settings</span>
          </button>
          <button className="flex items-center justify-center rounded-lg h-9 w-9 bg-[#282e39] text-white hover:bg-[#3b4354]">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div 
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-8 ml-2 border border-[#3b4354]" 
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
            <div className="flex items-center gap-3 text-[#9da6b9]">
              <div className="size-2 rounded-full bg-green-500"></div>
              <span className="text-xs">Python 3.10 Environment</span>
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
                {activeFileName !== file.name && (
                   <span className="material-symbols-outlined text-[14px] text-[#9da6b9] ml-2">close</span>
                )}
              </button>
            ))}
          </div>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 px-4 py-2 bg-[#161a23] text-[#9da6b9] text-xs">
            <span>src</span>
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            <span className="text-white">{activeFileName}</span>
          </div>

          <Editor 
            content={activeFile.content} 
            onChange={handleFileChange} 
            fileName={activeFile.name} 
          />

          {/* Terminal */}
          <div className="h-48 border-t border-border-gray bg-background-dark/80 flex flex-col">
            <div className="flex gap-4 border-b border-border-gray px-4 py-2 text-[#9da6b9] text-xs">
              <span className="text-white font-bold border-b border-white pb-2 -mb-2">Terminal</span>
              <span className="cursor-pointer hover:text-white">Debug Console</span>
              <span className="cursor-pointer hover:text-white">Output</span>
            </div>
            <div className="flex-1 p-4 font-mono text-xs overflow-auto">
              {terminalLines.map((line, i) => (
                <div key={i} className={line.type === 'command' ? 'text-green-500' : 'text-[#d1d5db]'}>
                  {line.text}
                </div>
              ))}
              <div className="text-[#9da6b9] animate-pulse">_</div>
            </div>
          </div>
        </section>

        {/* Right AI Sidebar */}
        <MentorPanel codeContent={activeFile.content} />
      </main>

      {/* Footer Status Bar */}
      <footer className="h-6 bg-primary flex items-center justify-between px-4 text-[10px] font-medium shrink-0 text-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">sync</span>
            <span>Cloud Connected</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">account_circle</span>
            <span>User: student_01</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span>Spaces: 4</span>
          <span>UTF-8</span>
          <div className="flex items-center gap-1 bg-white/20 px-2 h-full">
            <span className="material-symbols-outlined text-[12px]">bolt</span>
            <span>AI Guidance Active</span>
          </div>
          <span>Python 3.10.12</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
