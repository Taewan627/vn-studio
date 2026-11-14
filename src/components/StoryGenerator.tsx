import { useLanguage } from '../i18n/LanguageProvider';
import { GenreImage } from './GenreImage';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, resolveContentLanguage, type ContentLanguage } from '../i18n/locales';
import React, { useState, useEffect } from 'react';
import { SparklesIcon, RefreshIcon } from './icons';
import { StoryStage, VisualNovel, StoryCardOption } from '../types';
import { generateStoryProposals } from '../services/geminiService';
import { Analytics } from '../utils/analytics';

interface StoryGeneratorProps {
  manualOnly?: boolean;
  contentLanguage: ContentLanguage;
  setContentLanguage: (language: ContentLanguage) => void;
  vn: VisualNovel;
  aiTheme: string;
  setAiTheme: (theme: string) => void;
  onGenerateStory: () => void;
  onGenerateDemoStory: () => void;
  isGenerating: boolean;
  progress: number;
  error: string | null;
  // 재귀 지원 상태 및 핸들러 추가
  recursiveStage: StoryStage | 'completed' | null;
  setRecursiveStage: (stage: StoryStage | 'completed' | null) => void;
  recursiveQuestion: string;
  recursiveChoices: string[];
  onStartRecursive: (themeOverride?: string) => void;
  onNextRecursive: (userInput: string) => void;
  onCancelRecursive: () => void;
  onOpenNovelCompiler: () => void;
  showRelayedToast: boolean;
  setShowRelayedToast: (show: boolean) => void;
}

