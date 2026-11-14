import { useLanguage } from '../i18n/LanguageProvider';

import React, { useState, useEffect, useRef } from 'react';
import { VisualNovel, Character, DialogueLine } from '../types';
import { PlayIcon, RefreshIcon, SparklesIcon } from './icons';
import { chatWithCharacter } from '../services/geminiService';
import { Analytics } from '../utils/analytics';
import { resolveContentLanguage } from '../i18n/locales';

interface GamePlayerProps {
  vn: VisualNovel;
  currentSceneId: string;
  onChoice: (nextSceneId: string) => void;
  startFromTitle?: boolean;
  onFinish?: (endingSceneId: string) => void;
  onStarted?: () => void;
  onEndingReached?: (endingSceneId: string) => void;
  allowChat?: boolean;
}

const CharacterSprite: React.FC<{ character: Character; isSpeaking: boolean; expressionId: string | null; index: number; total: number }> = ({ character, isSpeaking, expressionId, index, total }) => {
  const { t } = useLanguage();
    const [currentImage, setCurrentImage] = useState<string>(() => {
      const expression = isSpeaking && expressionId
        ? character.expressions.find(e => e.id === expressionId || e.name === expressionId)
        : character.expressions.find(e => e.name === '중립') || character.expressions[0];
      return expression?.imageUrl || '';
    });
    
    useEffect(() => {
        let expr = (isSpeaking && expressionId)
            ? character.expressions.find(e => e.id === expressionId || e.name === expressionId) 
            : character.expressions.find(e => e.name === '중립') || character.expressions[0];
        
        if (expr?.imageUrl) {
            setCurrentImage(expr.imageUrl);
        }
    }, [expressionId, isSpeaking, character]);

    const isMobile = window.innerWidth < 768;
    const layout = {
        mobile: { spread: 30, baseScale: 1.05, activeScale: 1.35, verticalOffset: '-5%' },
        desktop: { spread: 60, baseScale: 0.95, activeScale: 1.15, verticalOffset: '0%' }
    };

    const config = isMobile ? layout.mobile : layout.desktop;
    const centerPoint = 50;
    let xPos = total <= 1 ? centerPoint : ((index / (total - 1)) * config.spread + (centerPoint - config.spread / 2));
    
    if (isSpeaking && total > 1) {
        xPos = (xPos * 0.7) + (centerPoint * 0.3);
    }

    const scale = isSpeaking ? config.activeScale : config.baseScale;

    return (
        <div 
            className="absolute bottom-0 h-[90%] sm:h-[95%] w-[100%] sm:w-[55%] transition-all duration-700 cubic-bezier(0.2, 0.8, 0.2, 1) pointer-events-none origin-bottom"
            style={{ 
                left: `${xPos}%`, 
                bottom: config.verticalOffset,
                transform: `translateX(-50%) scale(${scale})`,
                zIndex: isSpeaking ? 20 : 10,
                filter: isSpeaking 
                    ? 'brightness(1.1) contrast(1.05) drop-shadow(0 0 25px rgba(255,255,255,0.3))' 
                    : 'brightness(0.85) saturate(0.9) contrast(0.95)'
            }}
        >
            {currentImage ? <img
                src={currentImage} 
                alt={character.name}
                onError={() => setCurrentImage('')}
                className="h-full w-full object-contain object-bottom drop-shadow-[0_30px_60px_rgba(0,0,0,0.8)]"
            /> : <div aria-label={character.name} role="img" className="h-full flex flex-col items-center justify-end pb-10 opacity-80">
                <div className="w-24 h-24 rounded-full bg-indigo-300 border-4 border-indigo-100" />
                <div className="w-52 h-72 rounded-t-full bg-indigo-600 border-4 border-indigo-300" />
            </div>}
        </div>
    );
};

