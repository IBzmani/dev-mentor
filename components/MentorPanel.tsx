
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { decode, decodeAudioData, createBlob } from '../services/audioUtils';
import { MentorStatus, TranscriptionItem } from '../types';

interface MentorPanelProps {
  codeContent: string;
}

const MentorPanel: React.FC<MentorPanelProps> = ({ codeContent }) => {
  const [status, setStatus] = useState<MentorStatus>(MentorStatus.IDLE);
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [isListening, setIsListening] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const addTranscription = useCallback((text: string, isAi: boolean) => {
    setTranscriptions(prev => [
      ...prev,
      { id: Math.random().toString(36).substr(2, 9), text, isAi, timestamp: new Date() }
    ]);
  }, []);

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      // Logic to close session would go here
      sessionRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    setIsListening(false);
    setStatus(MentorStatus.IDLE);
  }, []);

  const startSession = async () => {
    try {
      if (!process.env.API_KEY) {
        alert("API Key is missing. Please ensure it's set in the environment.");
        return;
      }

      setIsListening(true);
      setStatus(MentorStatus.LISTENING);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      if (!outputAudioCtxRef.current) outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('Gemini Live session opened');
            const source = audioCtxRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioCtxRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(audioCtxRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Audio output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioCtxRef.current) {
              setStatus(MentorStatus.SPEAKING);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioCtxRef.current.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioCtxRef.current, 24000, 1);
              const source = outputAudioCtxRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputAudioCtxRef.current.destination);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setStatus(MentorStatus.LISTENING);
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            // Transcriptions
            if (message.serverContent?.inputTranscription) {
              addTranscription(message.serverContent.inputTranscription.text, false);
            }
            if (message.serverContent?.outputTranscription) {
              addTranscription(message.serverContent.outputTranscription.text, true);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => console.error('Gemini error:', e),
          onclose: () => stopSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are an expert pair-programming mentor. 
          Help the user improve their code. 
          Current code context: \n${codeContent}\n
          Keep your advice concise and encouraging. Give specific Python optimization tips.`,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (err) {
      console.error("Failed to start AI session:", err);
      setIsListening(false);
      setStatus(MentorStatus.IDLE);
    }
  };

  const toggleListening = () => {
    if (isListening) stopSession();
    else startSession();
  };

  return (
    <aside className="w-80 border-l border-border-gray flex flex-col bg-background-dark shrink-0">
      <div className="p-5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className={`size-10 rounded-full flex items-center justify-center border relative ${isListening ? 'bg-primary/20 border-primary/40' : 'bg-[#282e39] border-transparent'}`}>
              <span className={`material-symbols-outlined ${isListening ? 'text-primary' : 'text-[#9da6b9]'}`}>psychology</span>
              {isListening && (
                <div className="absolute -top-1 -right-1 size-3 bg-green-500 rounded-full border-2 border-background-dark"></div>
              )}
            </div>
            <div>
              <h2 className="text-white font-bold text-sm leading-tight">AI Mentor</h2>
              <p className="text-[#9da6b9] text-xs font-medium">
                {status === MentorStatus.IDLE ? 'Offline' : status === MentorStatus.LISTENING ? 'Listening...' : status === MentorStatus.SPEAKING ? 'Speaking...' : 'Thinking...'}
              </p>
            </div>
          </div>
          <button 
            onClick={toggleListening}
            className={`size-10 rounded-lg flex items-center justify-center text-white transition-all ${isListening ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-primary shadow-[0_0_15px_rgba(17,82,212,0.4)] hover:scale-105'}`}>
            <span className="material-symbols-outlined text-[20px]">{isListening ? 'stop' : 'mic'}</span>
          </button>
        </div>

        {/* Waveform Visualization Mock */}
        <div className="bg-[#161a23] rounded-xl p-6 mb-6 flex flex-col items-center justify-center gap-4 border border-border-gray">
          <div className="flex items-end gap-1 h-12">
            {[4, 8, 12, 6, 10, 5, 9, 7, 4].map((h, i) => (
              <div 
                key={i} 
                className={`w-1 rounded-full bg-primary transition-all duration-300 ${status === MentorStatus.SPEAKING || status === MentorStatus.LISTENING ? 'opacity-100' : 'opacity-20'}`}
                style={{ height: status === MentorStatus.SPEAKING ? `${h * 4}px` : status === MentorStatus.LISTENING ? `${h * 2}px` : '4px' }}
              ></div>
            ))}
          </div>
          <p className="text-[10px] text-[#9da6b9] uppercase font-bold tracking-[0.1em]">
            {status === MentorStatus.SPEAKING ? 'AI Speaking' : 'Standby'}
          </p>
        </div>

        {/* Live Transcription */}
        <div className="flex-1 flex flex-col gap-4 overflow-auto pr-2">
          <h3 className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-wider">Live Transcription</h3>
          {transcriptions.length === 0 ? (
            <div className="text-[#3b4354] text-xs italic text-center mt-4">Start recording to see transcriptions...</div>
          ) : (
            transcriptions.slice(-5).map((t) => (
              <div key={t.id} className={`${t.isAi ? 'bg-primary/5 border-l-2 border-primary rounded-r-lg' : 'bg-[#161a23] border border-border-gray rounded-lg'} p-3`}>
                <p className={`${t.isAi ? 'text-white' : 'text-[#9da6b9]'} text-sm leading-relaxed ${t.isAi ? 'italic' : ''}`}>
                  "{t.text}"
                </p>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button className="w-full py-2 bg-[#282e39] text-white rounded-lg text-xs font-bold hover:bg-[#3b4354] flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[16px]">history</span>
            View Session History
          </button>
          <div className="flex items-center justify-between px-1">
            <span className="text-[#9da6b9] text-[10px]">Guidance Mode</span>
            <span className="text-primary text-[10px] font-bold">EDUCATIONAL</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default MentorPanel;
