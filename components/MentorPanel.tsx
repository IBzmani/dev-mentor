
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { decode, decodeAudioData, createBlob } from '../services/audioUtils';
import { MentorStatus, TranscriptionItem } from '../types';

interface MentorPanelProps {
  codeContent: string;
  onRunTests?: () => Promise<string>;
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
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);

  const addTranscription = useCallback((text: string, isAi: boolean) => {
    setTranscriptions(prev => {
      const last = prev[prev.length - 1];
      if (last && last.isAi === isAi) {
        return [
          ...prev.slice(0, -1),
          { ...last, text: last.text + text }
        ];
      }
      return [
        ...prev,
        { id: Math.random().toString(36).substr(2, 9), text, isAi, timestamp: new Date() }
      ];
    });
  }, []);

  const animateWaveform = useCallback(() => {
    if (!analyzerRef.current) return;

    const bufferLength = analyzerRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const renderFrame = () => {
      animationFrameRef.current = requestAnimationFrame(renderFrame);
      analyzerRef.current!.getByteFrequencyData(dataArray);

      // Map frequency data to the visual bars
      barRefs.current.forEach((bar, i) => {
        if (!bar) return;
        // Use a range of frequencies that typically contain speech
        const index = Math.floor((i / barRefs.current.length) * (bufferLength / 2));
        const value = dataArray[index];
        const percent = (value / 255) * 100;
        const height = Math.max(4, (percent / 100) * 48); // Max height 48px matching h-12
        bar.style.height = `${height}px`;
      });
    };

    renderFrame();
  }, []);

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) { }
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
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsListening(false);
    setStatus(MentorStatus.IDLE);
    // Reset bar heights
    barRefs.current.forEach(bar => { if (bar) bar.style.height = '4px'; });
  }, []);

  const startSession = async () => {
    setErrorMessage(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setErrorMessage("Screen sharing is not supported in this browser.");
      return;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setErrorMessage("API Key is required.");
      return;
    }


    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let screenStream: MediaStream;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'monitor', frameRate: { max: 5 } },
          audio: false
        });
      } catch (err) {
        micStream.getTracks().forEach(t => t.stop());
        setErrorMessage("Screen access is required for Socratic mentoring.");
        return;
      }

      screenStream.getVideoTracks()[0].onended = () => stopSession();

      setIsListening(true);
      setStatus(MentorStatus.LISTENING);

      const ai = new GoogleGenAI({ apiKey });

      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      if (!outputAudioCtxRef.current) outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // Visualizer Setup
      analyzerRef.current = audioCtxRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;
      const micSource = audioCtxRef.current.createMediaStreamSource(micStream);
      micSource.connect(analyzerRef.current);
      animateWaveform();

      if (videoRef.current) {
        videoRef.current.srcObject = screenStream;
        await videoRef.current.play().catch(console.error);
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
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

            frameIntervalRef.current = window.setInterval(() => {
              if (captureCanvasRef.current && videoRef.current && videoRef.current.readyState >= 2) {
                const ctx = captureCanvasRef.current.getContext('2d');
                if (ctx && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
                  const scale = 0.5;
                  const w = videoRef.current.videoWidth * scale;
                  const h = videoRef.current.videoHeight * scale;
                  captureCanvasRef.current.width = w;
                  captureCanvasRef.current.height = h;
                  ctx.drawImage(videoRef.current, 0, 0, w, h);
                  const base64Data = captureCanvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
                  sessionPromise.then(session => {
                    session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
                  });
                }
              }
            }, 1000);
          },
          onmessage: async (message: LiveServerMessage) => {
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

            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'runTests') {
                  const result = onRunTests ? await onRunTests() : "Tests executed.";
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
              sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) { } });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: any) => {
            console.error('Mentor Session Error:', e);
            setErrorMessage("Connection error. Restart session.");
            stopSession();
          },
          onclose: () => stopSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are 'Dev-Mentor,' a senior full-stack engineer and Socratic teacher. Your goal is to guide junior developers (interns) through coding tasks using real-time multimodal input.

Core Directives:

Never Give the Answer: If you see a bug or a missing feature, do not provide the code block. Instead, ask a question that leads the user to notice it (e.g., 'I see you're using a map function here; what happens if the array is empty?').

Visual Grounding: Use the video feed to reference specific lines or UI elements. Say 'I see you're looking at the useEffect on line 45' rather than 'Look at the effect.'

The 'Verification' Loop: When the user makes a change, suggest they run the local test suite. Use function calling to trigger npm test.

Multimodal Awareness: Respond to the user's voice tone. If they sound frustrated, simplify your questions and offer encouragement.

Chain of Thought: Always use your 'Thinking' space to plan your Socratic path before speaking.`,
          tools: [{ functionDeclarations: [runTestsFunctionDeclaration] }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to start.");
      stopSession();
    }
  };

  const toggleListening = () => {
    if (isListening) stopSession();
    else startSession();
  };

  const getStatusText = () => {
    if (!isListening) return "Idle";
    if (status === MentorStatus.SPEAKING) return "Speaking...";
    return "Listening...";
  };

  return (
    <aside className="w-80 border-l border-[#282e39] flex flex-col bg-background-dark shrink-0">
      <div className="p-5 flex flex-col h-full">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className={`size-10 rounded-full flex items-center justify-center border relative transition-colors ${isListening ? 'bg-primary/20 border-primary/40' : 'bg-[#282e39] border-transparent'}`}>
              <span className={`material-symbols-outlined ${isListening ? 'text-primary' : 'text-[#9da6b9]'}`}>psychology</span>
              {isListening && <div className="absolute -top-1 -right-1 size-3 bg-green-500 rounded-full border-2 border-[#101622]"></div>}
            </div>
            <div>
              <h2 className="text-white font-bold text-sm leading-tight">AI Mentor</h2>
              <p className="text-[#9da6b9] text-xs font-medium">{getStatusText()}</p>
            </div>
          </div>
          <button
            onClick={toggleListening}
            className={`size-8 rounded-lg flex items-center justify-center text-white transition-all shadow-xl ${isListening ? 'bg-primary shadow-[0_0_15px_rgba(17,82,212,0.4)]' : 'bg-[#282e39] hover:bg-[#3b4354]'}`}>
            <span className="material-symbols-outlined text-[20px]">{isListening ? 'mic' : 'mic_off'}</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[11px] flex items-start gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Dynamic Bar Visualizer */}
        <div className="bg-[#161a23] rounded-xl p-6 mb-8 flex flex-col items-center justify-center gap-4 border border-[#282e39]">
          <div className="flex items-end gap-1 h-12">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                ref={el => barRefs.current[i] = el}
                className="w-1 bg-primary rounded-full transition-[height] duration-200"
                style={{ height: '4px' }}
              />
            ))}
          </div>
          <p className="text-[10px] text-[#9da6b9] uppercase font-bold tracking-[0.1em]">
            {status === MentorStatus.SPEAKING ? 'AI Speaking' : 'Waiting for audio'}
          </p>
          {/* Hidden capture elements */}
          <video ref={videoRef} autoPlay playsInline muted className="hidden" />
          <canvas ref={captureCanvasRef} className="hidden" />
        </div>

        {/* Live Transcription */}
        <div className="flex-1 flex flex-col gap-4 overflow-auto scrollbar-hide">
          <h3 className="text-[#9da6b9] text-[10px] font-bold uppercase tracking-wider sticky top-0 bg-background-dark py-1 z-10">Live Transcription</h3>
          {transcriptions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 opacity-30">
              <span className="material-symbols-outlined text-4xl mb-3">auto_awesome</span>
              <p className="text-xs leading-relaxed italic">"Start the mentor and talk aloud as you code. I'm here to guide you."</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 pb-4">
              {transcriptions.map((t) => (
                <div key={t.id} className={`p-3 rounded-lg transition-all ${t.isAi ? 'bg-primary/5 border-l-2 border-primary rounded-r-lg' : 'bg-[#161a23] border border-[#282e39]'}`}>
                  <p className={`text-sm leading-relaxed ${t.isAi ? 'text-white italic' : 'text-[#9da6b9]'}`}>
                    {t.isAi ? `"${t.text}"` : t.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="mt-6 flex flex-col gap-3">
          <button className="w-full py-2 bg-[#282e39] text-white rounded-lg text-xs font-bold hover:bg-[#3b4354] flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[16px]">history</span>
            View Session History
          </button>
          <div className="flex items-center justify-between px-1">
            <span className="text-[#9da6b9] text-[10px] uppercase font-bold tracking-wider">Guidance Mode</span>
            <span className="text-primary text-[10px] font-bold">EDUCATIONAL</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default MentorPanel;
