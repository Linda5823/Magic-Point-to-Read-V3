
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { analyzeImage, generateSpeech, decodeAudioData, translateWithPivot } from './services/geminiService';
import { TextBlock, AppStatus, LanguageCode } from './types';

const STATUS_LABELS: Record<AppStatus, string> = {
  [AppStatus.IDLE]: 'IDLE / 空闲',
  [AppStatus.UPLOADING]: 'UPLOADING / 上传中',
  [AppStatus.ANALYZING]: 'ANALYZING / 分析中',
  [AppStatus.READY]: 'READY / 就绪',
  [AppStatus.SPEAKING]: 'SPEAKING / 朗读中',
  [AppStatus.TRANSLATING]: 'TRANSLATING / 翻译中',
  [AppStatus.ERROR]: 'ERROR / 错误',
};
import PointReader from './components/PointReader';
import LanguageSelect from './components/LanguageSelect';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [activeBlock, setActiveBlock] = useState<TextBlock | null>(null);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState<LanguageCode>('none');
  const [isFullMode, setIsFullMode] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCache = useRef<Map<string, AudioBuffer>>(new Map());
  const changeImageInputRef = useRef<HTMLInputElement | null>(null);

  // 智能重组算法：利用坐标还原阅读顺序
  const fullOriginalText = useMemo(() => {
    if (blocks.length === 0) return '';
    return [...blocks]
      .sort((a, b) => {
        const rowTolerance = 25;
        const yDiff = a.box_2d[0] - b.box_2d[0];
        if (Math.abs(yDiff) <= rowTolerance) {
          return a.box_2d[1] - b.box_2d[1];
        }
        return yDiff;
      })
      .map(b => b.text.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, [blocks]);

  // Auto-translate when target language or mode changes
  useEffect(() => {
    const textToTranslate = isFullMode ? fullOriginalText : activeBlock?.text;
    if (textToTranslate && targetLang !== 'none') {
      const reTranslate = async () => {
        try {
          setError(null);
          setStatus(AppStatus.TRANSLATING);
          const result = await translateWithPivot(textToTranslate, targetLang);
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
      setError(null);
    }
  }, [targetLang, activeBlock?.text, isFullMode, fullOriginalText]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setStatus(AppStatus.UPLOADING);
    setBlocks([]);
    setActiveBlock(null);
    setTranslatedText(null);
    setIsFullMode(false);
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
    
    setIsFullMode(false);
    setActiveBlock(block);
    setError(null);
    setTranslatedText(null);

    // Speak original immediately; translation is handled by useEffect
    await playSpeech(text);
  }, [status]);

  return (
    <div className={`min-h-screen flex flex-col items-center py-6 md:py-10 px-4 ${(activeBlock || isFullMode) ? 'pb-[28rem] md:pb-[24rem]' : 'pb-8'}`}>
      <header className="max-w-4xl w-full text-center mb-6 md:mb-8">
        <h1 className="text-3xl md:text-5xl font-extrabold mb-2 tracking-tight flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 flex-nowrap">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 whitespace-nowrap">Magic Point-to-Read</span>
            <span className="text-3xl flex-shrink-0 drop-shadow-sm">🪄</span>
          </div>
          <span className="text-lg md:text-xl font-semibold text-slate-500/80 tracking-[0.25em] mt-0.5">魔法点读笔</span>
        </h1>
        <div className="text-slate-500/90 font-medium px-4 text-sm md:text-base flex flex-col items-center gap-1 mt-4 max-w-xl mx-auto">
          <p className="leading-relaxed">Upload any reading material and click on text to hear it spoken or translated.</p>
          <p className="text-xs md:text-sm text-slate-400">上传图片，点击文字，Gemini 为你朗读和翻译</p>
        </div>
      </header>

      <main className="max-w-4xl w-full flex flex-col items-center">
        <div className={`w-full bg-white/95 backdrop-blur-sm rounded-2xl md:rounded-3xl shadow-lg border border-slate-100 p-4 md:p-6 mb-6 transition-all relative overflow-hidden ${!imageUrl ? 'border-dashed border-slate-200' : 'shadow-xl shadow-slate-200/50'}`}>
          {!imageUrl ? (
            <div className="flex flex-col items-center justify-center py-24 md:py-40">
              <label className="cursor-pointer w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full flex items-center justify-center mb-10 relative group hover:from-blue-100 hover:to-indigo-100 transition-all active:scale-95 shadow-inner border border-blue-100/50">
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
              <label className="cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-5 px-12 rounded-2xl transition-all shadow-lg shadow-blue-200/50 active:scale-95 text-lg md:text-xl tracking-wide flex flex-col items-center group text-center">
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
              <div className="flex justify-center w-full px-4 md:px-6 mb-4">
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/95 shadow-lg overflow-hidden">
                  {imageUrl && blocks.length > 0 && status !== AppStatus.ANALYZING && (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          if (isFullMode) {
                            setIsFullMode(false);
                            setActiveBlock(null);
                            setTranslatedText(null);
                          } else {
                            setIsFullMode(true);
                            setActiveBlock(null);
                            if (fullOriginalText) {
                              setError(null);
                              await playSpeech(fullOriginalText);
                            }
                          }
                        }}
                        className={`flex items-center gap-2 px-5 py-2.5 font-semibold text-xs uppercase tracking-wider transition-all ${
                          isFullMode ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        <span className="flex flex-col items-start leading-tight text-left"><span>READ FULL</span><span className="text-[10px] font-medium normal-case">{isFullMode ? '全文模式已开启' : '全文模式'}</span></span>
                      </button>
                      <div className="w-px h-5 bg-slate-200" aria-hidden />
                    </>
                  )}
                  {imageUrl && (
                    <>
                      <button
                        type="button"
                        onClick={() => changeImageInputRef.current?.click()}
                        className="flex items-center gap-2 px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition-all"
                      >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="flex flex-col items-start leading-tight text-left"><span>CHANGE IMAGE</span><span className="text-[10px] font-medium normal-case">更换图片</span></span>
                      </button>
                      <input
                        ref={changeImageInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileUpload}
                      />
                    </>
                  )}
                </div>
              </div>

              {error && (
                <div className="mx-4 md:mx-6 mb-6 bg-rose-50 text-rose-700 p-4 rounded-xl text-sm border border-rose-100 flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  <div><span className="font-bold">Error:</span> {error}</div>
                </div>
              )}

              <div className="relative w-full flex justify-center px-2 md:px-4">
                <PointReader imageUrl={imageUrl} blocks={blocks} onTextClick={handleTextClick} activeBlock={activeBlock} isAnalyzing={status === AppStatus.ANALYZING} />
              </div>

              {/* 进度条：图片下方 */}
              <div className="w-full max-w-md mx-auto mt-4 px-4">
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      status === AppStatus.ANALYZING || status === AppStatus.UPLOADING
                        ? 'w-3/4 bg-indigo-500 animate-pulse'
                        : status === AppStatus.READY || status === AppStatus.SPEAKING || status === AppStatus.TRANSLATING
                        ? 'w-full bg-indigo-500'
                        : status === AppStatus.ERROR
                        ? 'w-full bg-rose-500'
                        : 'w-0 bg-slate-300'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 text-center font-medium uppercase tracking-wider">
                  {STATUS_LABELS[status]}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Translation Panel */}
      {(activeBlock || isFullMode) && (
        <div className="fixed bottom-4 left-3 right-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-3xl md:w-full z-50">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl md:rounded-3xl shadow-xl shadow-slate-300/30 border border-slate-200/80">
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
              
              {/* Source Column */}
              <div className="flex-1 p-6 md:p-10 flex flex-col max-h-64 md:max-h-[30rem] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Original / 原文</span>
                  </div>
                  <button 
                    onClick={async () => {
                      setError(null);
                      const text = isFullMode ? fullOriginalText : activeBlock?.text;
                      if (text) await playSpeech(text);
                    }}
                    className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                  </button>
                </div>
                <p className={`font-semibold text-slate-800 leading-relaxed ${isFullMode ? 'text-lg' : 'text-xl md:text-2xl'}`}>
                  {isFullMode ? fullOriginalText : activeBlock?.text}
                </p>
              </div>

              {/* Connector Arrow */}
              <div className="hidden md:flex items-center justify-center px-3 bg-slate-50/80">
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-indigo-300 shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </div>
              </div>

              {/* Target Column */}
              <div className="flex-1 p-6 md:p-10 flex flex-col bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
                <div className="flex items-center justify-between mb-4">
                  <LanguageSelect value={targetLang} onChange={(code) => setTargetLang(code)} />

                  {translatedText && (
                    <button 
                      onClick={async () => {
                        setError(null);
                        await playSpeech(translatedText);
                      }}
                      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                        status === AppStatus.SPEAKING ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white border border-indigo-100 shadow-sm'
                      }`}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    </button>
                  )}
                </div>

                {targetLang === 'none' ? (
                  <p className="text-sm text-slate-400 font-medium py-4">
                    Choose a target language for instant translation.
                  </p>
                ) : status === AppStatus.TRANSLATING ? (
                  <div className="space-y-3 py-4">
                    <div className="h-6 bg-indigo-100/60 rounded-xl w-full animate-pulse"></div>
                    <div className="h-6 bg-indigo-100/60 rounded-xl w-4/5 animate-pulse"></div>
                  </div>
                ) : (
                  <p className={`font-semibold text-indigo-700 leading-relaxed ${isFullMode ? 'text-lg' : 'text-xl md:text-2xl'}`}>
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