export const StoryGenerator: React.FC<StoryGeneratorProps> = ({
  manualOnly = false, contentLanguage, setContentLanguage,
  vn,
  aiTheme,
  setAiTheme,
  onGenerateStory,
  onGenerateDemoStory,
  isGenerating,
  progress,
  error,
  recursiveStage,
  setRecursiveStage,
  recursiveQuestion,
  recursiveChoices,
  onStartRecursive,
  onNextRecursive,
  onCancelRecursive,
  onOpenNovelCompiler,
  showRelayedToast,
  setShowRelayedToast,
}) => {
  const { t, language } = useLanguage();
  const [generatorMode, setGeneratorMode] = useState<'wizard' | 'classic'>('wizard');
  const [selectedGenre, setSelectedGenre] = useState<string>('판타지');
  const [keywordIdea, setKeywordIdea] = useState<string>('조선 악녀');
  const [storyCards, setStoryCards] = useState<StoryCardOption[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isGeneratingCards, setIsGeneratingCards] = useState<boolean>(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const [customInput, setCustomInput] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let interval: number | undefined;
    if (isGenerating) {
      setElapsedSeconds(0);
      interval = window.setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isGenerating]);

  // 조선 악녀 등 기본 키워드 추천풀
  const RANDOM_IDEAS = [
    "조선 악녀",
    "폐허가 된 미래 네오 성균관",
    "타임슬립 해커",
    "사이버 기방 에이스 인공지능",
    "심해 크리처 연구원",
    "우주 정거장의 미스터리 해결사",
    "귀신 보는 천재 소년 형사",
    "기억 포맷 로봇 점원"
  ];

  // 12가지 장르 옵션 정의
  const GENRE_OPTIONS = [
    {
      key: '판타지',
      badge: 'F',
      sub: '마법, 왕국, 금지된 유물',
      bg: '/fantasy.jpg'
    },
    {
      key: '사이버펑크',
      badge: 'C',
      sub: '네온 도시, AI, 기억과 음모',
      bg: '/cyberpunk.jpg'
    },
    {
      key: '미스터리',
      badge: '?',
      sub: '비밀, 단서, 그리고 수사',
      bg: '/mystery.jpg'
    },
    {
      key: '호러',
      badge: '!',
      sub: '불길한 장소와 불안한 선택',
      bg: '/horror.jpg'
    },
    {
      key: '로맨스',
      badge: 'R',
      sub: '따뜻한 감정과 깨지기 쉬운 약속',
      bg: '/romance.jpg'
    },
    {
      key: '아포칼립스',
      badge: 'A',
      sub: '무너진 세계 이후의 생존',
      bg: '/apocalypse.jpg'
    },
    {
      key: '현대 일상',
      badge: 'M',
      sub: '평범한 공간에 숨어 있는 전환점',
      bg: '/classic.jpg'
    },
    {
      key: '스릴러',
      badge: 'T',
      sub: '긴장, 추격, 위험',
      bg: '/thriller.jpg'
    },
    {
      key: '학교',
      badge: 'S',
      sub: '캠퍼스, 비밀, 첫 번째 선택',
      bg: '/school.jpg'
    },
    {
      key: '전쟁',
      badge: 'W',
      sub: '갈등, 충성, 불가능한 명령',
      bg: '/war.jpg'
    },
    {
      key: '모험',
      badge: 'V',
      sub: '미지의 세계로 향하는 여정',
      bg: '/adventure.jpg'
    },
    {
      key: 'SF',
      badge: 'SF',
      sub: '우주, 기계, 미래의 윤리',
      bg: '/sf.jpg'
    }
  ];

  const handleRandomizeIdea = () => {
    const random = RANDOM_IDEAS[Math.floor(Math.random() * RANDOM_IDEAS.length)];
    setKeywordIdea(random);
  };

  const handleGenerateProposals = async () => {
    const requestLanguage = contentLanguage;
    setIsGeneratingCards(true);
    setCardError(null);
    setSelectedCardId(null);
    try {
      const proposals = await generateStoryProposals(selectedGenre, keywordIdea, { contentLanguage: requestLanguage });
      setStoryCards(proposals);
    } catch (err: any) {
      console.error(err);
      setCardError(t('스토리 제안 카드를 생성하는 도중 오류가 발생했습니다. 잠시 후 임시 폴백 카드로 대체합니다.'));
      // Fallback cards on failure
      if (requestLanguage !== 'ko') { setStoryCards([]); return; }
      setStoryCards([
        {
          id: "prop_1",
          title: "페비의 메인프레임",
          tags: ["네온 블루", "차가운 복수극", "사이버펑크 느와르"],
          description: `네오-한양의 지배 기업 '조선테크'에서 쫓겨난 당신. 복수를 위해 부활된 금지 인공지능 '장희빈'의 소스 코드를 뇌에 업로드한다.`
        },
        {
          id: "prop_2",
          title: "기녀 로봇의 독약",
          tags: ["매혹적인 자줏빛", "긴박함", "은밀한 배신"],
          description: `최고급 사이버 기방의 에이스 안드로이드인 당신. 오늘 밤, 자신을 망가뜨린 고위 관료의 시스템을 마비시킬 바이러스를 잔에 채운다.`
        },
        {
          id: "prop_3",
          title: "망나니 옹주의 반격",
          tags: ["붉은 경고등", "반항적인", "하이테크 액션"],
          description: `왕실의 골칫덩이로 낙인찍혀 쫓겨났던 황녀인 당신. 해커 집단 '우투리'를 이끌고 왕실의 위성 무기 제어권을 해킹하기 시작한다.`
        }
      ]);
    } finally {
      setIsGeneratingCards(false);
    }
  };

  const handleSelectCard = (card: StoryCardOption) => {
    setSelectedCardId(card.id);
    Analytics.storyGenerate(selectedGenre);
    const fullTheme = `제목: "${card.title}", 장르: ${selectedGenre}, 핵심 아이디어: ${keywordIdea}, 분위기: ${card.tags.join(', ')}. 설명: ${card.description}`;
    setAiTheme(fullTheme);
    
    // 자동 초기 게임 기승전결 빌딩 트리거 즉시 호출
    onStartRecursive(fullTheme);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim() || isGenerating) return;
    const stepNum = recursiveStage === 'ki' ? 1 : recursiveStage === 'seung' ? 2 : recursiveStage === 'jeon' ? 3 : recursiveStage === 'gyeol' ? 4 : 1;
    Analytics.recursiveChoice(stepNum);
    onNextRecursive(customInput.trim());
    setCustomInput('');
  };

  // 스토리 메모리 채널 텍스트 렌더러
  const getStoryMemoryText = () => {
    let memory = '';
    if (vn && vn.characters && vn.characters.length > 0) {
      vn.characters.forEach(c => {
        memory += `${c.name}: Image style: Japanese visual novel anime character sprite. Clean cel-shaded anime illustration.\n`;
      });
    } else {
      memory += `설화 (구미호): Image style: Japanese visual novel anime character sprite.\n강태오: Image style: Japanese visual novel anime character sprite.\n`;
    }
    if (vn && vn.scenes && vn.scenes.length > 0) {
      vn.scenes.slice(0, 3).forEach(s => {
        const dialogText = s.dialogue && s.dialogue[0] ? s.dialogue[0].text : t("신규 시나리오");
        memory += `[장면] ${s.name}: ${dialogText.slice(0, 35)}...\n`;
      });
    } else {
      memory += `[장면] 기녀 로봇의 탄생: 오늘 밤, 자신을 망가뜨린 고위 관료...\n`;
    }
    return memory;
  };

  const getStageTitle = (stage: string) => {
    switch (stage) {
      case 'ki': return t('기(起) - 도입');
      case 'seung': return t('승(承) - 전개');
      case 'jeon': return t('전(轉) - 절정');
      case 'gyeol': return t('결(結) - 엔딩');
      default: return '';
    }
  };

  const selectedClass = "border-cyan-400 bg-sky-950/20 shadow-[0_0_15px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/40";
  const regularClass = "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60";

  // Offline Studio shows only the project language. The genre picker belongs to
  // the optional online generation flow and is not shown in the manual workflow.
  if (manualOnly) return (
    <section className="space-y-3" data-minimal-studio="local-artwork">
      <p className="text-xs text-gray-400">{t('프로젝트 언어: {language}', { language: LANGUAGE_NAMES[resolveContentLanguage(vn.contentLanguage)] })}</p>
    </section>
  );

  return (
    <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-800 shadow-2xl space-y-5">
      <label className="block text-xs text-gray-300 space-y-1">
        <span>{t('생성 언어')}</span>
        <select aria-label={t('생성 언어')} value={contentLanguage} disabled={isGenerating}
          onChange={e => setContentLanguage(e.target.value as ContentLanguage)}
          className="w-full bg-gray-950 border border-gray-600 text-white p-2 rounded-lg">
          {SUPPORTED_LANGUAGES.map(code => <option key={code} value={code}>{LANGUAGE_NAMES[code]}</option>)}
        </select>
      </label>
      <p className="text-[11px] text-gray-400">{t('기존 콘텐츠는 자동 번역되지 않습니다.')}</p>
      <p className="text-[11px] text-gray-400">{t('프로젝트 언어: {language}', { language: LANGUAGE_NAMES[resolveContentLanguage(vn.contentLanguage)] })}</p>
      
      {/* 릴레이 완료 토스트 팝업 */}
      {showRelayedToast && (
        <div className="fixed top-4 right-4 z-[9999] animate-fade-in pointer-events-none">
          <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 text-white font-bold text-xs px-5 py-3.5 rounded-2xl shadow-[0_4px_22px_rgba(16,185,129,0.5)] border border-emerald-400/30 flex items-center gap-3">
            <span className="text-base shrink-0">✨</span>
            <div className="flex flex-col">
              <span className="font-black text-white text-[12px] uppercase tracking-wide">{t("릴레이 생성 완료!")}</span>
              <span className="text-[11px] text-emerald-100 font-semibold leading-relaxed">{t("새로운 씬과 분기가 성공적으로 직결되었습니다.")}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setShowRelayedToast(false)} 
              className="pointer-events-auto shrink-0 ml-2 text-white/70 hover:text-white transition-colors p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
        <h2 className="font-black text-sm flex items-center gap-1.5 text-white uppercase tracking-widest">
          <SparklesIcon className="w-4 h-4 text-cyan-400 animate-pulse" />{t("AI 스토리 빌더")}</h2>
        <span className="text-[11px] bg-slate-800 text-gray-400 border border-slate-700/65 px-2 py-0.5 rounded-full font-bold uppercase tracking-tight">
          {generatorMode === 'wizard' ? 'Wizard' : 'Classic'}
        </span>
      </div>

      {/* ⚠️ 최상위 오류 피드 */}
      {error && (
        <p className="text-red-400 text-xs p-3 bg-red-950/30 rounded-2xl border border-red-900/35 leading-snug font-medium">
          ⚠️ {error}
        </p>
      )}

      {/* 1. 비주얼 카드 생성 마법사 모드 (항상 상단에 표시) */}
      {generatorMode === 'wizard' && (
        <div className="space-y-4 animate-fade-in text-xs">
          
          {/* VNA 스토리플로우 라이트 브랜드 배너 헤더 */}
          <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-400">
              <span>✨</span>
              <span className="uppercase tracking-widest text-[11px]">{t("VNA 스토리플로우 라이트")}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white leading-tight tracking-tight">
              Low-input narrative authoring
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-400 leading-relaxed font-semibold">{t("장르를 고르고, 원하면 한 줄 아이디어를 더한 뒤, 스토리 카드를 선택하면 살아 있는 분기형 이야기가 생성됩니다.")}</p>
          </div>

          {/* Step 1: 장르 선택 */}
          <div className="space-y-2">
            <div className="flex justify-between items-end pb-1">
              <label className="text-[10.5px] font-black text-indigo-400 uppercase tracking-widest block">{t("1. 장르 선택")}</label>
              <span className="text-[11px] text-gray-400 font-bold tracking-tight">
                {t(GENRE_OPTIONS.find(g => g.key === selectedGenre)?.sub || '')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {GENRE_OPTIONS.map((g) => {
                const isSelected = selectedGenre === g.key;
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setSelectedGenre(g.key)}
                    disabled={isGeneratingCards || isGenerating || !!recursiveStage}
                    className={`relative group h-24 overflow-hidden rounded-2xl border transition-all text-left p-3.5 flex flex-col justify-end disabled:opacity-75 ${
                      isSelected 
                        ? 'border-indigo-500 bg-indigo-950/25 shadow-[0_0_16px_rgba(200,241,53,0.15)] ring-1 ring-indigo-500/30' 
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700/80'
                    }`}
                  >
                    <div 
                      className={`absolute inset-0 transition-all duration-300 ${
                        isSelected ? 'opacity-70 scale-105' : 'opacity-40 group-hover:opacity-55 group-hover:scale-105'
                      }`}
                    >
                      <GenreImage
                        src={g.bg}
                        alt={g.key}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                    
                    {/* Badge circle insignia */}
                    <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-black transition-all ${
                      isSelected 
                        ? 'bg-indigo-600 border-indigo-400 text-gray-950 shadow-[0_0_10px_rgba(200,241,53,0.6)]' 
                        : 'bg-slate-950/70 border-slate-800 text-gray-300'
                    }`}>
                      {g.badge}
                    </div>

                    <div className="relative z-10">
                      <h4 className="font-extrabold text-xs text-white tracking-wide">{t(g.key)}</h4>
                      <p className="text-[9.5px] text-gray-500 mt-0.5 font-semibold truncate leading-tight">{t(g.sub)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: 아이디어 입력 */}
          <div className="space-y-2">
            <label className="text-[10.5px] font-black text-indigo-400 uppercase tracking-widest block">{t("2. 아이디어 입력 선택사항")}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={keywordIdea}
                onChange={(e) => setKeywordIdea(e.target.value)}
                placeholder={t("장르 구성을 도울 문장이나 단어 (예: 조선 악녀)")}
                className="flex-grow p-3 bg-slate-950 rounded-2xl border border-slate-800/80 text-white focus:outline-none focus:border-indigo-500 transition-all font-bold text-xs"
                disabled={isGeneratingCards || isGenerating || !!recursiveStage}
              />
              <button
                type="button"
                onClick={handleRandomizeIdea}
                className="p-3 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-2xl border border-slate-700 flex items-center justify-center transition-colors"
                title={t("아이디어 무작위 조합")}
                disabled={isGeneratingCards || isGenerating || !!recursiveStage}
              >
                <RefreshIcon className="w-4 h-4 text-emerald-400" />
              </button>
            </div>
          </div>

          {/* Step 3: 스토리 카드 3개 생성 버튼 */}
          <button
            type="button"
            disabled={isGeneratingCards || isGenerating || !keywordIdea.trim() || !!recursiveStage}
            onClick={handleGenerateProposals}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-gray-950 rounded-2xl transition-all font-black uppercase text-xs tracking-wider shadow-lg flex items-center justify-center gap-2 border border-indigo-400/15 disabled:from-indigo-900/60 disabled:to-indigo-950/60 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            <SparklesIcon className="w-4 h-4 text-yellow-300 animate-pulse" />
            <span>{isGeneratingCards ? t("스토리 카드를 기획 중...") : t("3. 스토리 카드 3개 생성")}</span>
          </button>

          {/* 스토리 카드 제안 옵리스트 */}
          {storyCards.length > 0 && (
            <div className="space-y-3 pt-2 animate-fade-in">
              <div className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center justify-between pb-1">
                <span>{t("📋 제안된 기획 카드 (하나를 선택해 시작)")}</span>
                <span className="text-cyan-400 font-bold">{storyCards.length}{t("개 조합 제안됨")}</span>
              </div>

              <div className="space-y-3.5">
                {storyCards.map((card) => {
                  const isSelected = selectedCardId === card.id;
                  // Thumbnail mapping
                  const thumbMap: Record<string, string> = {
                    prop_1: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=150',
                    prop_2: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=150',
                    prop_3: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=150'
                  };
                  const thumbUrl = thumbMap[card.id] || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=150';

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => handleSelectCard(card)}
                      disabled={isGenerating || !!recursiveStage}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex gap-3.5 disabled:opacity-75 ${
                        isSelected ? selectedClass : regularClass
                      }`}
                    >
                      {/* Left thumbnail image layout */}
                      <div 
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-cover bg-center shrink-0 border border-slate-800 mix-blend-color-dodge opacity-80"
                        style={{ backgroundImage: `url('${thumbUrl}')` }}
                      ></div>

                      {/* Right story content layout */}
                      <div className="flex-grow space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-extrabold text-[12.5px] text-white truncate tracking-wide">{card.title}</h4>
                          {isSelected && (
                            <span className="text-[11px] bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 px-1.5 py-0.5 rounded-full font-black tracking-widest uppercase">
                              Active
                            </span>
                          )}
                        </div>
                        
                        {/* Tags list */}
                        <div className="flex flex-wrap gap-1">
                          {card.tags.map((tag, tIdx) => {
                            const badgeThemes = [
                              'bg-cyan-950/40 text-cyan-400 border-cyan-500/10',
                              'bg-fuchsia-950/40 text-fuchsia-400 border-fuchsia-500/10',
                              'bg-amber-950/40 text-amber-400 border-amber-500/10'
                            ];
                            return (
                              <span 
                                key={tIdx} 
                                className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold tracking-tight border ${badgeThemes[tIdx % badgeThemes.length]}`}
                              >
                                {tag}
                              </span>
                            );
                          })}
                        </div>

                        {/* Description story text */}
                        <p className="text-[11px] text-slate-400 leading-normal font-semibold line-clamp-2">
                          {card.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected starting banner */}
          {selectedCardId && (
            <div className="bg-sky-950/30 p-3.5 rounded-2xl border border-cyan-500/25 text-xs text-cyan-300 font-bold flex items-center gap-2.5 animate-fade-in">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
              <span>{t("선택됨:")}<span className="font-black text-white">"{storyCards.find(c => c.id === selectedCardId)?.title || ''}"</span>{t(". 이 카드가 스토리 그래프의 출발점이 됩니다.")}</span>
            </div>
          )}

        </div>
      )}

      {/* 2. 기존 클래식 자유 기입 빌더 모드 */}
      {!recursiveStage && generatorMode === 'classic' && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">{t("프로젝트 테마")}</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={aiTheme} 
                onChange={e => setAiTheme(e.target.value)} 
                placeholder={t("예: '폐허가 된 24세기 네오-한양의 생존 수사극'")}
                className="flex-grow p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm" 
                disabled={isGenerating}
              />
              <button
                onClick={() => {
                  const randomThemesList = [
                    "좀비가 창궐한 조선 시대의 궁중 생존 로맨스",
                    "말하는 지능 고양이와 함께하는 사이버 형사 일지",
                    "기억을 분기별로 거래하는 로봇 상점",
                    "심해 잠수함 속의 지능 외계 미생물 스릴러",
                    "지구 종말 하루 전날의 네오 서울 편의점"
                  ];
                  setAiTheme(randomThemesList[Math.floor(Math.random() * randomThemesList.length)]);
                }}
                disabled={isGenerating}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-yellow-400 rounded-xl border border-slate-700 transition-all font-bold"
                title={t("추천 생성 키워드 얻기")}
              >
                🎲
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button 
              onClick={() => {
                Analytics.storyGenerate(selectedGenre);
                onStartRecursive();
              }} 
              disabled={isGenerating || !aiTheme.trim()} 
              className="w-full p-3 bg-indigo-600 hover:bg-indigo-500 text-gray-950 rounded-xl disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-all font-bold text-xs uppercase tracking-wider hover:scale-[1.01] shadow-lg flex items-center justify-center gap-2 border border-indigo-400/20"
            >
              <SparklesIcon className="w-4 h-4 text-yellow-300 animate-spin-slow" /> 
              <span>{isGenerating ? t("다차원 릴레이 빌딩 중...") : t("🔥 기승전결 릴레이 생성 시작 (비주얼)")}</span>
            </button>

            <button 
              onClick={() => {
                Analytics.storyGenerate('자유형식');
                onGenerateStory();
              }} 
              disabled={isGenerating || !aiTheme.trim()} 
              className="w-full p-2.5 bg-slate-800 hover:bg-slate-700 text-gray-200 hover:text-white rounded-xl disabled:bg-slate-900 disabled:text-gray-600 transition-all text-xs font-semibold border border-slate-700"
            >{t("⚡ 50초 초고속 단편 자동완성 (이전 버전)")}</button>
          </div>
        </div>
      )}

      {/* 3. 비주얼 소설 배치 중 프로그레스 바 (로딩 바) */}
      {isGenerating && (
        <div className="bg-slate-950/80 p-4 rounded-2xl border border-indigo-500/20 space-y-2.5 animate-fade-in">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>{t("비주얼 배치 중...")}</span>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-indigo-400 font-black">{progress}{t("% 경과")}</span>
              <span className="text-gray-500 font-medium">({elapsedSeconds}{t("초 경과)")}</span>
            </div>
          </div>
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div 
              className="h-full bg-indigo-500 transition-all duration-300 shadow-[0_0_8px_rgba(200,241,53,0.4)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* 4. 재귀 릴레이 인터랙티브 위자드 모드 (스토리 생성 후) */}
      {recursiveStage && recursiveStage !== 'completed' && (
        <div className="space-y-4 animate-fade-in text-xs">
          
          {/* 기승전결 단계 셀렉터 브레드크럼 */}
          <div className="flex flex-col gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-center text-[11px] font-bold text-gray-500 px-1">
              <span>{t("🎯 추가할 타겟 기승전결 레벨 선택")}</span>
              <span className="text-indigo-400 text-[11px] animate-pulse">{t("해당 레벨에 시나리오 누적")}</span>
            </div>
            <div className="flex rounded-xl overflow-hidden border border-slate-800 p-0.5 bg-slate-900">
              {(['ki', 'seung', 'jeon', 'gyeol'] as const).map((st) => {
                const isActive = recursiveStage === st;
                const labels: Record<string, string> = {
                  ki: '기(起) - 도입',
                  seung: '승(承) - 전개',
                  jeon: '전(轉) - 절정',
                  gyeol: '결(結) - 대단원'
                };
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => !isGenerating && setRecursiveStage(st)}
                    disabled={isGenerating}
                    className={`flex-1 py-1.5 text-[11px] sm:text-xs font-black tracking-wider transition-all rounded-lg text-center uppercase whitespace-nowrap ${
                      isActive 
                        ? 'bg-indigo-600 text-gray-950 shadow-md' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-slate-950'
                    }`}
                  >
                    {labels[st].split(' - ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI 스토리 인사이트 패널 */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/20 shadow-inner space-y-3.5">
            <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-[11px] uppercase tracking-widest leading-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{t("AI 스토리 인사이트")}</div>
            <p className="text-[12.5px] text-emerald-200/90 leading-relaxed font-semibold">{t("이야기는 첫 감정적 단서를 심었습니다. 이제 더 선명한 갈등을 시작할 수 있습니다.")}</p>
            
            <div className="border-t border-slate-800/60 pt-3 space-y-2">
              <p className="text-[11px] text-gray-400 font-bold mb-2">
                {recursiveQuestion || "충분한 단서가 심어졌습니다. 이제 갈등 단계를 시작해볼까요?"}
              </p>

              {recursiveChoices.length > 0 && (
                <div className="flex flex-col gap-2">
                  {recursiveChoices.map((choice, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const stepNum = recursiveStage === 'ki' ? 1 : recursiveStage === 'seung' ? 2 : recursiveStage === 'jeon' ? 3 : recursiveStage === 'gyeol' ? 4 : 1;
                        Analytics.recursiveChoice(stepNum);
                        onNextRecursive(choice);
                      }}
                      disabled={isGenerating}
                      className="w-full text-left p-3 bg-slate-900 border border-slate-800 hover:border-emerald-500/60 hover:bg-emerald-950/10 text-gray-200 hover:text-white rounded-xl font-bold text-xs transition-all shadow-sm"
                    >
                      💡 {choice}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 직접 전개 속성 직접 기술하는 폼 */}
          <form onSubmit={handleCustomSubmit} className="space-y-1.5 bg-slate-950 p-3.5 rounded-2xl border border-slate-800/65">
            <label className="text-[11px] font-extrabold text-slate-400 tracking-wider block uppercase">{t("직접 전개 묘사 (작가 모드)")}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                placeholder={t("예: 주인공 일행은 지하의 안전가옥으로 피신한다.")}
                disabled={isGenerating}
                className="flex-grow p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-white focus:outline-none focus:border-indigo-500 text-xs font-semibold"
              />
              <button
                type="submit"
                disabled={isGenerating || !customInput.trim()}
                className="px-4 bg-indigo-600 hover:bg-indigo-500 text-gray-950 font-black rounded-xl disabled:bg-slate-800 disabled:text-gray-600 text-xs tracking-wider transition-colors"
              >{t("릴레이")}</button>
            </div>
          </form>

          {/* 스토리 메모리 패널 */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/60 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
              <span>{t("스토리 메모리")}</span>
              <span className="text-[11px] text-indigo-400 font-bold">Sync OK</span>
            </div>
            
            <pre className="bg-slate-900/50 p-3 rounded-xl border border-slate-900/80 text-[11px] font-mono text-slate-400 overflow-y-auto max-h-32 custom-scrollbar whitespace-pre-wrap leading-relaxed">
              {getStoryMemoryText()}
            </pre>
            
            <p className="text-[9.5px] text-slate-500 leading-normal font-semibold">{t("릴레이 생성은 편집된 이야기와 이 메모리를 함께 전달합니다.")}</p>
          </div>

          {/* 릴레이 중단 버튼 */}
          <div className="flex justify-end pt-1">
            <button
              onClick={onCancelRecursive}
              disabled={isGenerating}
              className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/30 text-red-400 rounded-full border border-red-900/30 text-[11px] font-black tracking-wider transition-colors flex items-center gap-1 uppercase"
            >{t("❌ 릴레이 종료")}</button>
          </div>
        </div>
      )}

      {/* 5. 완료 시상 상태 */}
      {recursiveStage === 'completed' && (
        <div className="bg-gradient-to-br from-emerald-950/30 to-slate-950 p-4 rounded-3xl border border-emerald-500/30 text-center space-y-3.5 animate-fade-in text-xs">
          <div className="text-3xl">🎉</div>
          <h3 className="font-extrabold text-sm text-emerald-400 uppercase tracking-widest leading-none">{t("릴레이 스토리 완성!")}</h3>
          <p className="text-slate-300 leading-relaxed font-semibold">{t("'기승전결'을 모두 아우르는 방대한 분량의")}<br/>{t("시나리오 배치가 안전하게 완료되었습니다.")}<br/>{t("이제 우측 장면 목록에서 연결망을 조율하고 즉시 플레이해보세요!")}</p>
          <button
            onClick={onCancelRecursive}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl tracking-wider transition-all"
          >{t("편집 및 플레이 돌입")}</button>
        </div>
      )}

      {/* Divider */}
      <div className="relative flex py-3 items-center">
        <div className="flex-grow border-t border-slate-800/50"></div>
        <span className="flex-shrink mx-3 text-slate-600 text-[11px] font-black uppercase tracking-widest">OR</span>
        <div className="flex-grow border-t border-slate-800/50"></div>
      </div>

      {/* Demo Loader button */}
      <button 
        onClick={onGenerateDemoStory} 
        disabled={isGenerating} 
        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-xl disabled:bg-slate-950 disabled:text-slate-700 transition-colors text-xs font-bold border border-slate-700/40 mb-1"
      >{t("기본 데모 스토리 고속 로드")}</button>

      {/* Novel summarize trigger */}
      <button 
        onClick={onOpenNovelCompiler} 
        disabled={isGenerating}
        className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
      >
        <span>{t("📖 작성 스토리를 소설로 요약 (클립보드)")}</span>
      </button>

      {/* Mode switching Toggle at the absolute bottom */}
      <div className="pt-2 border-t border-slate-800/50 text-center">
        <button
          type="button"
          onClick={() => setGeneratorMode(prev => prev === 'wizard' ? 'classic' : 'wizard')}
          className="text-[11px] text-gray-500 hover:text-cyan-400 transition-colors font-bold uppercase tracking-wider"
        >
          {generatorMode === 'wizard' ? t("📂 원본 텍스트 생성기 보기 (Classic)") : t("🎨 비주얼 스토리 빌더 보기 (Wizard)")}
        </button>
      </div>

    </div>
  );
};