const GameplayScreen: React.FC<{ vn: VisualNovel; currentSceneId: string; onChoice: (id: string) => void; onRestart: () => void; onFinish?: (id: string) => void; onEndingReached?: (id: string) => void; allowChat: boolean }> = ({ vn, currentSceneId, onChoice, onRestart, onFinish, onEndingReached, allowChat }) => {
  const { t } = useLanguage();
    const [dialogueIndex, setDialogueIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState("");
    const [isChatMode, setIsChatMode] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [isAITyping, setIsAITyping] = useState(false);
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', text: string, expressionName?: string }[]>([]);
    
    const [activeChatCharId, setActiveChatCharId] = useState<string | null>(null);
    const [activeChatExprId, setActiveChatExprId] = useState<string | null>(null);

    const [bgState, setBgState] = useState<{current: string, previous: string | null, transitioning: boolean}>({
        current: vn.scenes.find(scene => scene.id === currentSceneId)?.backgroundUrl || '',
        previous: null,
        transitioning: false
    });
    
    const timerRef = useRef<number | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const trackedCompleteRef = useRef<string | null>(null);
    const currentScene = vn.scenes.find(s => s.id === currentSceneId);
    const currentLine = currentScene?.dialogue[dialogueIndex];
    useEffect(() => {
      if (currentScene?.stage === 'gyeol' && currentScene.choices.length === 0) onEndingReached?.(currentScene.id);
    }, [currentSceneId]);

    const isLast = dialogueIndex >= (currentScene?.dialogue.length || 0) - 1;
    const isTyping = displayedText.length < (isChatMode ? 0 : (currentLine?.text.length || 0));

    // playComplete analytics tracking - placed here (ABOVE early return) to follow React rules of hook consistency
    useEffect(() => {
        if (isLast && currentScene && currentScene.choices.length === 0 && !isTyping && !isChatMode && trackedCompleteRef.current !== currentScene.id) {
            trackedCompleteRef.current = currentScene.id;
            Analytics.playComplete();
        }
    }, [isLast, currentScene, isTyping, isChatMode]);

    // 자동 스크롤 로직
    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isChatMode) {
            scrollToBottom();
        }
    }, [chatHistory, isAITyping, isChatMode]);

    useEffect(() => {
        if (currentScene?.backgroundUrl && currentScene.backgroundUrl !== bgState.current) {
            setBgState(prev => ({
                previous: prev.current,
                current: currentScene.backgroundUrl,
                transitioning: true
            }));
            
            const timeout = setTimeout(() => {
                setBgState(prev => ({ ...prev, transitioning: false, previous: null }));
            }, 800);
            return () => clearTimeout(timeout);
        }
    }, [currentScene?.backgroundUrl]);

    useEffect(() => { 
        setDialogueIndex(0); 
        setChatHistory([]);
        setIsChatMode(false);
    }, [currentSceneId]);

    useEffect(() => {
        if (!isChatMode && currentLine?.text) {
            setDisplayedText("");
            let i = 0;
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = window.setInterval(() => {
                setDisplayedText(currentLine.text.substring(0, i + 1));
                i++;
                if (i >= currentLine.text.length) clearInterval(timerRef.current!);
            }, 25);
            return () => { if (timerRef.current) clearInterval(timerRef.current); };
        }
    }, [currentLine, dialogueIndex, isChatMode]);

    if (!currentScene) {
        return (
            <div className="w-full h-full bg-[#07090d]/95 hover:bg-black/90 flex flex-col items-center justify-center text-center p-6 select-none relative" onClick={e => e.stopPropagation()}>
                <div className="max-w-md p-8 bg-gray-900/90 border border-red-500/30 rounded-3xl shadow-2xl space-y-6 animate-scale-up backdrop-blur-xl">
                    <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 text-red-400 rounded-full flex items-center justify-center mx-auto text-3xl font-bold animate-pulse">
                        ⚠️
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-black text-white">{t("장면을 찾을 수 없습니다")}</h2>
                        <p className="text-sm text-gray-400 leading-relaxed">{t("이동 대상 장면 정보가 존재하지 않거나 유효하지 않습니다. 이야기를 보정하거나 처음으로 돌아가 보행을 재개하세요.")}</p>
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onRestart(); }} 
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-gray-950 font-black rounded-2xl shadow-lg transition-transform active:scale-95 text-sm"
                    >{t("시나리오 처음으로 가기")}</button>
                </div>
            </div>
        );
    }

    if (!currentLine && !isChatMode) {
        return (
            <div className="w-full h-full bg-[#07090d]/95 hover:bg-black/90 flex flex-col items-center justify-center text-center p-6 select-none relative" onClick={e => e.stopPropagation()}>
                <div className="max-w-md p-8 bg-gray-900/90 border border-indigo-500/20 rounded-3xl shadow-2xl space-y-6 animate-scale-up backdrop-blur-xl">
                    <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
                        💬
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-black text-white">{t("대사가 비어 있습니다")}</h2>
                        <p className="text-sm text-gray-400 leading-relaxed">{t("이 씬 내에 대사나 기재문이 기입되어 있지 않습니다. 라이브 챗을 켜 자유 소통하거나, 편집기에서 채워주십시오.")}</p>
                    </div>
                    <div className="flex gap-2">
                        {allowChat && <button
                            onClick={(e) => { e.stopPropagation(); setIsChatMode(true); }} 
                            className="flex-grow py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-gray-950 font-black rounded-2xl text-xs transition-transform active:scale-95"
                        >{t("라이브 챗 열기")}</button>}
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRestart(); }} 
                            className="px-5 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-extrabold rounded-2xl text-xs transition-transform active:scale-95"
                        >{t("처음으로")}</button>
                    </div>
                </div>
            </div>
        );
    }

    const speaker = isChatMode 
        ? vn.characters.find(c => c.id === activeChatCharId)
        : vn.characters.find(c => c.id === currentLine?.characterId);

    const handleAdvance = () => {
        if (isChatMode) return; 
        
        if (isTyping) {
            if (timerRef.current) clearInterval(timerRef.current);
            setDisplayedText(currentLine?.text || "");
        } else if (!isLast) {
            setDialogueIndex(d => d + 1);
        }
    };

    const handleSendChat = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim() || isAITyping || !currentScene) return;

        const charId = currentLine?.characterId || currentScene.presentCharacterIds[0];
        const char = vn.characters.find(c => c.id === charId);
        if (!char) return;

        const userInput = chatInput;
        setChatInput("");
        setChatHistory(prev => [...prev, { role: 'user', text: userInput }]);
        setIsAITyping(true);
        
        try {
            const response = await chatWithCharacter(char, currentScene.aiPrompt || currentScene.name, userInput, chatHistory, { contentLanguage: resolveContentLanguage(vn.contentLanguage) });
            
            setChatHistory(prev => [...prev, { role: 'model', text: response.text, expressionName: response.expressionName }]);
            setActiveChatCharId(char.id);
            setActiveChatExprId(response.expressionName); 

        } catch (error) {
            setChatHistory(prev => [...prev, { role: 'model', text: t('시스템 오류: AI와 연결할 수 없습니다.') }]);
        } finally {
            setIsAITyping(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-black relative overflow-hidden select-none touch-none" onClick={handleAdvance}>
            {/* Background Layers */}
            <div 
                className={`absolute inset-0 bg-cover bg-center transition-all duration-1000 scale-105 ${bgState.transitioning ? 'opacity-0' : 'opacity-100'}`} 
                style={{ backgroundImage: `url(${bgState.current})` }}
            >
                <div className="absolute inset-0 bg-black/10 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
            </div>

            {/* Sprites Layer */}
            <div className={`absolute inset-0 flex items-end justify-center pointer-events-none transition-all duration-500 ${isChatMode ? 'opacity-90 scale-100' : 'opacity-100 scale-100'}`}>
                {currentScene.presentCharacterIds.map((id, idx) => {
                    const char = vn.characters.find(c => c.id === id);
                    if (!char) return null;
                    let exprId = currentLine?.expressionId;
                    let isSpeaking = id === currentLine?.characterId;
                    if (isChatMode) {
                        isSpeaking = id === activeChatCharId;
                        exprId = isSpeaking ? activeChatExprId : null;
                    }
                    return <CharacterSprite key={id} character={char} isSpeaking={isSpeaking} index={idx} total={currentScene.presentCharacterIds.length} expressionId={exprId} />;
                })}
            </div>

            {/* Dialogue / Chat Layer */}
            <div className={`absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 w-[96%] sm:w-[94%] max-w-5xl z-30 transition-all duration-500 ${isChatMode ? 'h-[75vh]' : 'h-auto'}`}>
                {/* 
                   isChatMode에 따라 스타일 분리:
                   - 일반 모드: bg-black/85 (불투명), backdrop-blur-3xl (블러), 테두리 유
                   - 채팅 모드: bg-black/5 (5% 투명 블랙), 블러 제거, 아주 연한 테두리 유
                */}
                <div className={`relative ${isChatMode ? 'bg-black/5 border-white/5 shadow-xl' : 'bg-black/85 border-white/10 backdrop-blur-3xl border shadow-2xl'} p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] animate-slide-up flex flex-col h-full transition-all duration-500`}>
                    
                    {/* 상단 컨트롤 바 */}
                    <div className="absolute -top-12 right-4 flex items-center gap-3">
                        {allowChat && <button
                            onClick={(e) => { e.stopPropagation(); setIsChatMode(!isChatMode); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full font-black text-[11px] tracking-widest transition-all border shadow-xl ${isChatMode ? 'bg-indigo-600 border-indigo-400 text-gray-950' : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'}`}
                        >
                            <SparklesIcon className="w-3.5 h-3.5" />
                            {isChatMode ? t("LIVE CHAT ON") : t("ENTER CHAT MODE")}
                        </button>}
                    </div>

                    {!isChatMode ? (
                        /* 표준 비주얼 노벨 대사창 (기존 스타일) */
                        <div className="animate-fade-in py-4 sm:py-6">
                            {speaker && (
                                <div className="absolute -top-4 sm:-top-7 left-6 sm:left-1/2 sm:-translate-x-1/2 px-4 sm:px-8 py-1 sm:py-2.5 bg-indigo-700 border border-indigo-500 rounded-lg sm:rounded-2xl text-white font-black text-xs sm:text-xl shadow-lg whitespace-nowrap tracking-tight">
                                    {speaker.name}
                                </div>
                            )}
                            <div data-testid="player-dialogue" className="text-white text-base sm:text-2xl leading-relaxed sm:leading-[1.8] min-h-[3.5rem] sm:min-h-[6.5rem] font-medium text-center whitespace-pre-wrap drop-shadow-md">
                                {displayedText}
                            </div>
                            {isLast && currentScene.choices.length > 0 && (() => {
                                const checkedChoices = currentScene.choices.map(choice => {
                                    const isChoiceConnected = choice.nextSceneId && vn.scenes.some(s => s.id === choice.nextSceneId);
                                    return { ...choice, isChoiceConnected };
                                });
                                const allChoicesDisconnected = checkedChoices.every(ch => !ch.isChoiceConnected);

                                return (
                                    <div className="mt-4 sm:mt-8 space-y-4">
                                        {allChoicesDisconnected && (
                                            <div className="p-4 bg-red-950/45 border border-red-500/50 rounded-2xl text-red-300 font-extrabold text-xs sm:text-sm text-center animate-pulse drop-shadow-md">{t("아직 연결된 다음 장면이 없습니다.")}</div>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 animate-fade-in">
                                            {checkedChoices.map((choice, i) => (
                                                <button 
                                                    key={i} 
                                                    disabled={!choice.isChoiceConnected}
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        if (!choice.isChoiceConnected) return;
                                                        Analytics.playerChoice(currentSceneId);
                                                        onChoice(choice.nextSceneId); 
                                                    }} 
                                                    className={`p-3.5 sm:p-5 border rounded-xl sm:rounded-2xl transition-all text-center font-bold text-sm sm:text-lg shadow-xl shrink-0 ${
                                                        choice.isChoiceConnected 
                                                            ? 'bg-indigo-600/70 hover:bg-indigo-500 border-indigo-400/30 text-white cursor-pointer active:scale-95' 
                                                            : 'bg-gray-900/60 border-gray-850 text-gray-500 cursor-not-allowed opacity-65'
                                                    }`}
                                                >
                                                    {choice.text} {!choice.isChoiceConnected && t(' (미연결)')}
                                                </button>
                                            ))}
                                        </div>

                                        {allChoicesDisconnected && (
                                            <div className="flex justify-center mt-3 animate-fade-in">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onRestart(); }} 
                                                    className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-extrabold text-xs sm:text-sm rounded-full flex items-center gap-2 border border-gray-750 transition-colors shadow-lg active:scale-95"
                                                >
                                                    <RefreshIcon className="w-4 h-4" />{t("시나리오 처음으로 가기")}</button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                            {isLast && currentScene.choices.length === 0 && (
                                <div className="mt-6 flex flex-col items-center animate-fade-in">
                                    {onFinish && !isTyping && <button className="mb-3 px-6 py-3 bg-indigo-600 text-gray-950 rounded-full font-bold" onClick={e => { e.stopPropagation(); onFinish(currentScene.id); }}>{t('Finish quick')}</button>}
                                    <button onClick={(e) => { e.stopPropagation(); onRestart(); }} className="px-6 py-3 sm:px-10 sm:py-4 bg-white text-black font-black text-sm sm:text-lg rounded-full flex items-center gap-2 shadow-2xl active:scale-95 transition-transform">
                                        <RefreshIcon className="w-4 h-4 sm:w-5 sm:h-5" />{t("RESTART")}</button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* 채팅 모드 (5% 투명 블랙 & 블러 제거 버전) */
                        <div className="flex flex-col h-full animate-fade-in" onClick={e => e.stopPropagation()}>
                            <div className="flex-grow overflow-y-auto px-2 py-4 space-y-4 custom-scrollbar">
                                {chatHistory.length === 0 && (
                                    <div className="text-center py-10 text-white/60 italic text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-bold">
                                        {t('{name}님과 대화를 시작해보세요.', { name: vn.characters.find(c => c.id === (currentLine?.characterId || currentScene.presentCharacterIds[0]))?.name || '' })}
                                    </div>
                                )}
                                {chatHistory.map((msg, idx) => {
                                    const isMe = msg.role === 'user';
                                    const char = vn.characters.find(c => c.id === (currentLine?.characterId || currentScene.presentCharacterIds[0]));
                                    const avatar = char?.expressions.find(e => e.name === msg.expressionName || e.name === '중립')?.imageUrl || char?.expressions[0].imageUrl;

                                    return (
                                        <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-scale-up`}>
                                            <div className={`flex max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                                                {!isMe && (
                                                    <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/30 flex-shrink-0 mb-1 self-start mt-1 shadow-xl">
                                                        <img src={avatar} className="w-full h-full object-cover" alt={char?.name || ''} />
                                                    </div>
                                                )}
                                                <div className="flex flex-col">
                                                    {!isMe && <span className="text-[11px] font-black text-white ml-1 mb-1 drop-shadow-[0_1px_2px_rgba(0,0,0,1)] uppercase tracking-tighter">{char?.name}</span>}
                                                    <div className={`px-4 py-2.5 rounded-2xl text-sm sm:text-base font-bold shadow-2xl leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${isMe ? 'bg-indigo-600 text-gray-950 rounded-tr-none border border-white/20' : 'bg-gray-900/90 text-gray-100 rounded-tl-none border border-white/10'}`}>
                                                        {msg.text}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {isAITyping && (
                                    <div className="flex justify-start animate-fade-in">
                                        <div className="bg-black/40 px-4 py-2 rounded-2xl rounded-tl-none flex items-center gap-1 border border-white/10 shadow-lg">
                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></div>
                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            <form onSubmit={handleSendChat} className="mt-4 flex gap-2 pt-4 border-t border-white/20">
                                <input 
                                    type="text"
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    placeholder={t("메시지를 입력하세요...")}
                                    className="flex-grow bg-black/60 border border-white/20 rounded-2xl px-5 py-3 text-white text-sm sm:text-base outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold placeholder-white/40 shadow-2xl"
                                    disabled={isAITyping}
                                />
                                <button 
                                    type="submit"
                                    disabled={isAITyping || !chatInput.trim()}
                                    className="px-6 bg-indigo-600 hover:bg-indigo-500 text-gray-950 font-black rounded-2xl transition-all shadow-2xl text-sm uppercase tracking-widest active:scale-95 border border-white/10"
                                >{t("SEND")}</button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
            `}</style>
        </div>
    );
};

const GamePlayer: React.FC<GamePlayerProps> = ({ vn, currentSceneId, onChoice, startFromTitle = true, onFinish, onStarted, onEndingReached, allowChat = true }) => {
  const { t } = useLanguage();
  const [gameState, setGameState] = useState<'title' | 'playing'>(startFromTitle ? 'title' : 'playing');

  if (gameState === 'title') {
      const bg = vn.coverUrl || vn.scenes.find(s => s.id === vn.startSceneId)?.backgroundUrl;
      return (
        <div className="w-full h-full bg-black flex flex-col items-center justify-center relative text-white overflow-hidden p-6 text-center">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bg})` }}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            </div>
            <div className="z-10 animate-fade-in max-w-full">
                <h1 className="text-4xl sm:text-7xl lg:text-8xl font-black mb-6 sm:mb-10 drop-shadow-2xl italic leading-tight px-4 break-words tracking-tighter">
                    {vn.title}
                </h1>
                <p className="text-base sm:text-2xl text-indigo-100/80 mb-10 sm:mb-16 mx-auto leading-relaxed italic max-w-2xl px-4">
                    "{vn.description}"
                </p>
                <button 
                    onClick={() => { 
                        onStarted?.();
                        Analytics.playStart(vn.startSceneId);
                        onChoice(vn.startSceneId); 
                        setGameState('playing'); 
                    }}
                    className="px-12 py-5 sm:px-20 sm:py-7 bg-indigo-600 hover:bg-indigo-500 text-gray-950 rounded-full font-black text-xl sm:text-2xl transition-all shadow-[0_0_40px_rgba(200,241,53,0.3)] active:scale-95"
                >{t("START JOURNEY")}</button>
            </div>
        </div>
      );
  }
  
  return <GameplayScreen vn={vn} currentSceneId={currentSceneId} onChoice={onChoice} onRestart={() => setGameState('title')} onFinish={onFinish} onEndingReached={onEndingReached} allowChat={allowChat} />;
};

export default GamePlayer;
