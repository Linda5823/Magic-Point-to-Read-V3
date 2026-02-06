
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeImage, generateSpeech, decodeAudioData, translateWithPivot } from './services/geminiService';
import { TextBlock, AppStatus, LanguageCode, SUPPORTED_LANGUAGES } from './types';
import PointReader from './components/PointReader';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [activeBlock, setActiveBlock] = useState<TextBlock | null>(null);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState<LanguageCode>('none'); 
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCache = useRef<Map<string, AudioBuffer>>(new Map());

  // Auto-translate when target language changes for the currently active block
  useEffect(() => {
    if (activeBlock && targetLang !== 'none') {
      const reTranslate = async () => {
        try {
          setError(null); // 清除之前的错误
          setStatus(AppStatus.TRANSLATING);
          const result = await translateWithPivot(activeBlock.text, targetLang);
          setTranslatedText(result);
          setStatus(AppStatus.READY);
        } catch (err: any) {
          setError(err.message);
          setStatus(AppStatus.READY);
        }
      };
      reTranslate();
    } else if (targetLang === 'none') {
      setTranslatedText(null);
      setError(null); // 清除错误
    }
  }, [targetLang, activeBlock?.text]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setStatus(AppStatus.UPLOADING);
    setBlocks([]);
    setActiveBlock(null);
    setTranslatedText(null);
    audioCache.current.clear();
    
    const reader = new FileReader();
    reader.onload = async () => {
      setImageUrl(reader.result as string);
      try {
        setStatus(AppStatus.ANALYZING);
        const results = await analyzeImage((reader.result as string).split(',')[1]);
        setBlocks(results);
        setStatus(AppStatus.READY);
      } catch (err: any) {
        setError(err.message);
        setStatus(AppStatus.ERROR);
      }
    };
    reader.readAsDataURL(file);
  };

  const playSpeech = async (text: string) => {
    if (!text || !text.trim()) return;
    
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (audioCache.current.has(text)) {
      playAudio(audioCache.current.get(text)!);
      return;
    }

    try {
      setStatus(AppStatus.SPEAKING);
      const pcmData = await generateSpeech(text);
      const audioBuffer = await decodeAudioData(new Uint8Array(pcmData), audioContextRef.current);
      audioCache.current.set(text, audioBuffer);
      playAudio(audioBuffer);
    } catch (err: any) {
      // TTS 错误不应该阻止其他功能，只显示警告
      const errorMsg = err.message || "Audio playback error";
      // 如果是 TTS 相关的错误，不设置为主要错误，只在控制台记录
      if (errorMsg.includes('TTS') || errorMsg.includes('audio')) {
        console.warn("TTS Error:", errorMsg);
        setStatus(AppStatus.READY);
      } else {
        setError("Audio playback error: " + errorMsg);
        setStatus(AppStatus.READY);
      }
    }
  };

  const playAudio = (buffer: AudioBuffer) => {
    if (!audioContextRef.current) return;
    
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch (e) {}
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    currentSourceRef.current = source;
    
    source.onended = () => {
      if (currentSourceRef.current === source) {
        setStatus(AppStatus.READY);
      }
    };
    
    setStatus(AppStatus.SPEAKING);
    source.start();
  };

  const handleTextClick = useCallback(async (text: string, block: TextBlock) => {
    if (!text.trim() || status === AppStatus.ANALYZING) return;
    
    setActiveBlock(block);
    setError(null);
    setTranslatedText(null);

    // Speak original immediately
    await playSpeech(text);

    // Trigger translation
    if (targetLang !== 'none') {
      try {
        setStatus(AppStatus.TRANSLATING);
        const result = await translateWithPivot(text, targetLang);
        setTranslatedText(result);
        setStatus(AppStatus.READY);
      } catch (err: any) {
        setError(err.message);
        setStatus(AppStatus.READY);
      }
    }
  }, [status, targetLang]);

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col items-center py-6 md:py-10 px-4 ${activeBlock ? 'pb-[28rem] md:pb-[24rem]' : 'pb-8'}`}>
      <header className="max-w-4xl w-full text-center mb-8">
        <h1 className="text-3xl md:text-5xl font-extrabold text-slate-800 mb-3 tracking-tight flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 flex-nowrap">
            <span className="bg-clip-text text-transparent bg-gradient-to-br from-blue-600 to-indigo-600 whitespace-nowrap">Magic Point-to-Read</span>
            <span className="text-3xl animate-bounce flex-shrink-0">🪄</span>
          </div>
          <span className="text-xl md:text-2xl font-black text-slate-400/50 uppercase tracking-[0.3em] mt-1">魔法点读笔</span>
        </h1>
        <div className="text-slate-500 font-medium px-4 text-sm md:text-base flex flex-col items-center gap-1">
          <p>Upload any reading material and click on text to hear it spoken or translated.</p>
          <p className="text-xs md:text-sm">上传图片，点击文字，Gemini 为你朗读和翻译</p>
        </div>
      </header>

      <main className="max-w-4xl w-full flex flex-col items-center">
        <div className={`w-full bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl shadow-slate-200 border-8 border-white p-2 md:p-4 mb-8 transition-all relative overflow-hidden ${!imageUrl ? 'border-dashed !border-slate-200' : ''}`}>
          {!imageUrl ? (
            <div className="flex flex-col items-center justify-center py-24 md:py-40">
              <label className="cursor-pointer w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-10 relative group hover:bg-blue-100 transition-colors active:scale-95">
                <div className="absolute inset-0 bg-blue-400/20 rounded-full animate-ping opacity-20"></div>
                <svg className="w-12 h-12 text-blue-600 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  capture="environment"
                  onChange={handleFileUpload}
                />
              </label>
              <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-black py-5 px-12 rounded-3xl transition-all shadow-2xl shadow-blue-200 active:scale-95 text-lg md:text-xl tracking-wide flex flex-col items-center group text-center ring-4 ring-transparent hover:ring-blue-100">
                <span>Snap Photo / Upload</span>
                <span className="text-sm text-blue-200 font-normal mt-1">拍摄或从相册选择图片</span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileUpload}
                />
              </label>
              <div className="mt-12 opacity-30">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-800">Powered by Gemini AI Vision & TTS</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="flex justify-between w-full px-6 mb-4 items-center">
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                  status === AppStatus.ANALYZING ? 'bg-indigo-600 text-white animate-pulse' : 
                  'bg-slate-100 text-slate-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status === AppStatus.ANALYZING ? 'bg-white' : 'bg-slate-400'}`}></span>
                  {status}
                </div>
                <button onClick={() => { setImageUrl(null); setBlocks([]); setStatus(AppStatus.IDLE); setTranslatedText(null); setActiveBlock(null); setTargetLang('none'); }} className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {error && (
                <div className="mx-6 mb-6 bg-red-50 text-red-600 p-5 rounded-2xl text-sm border border-red-100 shadow-sm flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  <div><span className="font-bold">Error:</span> {error}</div>
                </div>
              )}

              <PointReader imageUrl={imageUrl} blocks={blocks} onTextClick={handleTextClick} activeBlock={activeBlock} isAnalyzing={status === AppStatus.ANALYZING} />
            </div>
          )}
        </div>
      </main>

      {/* GOOGLE TRANSLATE STYLE DASHBOARD */}
      {activeBlock && (
        <div className="fixed bottom-4 left-4 right-4 max-w-5xl mx-auto z-50 animate-in slide-in-from-bottom-12 duration-500 ease-out">
          <div className="bg-white rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] border border-slate-100 overflow-hidden ring-1 ring-slate-900/5">
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
              
              {/* Source Column */}
              <div className="flex-1 p-8 md:p-12 flex flex-col relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Original Text / 原文</span>
                  </div>
                  <button 
                    onClick={async () => {
                      // 清除之前的错误，然后播放
                      setError(null);
                      await playSpeech(activeBlock.text);
                    }}
                    className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all active:scale-90 shadow-sm"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                  </button>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-slate-800 leading-tight">
                  {activeBlock.text}
                </p>
              </div>

              {/* Connector Arrow */}
              <div className="hidden md:flex items-center justify-center px-4 bg-slate-50/50">
                <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-200 shadow-sm">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </div>
              </div>

              {/* Target Column */}
              <div className="flex-1 p-8 md:p-12 flex flex-col bg-blue-50/10">
                <div className="flex items-center justify-between mb-6">
                  <div className="relative">
                    <select 
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value as LanguageCode)}
                      className="appearance-none bg-blue-600 text-white text-xs font-black uppercase tracking-widest py-2.5 pl-6 pr-12 rounded-full cursor-pointer hover:bg-blue-700 transition-all outline-none shadow-lg shadow-blue-200"
                    >
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/80">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </div>
                  </div>

                  {translatedText && (
                    <button 
                      onClick={async () => {
                        // 清除之前的错误，然后播放
                        setError(null);
                        await playSpeech(translatedText);
                      }}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg ${
                        status === AppStatus.SPEAKING ? 'bg-blue-600 text-white animate-pulse' : 'bg-white text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-100'
                      }`}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    </button>
                  )}
                </div>

                {targetLang === 'none' ? (
                  <p className="text-sm italic text-slate-400 font-medium py-4">
                    Choose a target language for instant translation.
                  </p>
                ) : status === AppStatus.TRANSLATING ? (
                  <div className="space-y-4 py-4">
                    <div className="h-8 bg-blue-100/50 rounded-2xl w-full animate-pulse"></div>
                    <div className="h-8 bg-blue-100/50 rounded-2xl w-4/5 animate-pulse"></div>
                  </div>
                ) : (
                  <p className="text-2xl md:text-3xl font-black text-blue-600 leading-tight">
                    {translatedText || '...'}
                  </p>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
