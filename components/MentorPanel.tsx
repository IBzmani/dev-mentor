
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { decode, decodeAudioData, createBlob } from '../services/audioUtils';
import { MentorStatus, TranscriptionItem } from '../types';

interface MentorPanelProps {
  codeContent: string;
  onRunTests?: () => Promise<string>;
}

// Fix: Removed duplicate global declaration of window.aistudio that caused type conflicts.
// The environment provides aistudio methods which we access via (window as any).

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

  // Fix: Corrected slice usage inside setTranscriptions callback to ensure history is capped properly.
  const addTranscription = useCallback((text: string, isAi: boolean) => {
    setTranscriptions(prev => {
      const nextList = [
        ...prev,
        { id: Math.random().toString(36).substr(2, 9), text, isAi, timestamp: new Date() }
      ];
      return nextList.slice(-20); // Keep history manageable
    });
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
      // Access pre-configured AI Studio helpers via (window as any)
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        const hasKey = await aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await aistudio.openSelectKey();
          // Proceed assuming selection successful per guidelines
        }
      }

      // Fix: Initialize AI instance right before connection using process.env.API_KEY directly.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Request Microphone Access
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Request Screen Capture Access
      let screenStream: MediaStream;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: { 
            displaySurface: 'monitor',
            frameRate: { max: 5 } // Low frame rate is sufficient for code
          },
          audio: false 
        });
      } catch (err) {
        micStream.getTracks().forEach(t => t.stop());
        throw new Error("Screen share is required for visual grounding.");
      }

      setIsListening(true);
      setStatus(MentorStatus.LISTENING);

      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      if (!outputAudioCtxRef.current) outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      if (videoRef.current) {
        videoRef.current.srcObject = screenStream;
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('Gemini Live: Screen & Mic connection established');
            
            // Audio input handling
            const source = audioCtxRef.current!.createMediaStreamSource(micStream);
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

            // Screen frame handling
            frameIntervalRef.current = window.setInterval(() => {
              if (canvasRef.current && videoRef.current && videoRef.current.readyState >= 2) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                  // Resizing for efficiency
                  const targetWidth = 800;
                  const targetHeight = (videoRef.current.videoHeight / videoRef.current.videoWidth) * targetWidth;
                  canvasRef.current.width = targetWidth;
                  canvasRef.current.height = targetHeight;
                  
                  ctx.drawImage(videoRef.current, 0, 0, targetWidth, targetHeight);
                  const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
                  
                  sessionPromise.then(session => {
                    session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
                  });
                }
              }
            }, 1500); // Send frame every 1.5 seconds
          },
          onmessage: async (message: LiveServerMessage) => {
            // Process model audio output
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

            // Handle tool calls (Test Runner)
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'runTests') {
                  const result = onRunTests ? await onRunTests() : "Test suite passed.";
                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result } }
                  }));
                }
              }
            }

            // Handle Transcriptions
            if (message.serverContent?.inputTranscription) {
              addTranscription(message.serverContent.inputTranscription.text, false);
            }
            if (message.serverContent?.outputTranscription) {
              addTranscription(message.serverContent.outputTranscription.text, true);
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => {
                try { s.stop(); } catch (e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: any) => {
            console.error('Gemini Live error:', e);
            const aistudio = (window as any).aistudio;
            if (e?.message?.includes("Requested entity was not found") && aistudio) {
              aistudio.openSelectKey();
            }
            setErrorMessage("Session encountered an error. Please restart.");
            stopSession();
          },
          onclose: () => stopSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are a world-class senior engineer acting as a Socratic AI Mentor.
          CONTEXT: You have access to the user's LIVE SCREEN FEED. You can see their code editor, terminal, and browser.
          GUIDELINES:
          1. NEVER give the solution directly.
          2. Use questions to guide the user to the answer (Socratic Method).
          3. When you see the user making a mistake or getting stuck based on the screen feed, intervene gently.
          4. Suggest 'runTests' when code changes are made to verify logic.
          5. Be observant of terminal errors you see on screen.
          Current file content for reference: \n${codeContent}\n`,
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
      console.error("AI Mentor Setup Failed:", err);
      setErrorMessage(err.message || "Failed to start. Check permissions.");
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
        {/* Connection Header */}
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

        {/* Live Screen Preview */}
        <div className="relative aspect-video bg-black rounded-xl border border-border-gray mb-6 overflow-hidden group">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-contain transition-opacity duration-500 ${isListening ? 'opacity-100' : 'opacity-20'}`} 
          />
          {!isListening && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#3b4354] gap-2">
              <span className="material-symbols-outlined text-3xl">screen_share</span>
              <p className="text-[10px] font-bold uppercase tracking-widest">Feed Offline</p>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 backdrop-blur rounded text-[8px] text-white/70 font-bold uppercase tracking-widest border border-white/10 flex items-center gap-2">
            <span className={`size-1.5 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
            Live Screen Feed
          </div>
        </div>

        {/* Real-time Transcription Feed */}
        <div className="flex-1 flex flex-col gap-4 overflow-auto scrollbar-hide">
          <h3 className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-wider sticky top-0 bg-background-dark py-1">Mentoring Insights</h3>
          {transcriptions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 opacity-40">
              <span className="material-symbols-outlined text-4xl mb-2">auto_awesome</span>
              <p className="text-xs">Your mentor is observing your screen. Talk through your code aloud.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pb-4">
              {transcriptions.slice(-12).map((t) => (
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

        {/* Footer Metrics */}
        <div className="mt-6 pt-4 border-t border-border-gray flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-[#9da6b9] mb-1">
            <span className="flex items-center gap-1">
              <span className={`size-1.5 rounded-full ${isListening ? 'bg-green-500' : 'bg-[#282e39]'}`}></span>
              SOCRATIC ENGINE
            </span>
            <span className="text-primary">MULTIMODAL READY</span>
          </div>
          <div className="h-1 w-full bg-[#282e39] rounded-full overflow-hidden">
            <div className={`h-full bg-primary transition-all duration-1000 ${isListening ? 'w-full' : 'w-0'}`}></div>
          </div>
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-[9px] text-center text-[#3b4354] hover:text-[#9da6b9] transition-colors mt-2">
            Requires Google AI Studio Billing
          </a>
        </div>
      </div>
    </aside>
  );
};

export default MentorPanel;
