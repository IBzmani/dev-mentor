
export interface FileItem {
  name: string;
  type: 'python' | 'text';
  content: string;
}

export interface TranscriptionItem {
  id: string;
  text: string;
  isAi: boolean;
  timestamp: Date;
}

export enum MentorStatus {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
}

export interface TerminalLine {
  text: string;
  type: 'command' | 'output' | 'error';
}
