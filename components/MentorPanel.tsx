import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { decode, decodeAudioData, createBlob } from '../services/audioUtils';
import { MentorStatus, TranscriptionItem } from '../types';

interface MentorPanelProps {
  codeContent: string;
  onRunTests?: () => Promise<string>;
}

// Fixed: Moved AIStudio interface to be potentially global and aligned with existing Window property if any
export interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    // Fixed: Added optional modifier to match potential ambient declarations and avoid "identical modifiers" error
    aistudio?: AIStudio;
  }
}

const runTestsFunctionDeclaration: FunctionDeclaration = {
  name: 'runTests',
  parameters: {
    type: Type.OBJECT,
    description: 'Triggers the local test suite (npm test) for the current project and returns results.',
    properties: {
      fileName: {
        type: Type.STRING,
        description: 'Optional specific file to test.',
      }
    }
  },
};

const MentorPanel: React.FC<MentorPanelProps> = ({ codeContent, onRunTests }) => {
  const [status, setStatus] = useState<MentorStatus>(MentorStatus.IDLE);
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  const addTranscription = useCallback((text: string, isAi: boolean) => {
    setTranscriptions(prev => [
      ...prev,
      { id: Math.random().toString(36).substr(2, 9), text, isAi, timestamp: new Date() }
    ]);
  }, []);

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsListening(false);
    setStatus(MentorStatus.IDLE);
  }, []);

  const startSession = async () => {
    setErrorMessage(null);
    try {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
        }
      }

      // Fixed: Create a new GoogleGenAI instance right before making an API call
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

      // Audio from Mic
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Video from Screen
      let screenStream: MediaStream | null = null;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: { 
            displaySurface: 'browser',
            width: { max: 1280 },
            height: { max: 720 }
          },
          audio: false 
        });
      } catch (e) {
        console.warn("Screen share cancelled or failed, proceeding with audio-only.");
      }

      setIsListening(true);
      setStatus(MentorStatus.LISTENING);

      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      if (!outputAudioCtxRef.current) outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      if (videoRef.current && screenStream) {
        videoRef.current.srcObject = screenStream;
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('Mentor session active');
            const source = audioCtxRef.current!.createMediaStreamSource(audioStream);
            const scriptProcessor = audioCtxRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              // Fixed: Initiate sendRealtimeInput after live.connect call resolves using sessionPromise.then
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioCtxRef.current!.destination);

            if (screenStream) {
              frameIntervalRef.current = window.setInterval(() => {
                if (canvasRef.current && videoRef.current) {
                  const ctx = canvasRef.current.getContext('2d');
                  if (ctx) {
                    canvasRef.current.width = 640; 
                    canvasRef.current.height = 360;
                    ctx.drawImage(videoRef.current, 0, 0, 640, 360);
                    const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];
                    // Fixed: Use sessionPromise.then to prevent stale closures and ensure data is sent after resolution
                    sessionPromise.then(session => {
                      session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
                    });
                  }
                }
              }, 1500);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioCtxRef.current) {
              setStatus(MentorStatus.SPEAKING);
              // Fixed: Track end of audio playback queue for gapless playback
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

            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'runTests') {
                  const result = onRunTests ? await onRunTests() : "Test suite executed.";
                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result } }
                  }));
                }
              }
            }

            if (message.serverContent?.inputTranscription) {
              addTranscription(message.serverContent.inputTranscription.text, false);
            }
            if (message.serverContent?.outputTranscription) {
              addTranscription(message.serverContent.outputTranscription.text, true);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => {
                try { s.stop(); } catch (e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: any) => {
            console.error('Gemini error:', e);
            // Fixed: Reset key selection if API key is invalid or not found
            if (e?.message?.includes("Requested entity was not found") && window.aistudio) {
              window.aistudio.openSelectKey();
            }
            stopSession();
          },
          onclose: () => stopSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are a senior engineer and AI Mentor. 
          CORE DIRECTIVES:
          1. NEVER GIVE DIRECT ANSWERS. Use Socratic questioning.
          2. VISUAL GROUNDING: You have access to a LIVE SCREEN FEED of the user's IDE. Reference specific lines or blocks you see.
          3. VERIFICATION LOOP: When changes are made, suggest 'runTests'.
          4. OBSERVE: Notice if the user looks stuck or moves through code quickly.
          Current code: \n${codeContent}\n`,
          tools: [{ functionDeclarations: [runTestsFunctionDeclaration] }],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (err: any) {
      console.error("AI Mentor start error:", err);
      setErrorMessage(err.message || "Failed to start. Please grant mic/screen permissions.");
      stopSession();
    }
  };

  const toggleListening = () => {
    if (isListening) stopSession();
    else startSession();
  };

  return (
    <aside className="w-80 border-l border-border-gray flex flex-col bg-background-dark shrink-0">
      <div className="p-5 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`size-10 rounded-full flex items-center justify-center border relative ${isListening ? 'bg-primary/20 border-primary/40' : 'bg-[#282e39] border-transparent'}`}>
              <span className={`material-symbols-outlined ${isListening ? 'text-primary' : 'text-[#9da6b9]'}`}>psychology</span>
              {isListening && (
                <div className="absolute -top-1 -right-1 size-3 bg-green-500 rounded-full border-2 border-background-dark"></div>
              )}
            </div>
            <div>
              <h2 className="text-white font-bold text-sm leading-tight">Senior Mentor</h2>
              <p className="text-[#9da6b9] text-xs font-medium uppercase tracking-tighter">
                {status === MentorStatus.IDLE ? 'Offline' : status}
              </p>
            </div>
          </div>
          <button 
            onClick={toggleListening}
            className={`size-12 rounded-full flex items-center justify-center text-white transition-all shadow-xl ${isListening ? 'bg-red-500 animate-pulse' : 'bg-primary hover:scale-105 shadow-primary/20'}`}>
            <span className="material-symbols-outlined text-[24px]">{isListening ? 'stop' : 'mic'}</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs flex items-start gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Screen Feed Section */}
        <div className="relative aspect-video bg-black rounded-xl border border-border-gray mb-6 overflow-hidden group">
          <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-contain transition-opacity ${isListening ? 'opacity-100' : 'opacity-20'}`} />
          {!isListening && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#3b4354] gap-2">
              <span className="material-symbols-outlined text-3xl">screen_share</span>
              <p className="text-[10px] font-bold uppercase tracking-widest">Feed Offline</p>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur rounded text-[8px] text-white/70 font-bold uppercase tracking-widest border border-white/10">
            Screen Intelligence
          </div>
        </div>

        {/* Insights */}
        <div className="flex-1 flex flex-col gap-4 overflow-auto scrollbar-hide">
          <h3 className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-wider sticky top-0 bg-background-dark py-1">Guidance Feed</h3>
          {transcriptions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 opacity-40">
              <span className="material-symbols-outlined text-4xl mb-2">lightbulb</span>
              <p className="text-xs">Your mentor is watching your screen. Share your thought process aloud.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pb-4">
              {transcriptions.slice(-10).map((t) => (
                <div key={t.id} className={`p-3 rounded-xl transition-all ${t.isAi ? 'bg-primary/10 border border-primary/20 mr-4 shadow-sm shadow-primary/5' : 'bg-[#161a23] border border-border-gray ml-4'}`}>
                  <p className={`${t.isAi ? 'text-primary-100 italic' : 'text-[#9da6b9]'} text-[13px] leading-relaxed`}>
                    {t.isAi ? <span className="font-bold text-primary mr-2 uppercase text-[9px] not-italic">Mentor</span> : <span className="font-bold text-white mr-2 uppercase text-[9px]">You</span>}
                    {t.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="mt-6 pt-4 border-t border-border-gray flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-[#9da6b9] mb-1">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-green-500"></span>
              MULTIMODAL ACTIVE
            </span>
            <span className="text-primary">SOCRATIC MODE</span>
          </div>
          <div className="h-1 w-full bg-[#282e39] rounded-full overflow-hidden">
            <div className={`h-full bg-primary transition-all duration-1000 ${isListening ? 'w-full' : 'w-0'}`}></div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default MentorPanel;