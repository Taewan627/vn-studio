import React, { useState } from 'react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'start' | 'genre' | 'story' | 'character' | 'scene' | 'export' | 'faq'>('all');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleOpenStandaloneGuide = () => {
    window.open('/guide.html', '_blank');
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in print:p-0 print:bg-white print:static print:inset-auto">
      {/* Print-specific style */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-guide, #printable-guide * {
            visibility: visible;
          }
          #printable-guide {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: #111827 !important;
            padding: 20px !important;
            box-shadow: none !important;
            border: none !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break-inside-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print-text-dark {
            color: #1f2937 !important;
          }
          .print-bg-light {
            background-color: #f9fafb !important;
            border-color: #e5e7eb !important;
          }
        }
      `}</style>

      <div 
        id="printable-guide"
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-gray-900 border border-indigo-500/40 rounded-2xl md:rounded-3xl shadow-[0_0_60px_rgba(200,241,53,0.35)] overflow-hidden print:max-h-none print:rounded-none print:border-none"
      >
        {/* Header (No Print on small controls, but prints header title) */}
        <div className="flex-shrink-0 bg-gray-950/80 border-b border-gray-800 p-4 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:border-b-2 print:border-gray-900 print:bg-transparent print:p-0 print:pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20 print:text-indigo-900 print:border-indigo-900">
                Official User Manual
              </span>
              <span className="text-[11px] font-bold text-gray-500 print:text-gray-600">v2.5 Full Guide</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white mt-1 flex items-center gap-2 print:text-gray-900">
              📖 VN-AI Studio 초보자 사용법 완벽 가이드
            </h2>
            <p className="text-xs text-indigo-200/70 mt-0.5 print:text-gray-600">
              생성형 AI로 스토리 기획부터 캐릭터 표정 일괄 생성, 멀티 엔딩 분기, 게임 출시까지 한 번에 배우기
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto no-print">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-gray-950 rounded-xl text-xs font-black shadow-lg shadow-indigo-900/40 flex items-center gap-1.5 transition-all active:scale-95"
              title="A4 규격 PDF로 저장하거나 인쇄합니다"
            >
              <span>🖨️</span>
              <span>PDF 다운로드 / 인쇄</span>
            </button>
            <button
              onClick={handleOpenStandaloneGuide}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-gray-700"
              title="새 창에서 독립된 웹 가이드북 열기"
            >
              새 창 열기 ↗
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-all"
              title="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter Navigation Tabs (Hidden during print) */}
        <div className="flex-shrink-0 bg-gray-900/90 border-b border-gray-800 px-4 py-2 flex items-center gap-1.5 overflow-x-auto custom-scrollbar no-print">
          {[
            { id: 'all', label: '전체 보기' },
            { id: 'start', label: '1. 퀵 스타트' },
            { id: 'genre', label: '2. 12대 장르 & 스토리 카드' },
            { id: 'story', label: '3. 릴레이 스토리 집필' },
            { id: 'character', label: '4. 캐릭터 & 표정' },
            { id: 'scene', label: '5. 장면 & 대사 연출' },
            { id: 'export', label: '6. 게임 출시 & 배포' },
            { id: 'faq', label: '7. 초보자 Q&A' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-gray-950 shadow'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-grow overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar text-gray-200 print:text-gray-900 print:overflow-visible print:p-0 print:space-y-6">
          
          {/* Quick Print Notice Banner (Web Only) */}
          <div className="no-print p-3.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex items-center justify-between text-xs text-indigo-200">
            <div className="flex items-center gap-2">
              <span className="text-base">💡</span>
              <span>상단의 <b>[🖨️ PDF 다운로드 / 인쇄]</b> 버튼을 누르고 대상 프린터를 <b>'PDF로 저장'</b>으로 지정하면 소장용 매뉴얼 PDF를 즉시 생성할 수 있습니다.</span>
            </div>
          </div>

          {/* Section 1: 퀵 스타트 */}
          {(activeTab === 'all' || activeTab === 'start') && (
            <section className="space-y-4 page-break-inside-avoid">
              <div className="flex items-center gap-2 border-b border-gray-800 pb-2 print:border-gray-300">
                <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-black print:text-indigo-800">
                  STEP 01
                </span>
                <h3 className="text-lg md:text-xl font-black text-white print:text-gray-900">
                  🚀 3분 완성 퀵 스타트 (처음 시작하는 분)
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-800/60 rounded-xl border border-gray-700/80 print:bg-gray-50 print:border-gray-200">
                  <h4 className="text-sm font-black text-indigo-300 print:text-indigo-800 flex items-center gap-1.5 mb-2">
                    <span>✨ 방법 A: 템플릿으로 바로 체험하기</span>
                  </h4>
                  <p className="text-xs leading-relaxed text-gray-300 print:text-gray-700">
                    로비 화면에서 <b>[템플릿으로 새 게임 만들기]</b>를 클릭하세요. 완성된 미스터리 도서관 탐정물 템플릿(유진, 관리인 엘라)이 즉시 로드되어 곧바로 플레이하거나 수정해볼 수 있습니다.
                  </p>
                </div>
                <div className="p-4 bg-gray-800/60 rounded-xl border border-gray-700/80 print:bg-gray-50 print:border-gray-200">
                  <h4 className="text-sm font-black text-emerald-300 print:text-emerald-800 flex items-center gap-1.5 mb-2">
                    <span>✍️ 방법 B: 내 아이디어로 새 프로젝트 시작</span>
                  </h4>
                  <p className="text-xs leading-relaxed text-gray-300 print:text-gray-700">
                    로비에서 <b>[+ 빈 프로젝트 생성]</b>을 누른 뒤, 좌측 <b>[프로젝트]</b> 탭에서 원하는 이야기 키워드(예: <i>사이버펑크 탐정, 마법 학원 일상</i>)를 입력하면 AI가 전체 시나리오를 자동 생성합니다.
                  </p>
                </div>
              </div>

              {/* 4단계 워크플로우 다이어그램 */}
              <div className="p-4 bg-gray-950/60 rounded-xl border border-gray-800 text-xs space-y-3 print:bg-gray-100 print:border-gray-300">
                <div className="font-bold text-gray-400 uppercase tracking-wider text-[11px]">전체 제작 흐름 (Workflow)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 bg-indigo-900/30 rounded-lg border border-indigo-500/30 print:bg-white">
                    <div className="font-black text-indigo-300 print:text-indigo-900">1. 스토리 기획</div>
                    <div className="text-[11px] text-gray-400 mt-1">테마 입력 후 기승전결 릴레이 집필</div>
                  </div>
                  <div className="p-2.5 bg-purple-900/30 rounded-lg border border-purple-500/30 print:bg-white">
                    <div className="font-black text-purple-300 print:text-purple-900">2. 캐릭터 & 표정</div>
                    <div className="text-[11px] text-gray-400 mt-1">중립 기준 고정 5종 표정 일괄 생성</div>
                  </div>
                  <div className="p-2.5 bg-blue-900/30 rounded-lg border border-blue-500/30 print:bg-white">
                    <div className="font-black text-blue-300 print:text-blue-900">3. 씬 & 선택지 연출</div>
                    <div className="text-[11px] text-gray-400 mt-1">배경/대사 AI 보강 및 분기 연결</div>
                  </div>
                  <div className="p-2.5 bg-emerald-900/30 rounded-lg border border-emerald-500/30 print:bg-white">
                    <div className="font-black text-emerald-300 print:text-emerald-900">4. 플레이 & 배포</div>
                    <div className="text-[11px] text-gray-400 mt-1">PLAY 테스트 후 HTML/웹앱 출력</div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section 2: 12대 장르 & 스토리 카드 마법사 */}
          {(activeTab === 'all' || activeTab === 'genre') && (
            <section className="space-y-4 page-break-inside-avoid">
              <div className="flex items-center gap-2 border-b border-gray-800 pb-2 print:border-gray-300">
                <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-black print:text-indigo-800">
                  STEP 02
                </span>
                <h3 className="text-lg md:text-xl font-black text-white print:text-gray-900">
                  🎨 VNA 스토리플로우: 12대 장르 선택 & 3대 AI 스토리 기획 카드 마법사
                </h3>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-gray-300 print:text-gray-700">
                <p>
                  어떤 이야기를 써야 할지 고민되시나요? <b>VNA 스토리플로우 라이트(Low-input narrative authoring)</b>는 장르와 키워드 선택만으로 매력적인 3개의 시놉시스 카드를 기획해 줍니다.
                </p>

                <div className="p-4 bg-indigo-950/40 rounded-xl border border-indigo-500/30 print:bg-gray-50 print:border-gray-300 space-y-2">
                  <h4 className="font-black text-sm text-indigo-300 print:text-indigo-900">✨ 3단계 원클릭 스토리 기획 프로세스</h4>
                  <ol className="list-decimal list-inside space-y-1 text-gray-300 print:text-gray-700">
                    <li><b>12가지 비주얼 장르</b> 중 원하는 분위기 카드를 탭합니다.</li>
                    <li>원할 경우 <b>아이디어 키워드</b>를 적거나 우측 <b>랜덤 셔플(🔄)</b> 아이콘을 눌러 영감을 얻습니다.</li>
                    <li><b>[3. 스토리 카드 3개 생성]</b>을 누른 뒤, 마음에 드는 기획 카드를 탭하면 <b>즉시 게임 빌딩이 자동 시작</b>됩니다!</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-bold text-xs text-white print:text-gray-900 mb-2">📚 12대 비주얼 장르 라이브러리</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {[
                      { name: '판타지 (F)', sub: '마법, 왕국, 고대 유물' },
                      { name: '사이버펑크 (C)', sub: '네온 도시, AI, 거대 기업' },
                      { name: '미스터리 (?)', sub: '밀실, 단서 추적, 진실' },
                      { name: '호러 (!)', sub: '폐가, 심령 공포, 생존' },
                      { name: '로맨스 (R)', sub: '운명적 만남, 감정선' },
                      { name: '아포칼립스 (A)', sub: '문명 붕괴, 폐허와 생존' },
                      { name: '현대 일상 (M)', sub: '일상 속 숨은 전환점' },
                      { name: '스릴러 (T)', sub: '추격, 서스펜스, 반전' },
                      { name: '학교 (S)', sub: '캠퍼스 전설, 동아리 비밀' },
                      { name: '전쟁 (W)', sub: '전장의 포화, 충성과 고뇌' },
                      { name: '모험 (V)', sub: '미지 탐험, 보물선 여정' },
                      { name: 'SF (SF)', sub: '우주 정거장, 타임 패러독스' },
                    ].map(g => (
                      <div key={g.name} className="p-2 bg-gray-800/60 rounded-lg border border-gray-700/80 print:bg-gray-50 print:border-gray-200">
                        <div className="font-bold text-indigo-300 print:text-indigo-900 text-[11px]">{g.name}</div>
                        <div className="text-[11px] text-gray-400 print:text-gray-600 truncate">{g.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-gray-800/80 rounded-xl border border-gray-700 print:bg-gray-50 print:border-gray-300">
                    <div className="font-bold text-emerald-300 print:text-emerald-900 mb-1">🎲 아이디어 셔플러 (주사위 버튼)</div>
                    <p className="text-[11px] text-gray-400 print:text-gray-700">
                      "조선 악녀", "폐허가 된 네오 성균관", "타임슬립 해커", "기억 포맷 로봇 점원" 등 검증된 흥미진진한 키워드 풀이 무작위로 자동 조합되어 창작의 영감을 자극합니다.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-800/80 rounded-xl border border-gray-700 print:bg-gray-50 print:border-gray-300">
                    <div className="font-bold text-cyan-300 print:text-cyan-900 mb-1">📋 3장의 스토리 기획 카드 구성요소</div>
                    <p className="text-[11px] text-gray-400 print:text-gray-700">
                      각 카드에는 <b>시선을 끄는 제목</b>, 3개의 <b>무드 태그(#네온 블루, #복수극)</b>, 주인공의 딜레마를 담은 <b>줄거리 요약</b>이 들어 있어 마음에 드는 1장을 누르면 바로 게임이 기획됩니다.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section 3: AI 스토리 생성 */}
          {(activeTab === 'all' || activeTab === 'story') && (
            <section className="space-y-4 page-break-inside-avoid">
              <div className="flex items-center gap-2 border-b border-gray-800 pb-2 print:border-gray-300">
                <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-black print:text-indigo-800">
                  STEP 03
                </span>
                <h3 className="text-lg md:text-xl font-black text-white print:text-gray-900">
                  🤖 AI 스토리 자동 생성 & 기승전결(起承轉結) 릴레이 집필
                </h3>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-gray-300 print:text-gray-700">
                <p>
                  스토리 카드를 선택하면 AI가 <b>실제 플레이 가능한 다중 분기 시나리오</b>(장면, 캐릭터 3인, 대사, 선택지, 배경 프롬프트)를 단번에 완성합니다.
                </p>

                <div className="bg-gray-850 p-4 rounded-xl border border-gray-700 space-y-3 print:bg-gray-50 print:border-gray-300">
                  <h4 className="font-black text-sm text-indigo-300 print:text-indigo-900">💡 좋은 테마 프롬프트 작성 공식</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 print:text-gray-700">
                    <li><b>[장르] + [주인공의 직업/목적] + [핵심 갈등 또는 배경]</b> 형식으로 적어보세요.</li>
                    <li><i>예시: "2088년 네오 서울, 비밀 기억 추출 장치를 도난당한 사이버 사이코 탐정과 안드로이드 조수"</i></li>
                    <li><i>예시: "황실 아카데미의 낙제 마법사지만 고대 드래곤과 영혼이 계약된 소년의 성장기"</i></li>
                  </ul>
                </div>

                <div className="p-4 bg-purple-950/30 rounded-xl border border-purple-500/30 print:bg-gray-50 print:border-gray-300">
                  <h4 className="font-black text-sm text-purple-300 print:text-purple-900 mb-1">🔥 릴레이(Relay) 단계별 심층 집필 모드</h4>
                  <p className="text-xs text-gray-300 print:text-gray-700">
                    테마 입력 창 아래의 <b>[릴레이 단계별 생성]</b>을 누르면, AI가 <b>기(도입) → 승(전개) → 전(위기/절정) → 결(엔딩)</b>을 거치며 각 단계마다 사용자의 선택과 지시를 질문합니다. 추천 선택지를 누르거나 원하는 전개를 직접 입력하여 작가와 AI가 함께 소설을 집필하듯 방대한 분기 스토리를 완성할 수 있습니다.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Section 4: 캐릭터 & 표정 (핵심 해결책 강조) */}
          {(activeTab === 'all' || activeTab === 'character') && (
            <section className="space-y-4 page-break-inside-avoid">
              <div className="flex items-center gap-2 border-b border-gray-800 pb-2 print:border-gray-300">
                <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-black print:text-indigo-800">
                  STEP 04
                </span>
                <h3 className="text-lg md:text-xl font-black text-white print:text-gray-900">
                  👤 캐릭터 생성 & 5종 표정 일괄 생성 (중립 고정 비법)
                </h3>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-gray-300 print:text-gray-700">
                <div className="p-4 bg-emerald-950/40 rounded-xl border border-emerald-500/40 print:bg-emerald-50 print:border-emerald-300">
                  <h4 className="font-black text-sm text-emerald-300 print:text-emerald-900 mb-1.5">
                    ✨ 캐릭터 얼굴이 바뀌지 않는 "중립 기준 고정" 파이프라인
                  </h4>
                  <p className="text-xs text-gray-200 print:text-gray-800 leading-relaxed">
                    다른 도구들과 달리, 본 스튜디오는 <b>'중립' 기본 스프라이트를 기준 앵커(Reference Image)로 고정</b>한 뒤 멀티모달 이미지 파이프라인을 통해 같은 인물의 외모·헤어스타일·의상·화풍을 100% 보존하면서 <b>오직 표정만 변환</b>합니다.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-gray-800/80 rounded-xl border border-gray-700 print:bg-gray-50 print:border-gray-300">
                    <div className="font-bold text-indigo-300 print:text-indigo-900 mb-1">1. [AI로 5종 표정 일괄 생성] 버튼</div>
                    <p className="text-[11px] text-gray-400 print:text-gray-700">
                      중립 이미지가 있으면 그 이미지를 기준으로 <b>행복, 슬픔, 화남, 놀람</b>의 4종 표정을 한 번에 일괄 생성합니다. 중립 이미지가 없어도 자동으로 기본 모델을 먼저 생성한 뒤 순차 진행됩니다.
                    </p>
                  </div>
                  <div className="p-3.5 bg-gray-800/80 rounded-xl border border-gray-700 print:bg-gray-50 print:border-gray-300">
                    <div className="font-bold text-indigo-300 print:text-indigo-900 mb-1">2. 개별 표정 탭 AI 생성 버튼 (✨)</div>
                    <p className="text-[11px] text-gray-400 print:text-gray-700">
                      특정 표정(예: '화남')만 마음에 들지 않거나 비어 있다면, 해당 표정 탭을 클릭하고 우측 상단의 <b>[✨ AI 표정 생성]</b> 버튼을 누르면 중립 캐릭터를 토대로 그 표정만 다시 생성합니다.
                    </p>
                  </div>
                  <div className="p-3.5 bg-gray-800/80 rounded-xl border border-gray-700 print:bg-gray-50 print:border-gray-300">
                    <div className="font-bold text-indigo-300 print:text-indigo-900 mb-1">3. [캐릭터 새로 재생성] 버튼</div>
                    <p className="text-[11px] text-gray-400 print:text-gray-700">
                      캐릭터의 컨셉이나 의상 프롬프트를 수정한 뒤 완전히 새로운 인물로 다시 뽑고 싶을 때 사용합니다. 중립 스프라이트가 새로 생성되며 이전 표정 슬롯이 깨끗이 리셋됩니다.
                    </p>
                  </div>
                  <div className="p-3.5 bg-gray-800/80 rounded-xl border border-gray-700 print:bg-gray-50 print:border-gray-300">
                    <div className="font-bold text-indigo-300 print:text-indigo-900 mb-1">4. 배경 자동 제거 (Chroma Key)</div>
                    <p className="text-[11px] text-gray-400 print:text-gray-700">
                      생성된 스프라이트는 브라우저 내 픽셀 크로마키 알고리즘을 통해 단색 배경이 자동으로 투명화되어 게임 화면에 자연스럽게 겹쳐집니다. 필요 시 마술봉(🪄) 버튼으로 수동 재처리도 가능합니다.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section 5: 장면 & 대사 연출 */}
          {(activeTab === 'all' || activeTab === 'scene') && (
            <section className="space-y-4 page-break-inside-avoid">
              <div className="flex items-center gap-2 border-b border-gray-800 pb-2 print:border-gray-300">
                <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-black print:text-indigo-800">
                  STEP 05
                </span>
                <h3 className="text-lg md:text-xl font-black text-white print:text-gray-900">
                  🎬 장면(Scene) 및 대사·선택지 분기 연출
                </h3>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-gray-300 print:text-gray-700">
                <p>
                  가운데 화면의 <b>[흐름도(Flowchart)]</b> 또는 우측 <b>[장면 편집기(Scene Editor)]</b>에서 원하는 장면을 클릭하면 세부 내용을 수정할 수 있습니다.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-gray-800/60 rounded-xl border border-gray-700 print:bg-gray-50 print:border-gray-300">
                    <div className="font-black text-indigo-300 print:text-indigo-900 mb-1">🖼️ 배경 이미지 연출</div>
                    <p className="text-[11px] text-gray-400 print:text-gray-700">
                      장면의 분위기를 설명하는 프롬프트를 적고 <b>[AI 배경 생성]</b>을 누르면 고화질 일러스트가 생성됩니다. 직접 이미지 URL을 입력하거나 고화질 무료 프리셋으로 교체할 수도 있습니다.
                    </p>
                  </div>
                  <div className="p-3.5 bg-gray-800/60 rounded-xl border border-gray-700 print:bg-gray-50 print:border-gray-300">
                    <div className="font-black text-indigo-300 print:text-indigo-900 mb-1">💬 대사 및 감정 매핑</div>
                    <p className="text-[11px] text-gray-400 print:text-gray-700">
                      화자(말하는 사람)와 감정 표정을 지정하면 대사가 나올 때 해당 캐릭터의 표정 스프라이트가 화면에 자동으로 표시됩니다. <b>[AI 대사 자동 생성]</b>을 누르면 장면에 어울리는 대화문이 자동 작성됩니다.
                    </p>
                  </div>
                  <div className="p-3.5 bg-gray-800/60 rounded-xl border border-gray-700 print:bg-gray-50 print:border-gray-300">
                    <div className="font-black text-indigo-300 print:text-indigo-900 mb-1">🔀 선택지(Branch) 연결</div>
                    <p className="text-[11px] text-gray-400 print:text-gray-700">
                      장면 하단의 <b>[+ 선택지 추가]</b>를 눌러 버튼 텍스트를 적고 이동할 <b>다음 장면(Next Scene)</b>을 지정하세요. 플레이어의 선택에 따라 이야기가 다른 결말로 이어집니다.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section 6: 게임 출시 & 내보내기 */}
          {(activeTab === 'all' || activeTab === 'export') && (
            <section className="space-y-4 page-break-inside-avoid">
              <div className="flex items-center gap-2 border-b border-gray-800 pb-2 print:border-gray-300">
                <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-black print:text-indigo-800">
                  STEP 06
                </span>
                <h3 className="text-lg md:text-xl font-black text-white print:text-gray-900">
                  🎮 실시간 플레이 테스트 & 게임 출시(Export)
                </h3>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-gray-300 print:text-gray-700">
                <p>
                  제작 중 언제라도 상단 우측의 <b>[▶ PLAY]</b> 버튼을 누르면 실제 게임 실행 화면으로 전환되어 대사 타이핑 효과, 선택지 인터랙션, 배경음악 등을 직접 체험할 수 있습니다. (키보드 <code>ESC</code>를 누르면 편집기로 즉시 복귀)
                </p>

                <div className="p-4 bg-gray-850 rounded-xl border border-gray-700 space-y-3 print:bg-gray-50 print:border-gray-300">
                  <h4 className="font-black text-sm text-indigo-300 print:text-indigo-900">📦 상단 [게임 출시] 메뉴의 3가지 내보내기 방식</h4>
                  
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[11px] font-bold mt-0.5 print:bg-orange-100 print:text-orange-800">단일 HTML</span>
                      <p className="text-gray-300 print:text-gray-700 text-xs">
                        모든 이미지와 음향, 엔진 코드가 <b>딱 1개의 HTML 파일</b>로 압축 패키징됩니다. 별도 설치 없이 카카오톡이나 이메일로 친구에게 파일만 전송해도 브라우저에서 바로 게임이 플레이됩니다!
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 rounded text-[11px] font-bold mt-0.5 print:bg-sky-100 print:text-sky-800">웹 패키지 ZIP</span>
                      <p className="text-gray-300 print:text-gray-700 text-xs">
                        Netlify, Vercel, GitHub Pages 또는 개인 호스팅 웹서버에 그대로 올려서 전 세계 누구나 웹 링크로 접속해 플레이할 수 있도록 정적 웹사이트 번들로 내보냅니다.
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-[11px] font-bold mt-0.5 print:bg-indigo-100 print:text-indigo-800">Ren'Py 스크립트</span>
                      <p className="text-gray-300 print:text-gray-700 text-xs">
                        스팀(Steam) 입점이나 PC/모바일 정식 앱 빌드를 위한 글로벌 비주얼 노벨 엔진인 <b>Ren'Py 문법(.rpy)</b> 파일로 완벽 변환하여 출력합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section 7: FAQ & 팁 */}
          {(activeTab === 'all' || activeTab === 'faq') && (
            <section className="space-y-4 page-break-inside-avoid">
              <div className="flex items-center gap-2 border-b border-gray-800 pb-2 print:border-gray-300">
                <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-black print:text-indigo-800">
                  STEP 07
                </span>
                <h3 className="text-lg md:text-xl font-black text-white print:text-gray-900">
                  💡 초보자 자주 묻는 질문 (FAQ) & 안전 백업
                </h3>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <div className="p-3.5 bg-gray-800/60 rounded-xl border border-gray-700 print:bg-gray-50 print:border-gray-200">
                  <div className="font-black text-indigo-300 print:text-indigo-900 mb-1">
                    Q. 캐릭터 표정을 만들 때 왜 '중립' 이미지가 가장 중요한가요?
                  </div>
                  <p className="text-gray-300 print:text-gray-700">
                    AI 모델이 얼굴 표정을 바꿀 때 중립 이미지를 원본 레퍼런스로 사용합니다. 따라서 중립 표정의 헤어스타일, 의상, 색감이 마음에 들게 나올 때까지 먼저 확정한 후 <b>[AI로 5종 표정 일괄 생성]</b>을 누르시면 가장 완성도 높은 일관성을 얻을 수 있습니다.
                  </p>
                </div>

                <div className="p-3.5 bg-gray-800/60 rounded-xl border border-gray-700 print:bg-gray-50 print:border-gray-200">
                  <div className="font-black text-indigo-300 print:text-indigo-900 mb-1">
                    Q. 작성한 프로젝트 데이터가 사라지지 않나요?
                  </div>
                  <p className="text-gray-300 print:text-gray-700">
                    작업 중인 모든 내용(캐릭터 이미지, 대사, 씬 연결 등)은 사용자의 웹 브라우저 내 <b>로컬 데이터베이스(IndexedDB / LocalStorage)</b>에 실시간 자동 보존됩니다. 브라우저를 껐다 켜도 [로비] 목록에 그대로 유지되며, 상단 <b>[JSON 저장/불러오기]</b> 버튼으로 백업 파일을 영구 보관할 수도 있습니다.
                  </p>
                </div>

                <div className="p-3.5 bg-gray-800/60 rounded-xl border border-gray-700 print:bg-gray-50 print:border-gray-200">
                  <div className="font-black text-indigo-300 print:text-indigo-900 mb-1">
                    Q. 게임을 한 편의 소설로 읽어보고 싶어요.
                  </div>
                  <p className="text-gray-300 print:text-gray-700">
                    좌측 <b>[프로젝트]</b> 탭 하단의 <b>[📖 AI 소설 컴파일러]</b> 버튼을 누르면, 지금까지 만든 게임의 모든 장면과 대사를 바탕으로 전문 소설가가 집필한 듯한 줄글 단편 소설로 자동 재구성해 줍니다.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Footer Metadata */}
          <div className="pt-4 border-t border-gray-800 text-[11px] text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-2 print:border-gray-300 print:text-gray-600">
            <span>VN-AI Studio • Visual Novel Game Engine & AI Orchestration System</span>
            <span>Created by TAEWAN-KIM • Ready for Distribution & Print</span>
          </div>

        </div>
      </div>
    </div>
  );
};
