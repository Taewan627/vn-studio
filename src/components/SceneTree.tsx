import { useLanguage } from '../i18n/LanguageProvider';
import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { VisualNovel, Scene, StoryStage, VisualNovelActions } from '../types';
import { PlayIcon, PlusIcon, RouteIcon, TrashIcon, UserIcon, PhotoIcon, CopyIcon } from './icons';

interface SceneTreeProps { 
    vn: VisualNovel; 
    selectedSceneId: string | null; 
    onSelectScene: (id: string) => void;
    onPlayFromScene: (id: string) => void;
    actions: VisualNovelActions;
}

const STAGES: { id: StoryStage; label: string; subLabel: string; color: string; hoverColor: string; bgColor: string; borderColor: string; accentColor: string }[] = [
  { 
    id: 'ki', 
    label: '기 (起) • 도입', 
    subLabel: 'ACT 1: START GATEWAY',
    color: 'text-gray-300', 
    hoverColor: 'hover:text-white',
    bgColor: 'bg-gray-800/40', 
    borderColor: 'border-gray-700',
    accentColor: 'emerald'
  },
  { 
    id: 'seung', 
    label: '승 (承) • 전개', 
    subLabel: 'ACT 2: PROGRESSION',
    color: 'text-gray-300', 
    hoverColor: 'hover:text-white',
    bgColor: 'bg-gray-800/40', 
    borderColor: 'border-gray-700',
    accentColor: 'blue'
  },
  { 
    id: 'jeon', 
    label: '전 (轉) • 위기', 
    subLabel: 'ACT 3: CLIMAX & CONFLICT',
    color: 'text-gray-300', 
    hoverColor: 'hover:text-white',
    bgColor: 'bg-gray-800/40', 
    borderColor: 'border-gray-700',
    accentColor: 'amber'
  },
  { 
    id: 'gyeol', 
    label: '결 (結) • 결말', 
    subLabel: 'ACT 4: RESOLUTION',
    color: 'text-gray-300', 
    hoverColor: 'hover:text-white',
    bgColor: 'bg-gray-800/40', 
    borderColor: 'border-gray-700',
    accentColor: 'rose'
  },
];

interface ConnectionPath {
  d: string;
  isHighlighted: boolean;
  fromSceneId: string;
  toSceneId: string;
  choiceIndex: number;
}

export const SceneTree: React.FC<SceneTreeProps> = ({ vn, selectedSceneId, onSelectScene, onPlayFromScene, actions }) => {
  const { t, language } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // 뷰 모드: 'graph' (노드 흐름도) | 'list' (리스트 아웃라인)
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('list');
  
  // ComfyUI 풍 줌 & 팬 상태
  const [zoom, setZoom] = useState<number>(0.85); // 적합하게 전체가 잘 보이게 0.85 기본값
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 30 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // ComfyUI 풍 노드 드래그 좌표 정보
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const saved = localStorage.getItem('vna_node_positions_map');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse node positions', e);
    }
    return {};
  });
  
  const [activeDragNodeId, setActiveDragNodeId] = useState<string | null>(null);
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0, nodeX: 0, nodeY: 0 });

  // 🔌 노드 연결선 실시간 조작 드래깅 상태
  const [draggingWire, setDraggingWire] = useState<{
    fromSceneId: string;
    choiceIndex: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // SVG 연결선 좌표 상태
  const [connections, setConnections] = useState<ConnectionPath[]>([]);
  const [hoveredSceneId, setHoveredSceneId] = useState<string | null>(null);

  // 캔버스 내 마우스의 정확한 줌/팬 역산 좌표 헬퍼
  const getCanvasCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom
    };
  };

  // 로컬 스토리지 데이터 저장
  useEffect(() => {
    if (Object.keys(nodePositions).length > 0) {
      try {
        localStorage.setItem('vna_node_positions_map', JSON.stringify(nodePositions));
      } catch (e) {
        console.warn('Failed to save node positions', e);
      }
    }
  }, [nodePositions]);

  // 새로운 노드가 들어왔을 때, 기본 자동 정렬 좌표 배치 설정
  useEffect(() => {
    let changed = false;
    const next = { ...nodePositions };
    const stageCounts: Record<string, number> = {};

    vn.scenes.forEach(scene => {
      const stage = scene.stage || 'ki';
      if (!stageCounts[stage]) stageCounts[stage] = 0;

      if (!next[scene.id]) {
        const stageIdx = STAGES.findIndex(s => s.id === stage);
        const col = stageIdx !== -1 ? stageIdx : 0;
        const row = stageCounts[stage];

        // Swimlane 디자인에 정확히 알맞은 정렬 좌표
        // 65px left-offset centered on 360px swimlane
        next[scene.id] = {
          x: 65 + col * 400,
          y: 160 + row * 380
        };
        changed = true;
      }
      stageCounts[stage]++;
    });

    if (changed) {
      setNodePositions(next);
    }
  }, [vn.scenes]);

  // 새 장면 추가
  const handleAddSceneToStage = (stage: StoryStage) => {
    const newId = `scene_${stage}_${Date.now()}`;
    
    // 계산된 위치에 새 노드 좌표를 즉각 선할당 (애니메이션 튐 방지)
    const stageScenes = vn.scenes.filter(s => {
      if (stage === 'ki') {
        return s.stage === 'ki' || !['ki', 'seung', 'jeon', 'gyeol'].includes(s.stage);
      }
      return s.stage === stage;
    });
    
    const stageIdx = STAGES.findIndex(s => s.id === stage);
    const col = stageIdx !== -1 ? stageIdx : 0;
    const row = stageScenes.length;
    
    const newX = 65 + col * 400;
    const newY = 160 + row * 380;
    
    setNodePositions(prev => ({
      ...prev,
      [newId]: { x: newX, y: newY }
    }));

    actions.addScene(newId, stage);
    onSelectScene(newId);
  };

  // 마우스 이동/드래그 팬 처리 (빈 공간 드래그 시)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    
    const target = e.target as HTMLElement;
    // 인터랙티브 제어 요소는 배경 드래그 팬을 동작시키지 않음
    if (
      target.closest('.interactive-clickable') || 
      target.closest('button') || 
      target.closest('select') || 
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('.interactive-node-card')
    ) {
      return;
    }
    
    setIsPanning(true);
    setPanStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    });
  };

  // 개별 노드 카드 드래그 개시
  const handleNodeMouseDown = (e: React.MouseEvent, sceneId: string) => {
    const target = e.target as HTMLElement;
    
    // 이펙트 포트, 버튼, 텍스트 상자 등을 누른 경우엔 드래그 시작하지 않음
    if (
      target.closest('button') || 
      target.closest('a') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea') ||
      target.closest('[id^="port-"]')
    ) {
      return;
    }

    if (e.button !== 0) return; // 왼쪽 단추 드래그만 지원
    e.stopPropagation(); // 캔버스 드래그로 흘러가지 않도록 방지

    // 현재 Scene 선택
    onSelectScene(sceneId);

    const pos = nodePositions[sceneId] || { x: 100, y: 100 };
    setActiveDragNodeId(sceneId);
    setDragStartOffset({
      x: e.clientX,
      y: e.clientY,
      nodeX: pos.x,
      nodeY: pos.y
    });
  };

  // 🔌 우측 출력 소켓 포트 드래그 시작 핸들러
  const handleOutPortMouseDown = (e: React.MouseEvent, sceneId: string, choiceIdx: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const portEl = e.currentTarget as HTMLElement;
    const portRect = portEl.getBoundingClientRect();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();

    // 캔버스 내 줌 스케일링이 조율된 포트 중심 점의 절대 좌표 계산
    const startX = (portRect.left + portRect.width / 2 - canvasRect.left) / zoom;
    const startY = (portRect.top + portRect.height / 2 - canvasRect.top) / zoom;

    setDraggingWire({
      fromSceneId: sceneId,
      choiceIndex: choiceIdx,
      startX,
      startY,
      currentX: startX,
      currentY: startY
    });
  };

  // 🔌 좌측 입력 소켓 포트 드래그 시작 핸들러 (연결되어 있던 선 뽑기 기능)
  const handleInPortMouseDown = (e: React.MouseEvent, sceneId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    // 현재 선택한 씬으로 들어오고 있었던 기존 다른 씬의 최신 선(choice)을 수소문하여 찾아냄
    let incomingSceneId = '';
    let incomingChoiceIdx = -1;

    for (const s of vn.scenes) {
      const idx = s.choices.findIndex(c => c.nextSceneId === sceneId);
      if (idx !== -1) {
        incomingSceneId = s.id;
        incomingChoiceIdx = idx;
        break; // 첫 번째 찾은 것을 떼어내기로 결정
      }
    }

    // 선을 뽁! 해제하고 드래깅으로 즉각 계승함
    if (incomingSceneId !== '') {
      actions.updateChoice(incomingSceneId, incomingChoiceIdx, 'nextSceneId', '');

      const portId = `port-out-${incomingSceneId}-${incomingChoiceIdx}`;
      const portEl = document.getElementById(portId);
      const canvas = canvasRef.current;
      if (portEl && canvas) {
        const portRect = portEl.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        const startX = (portRect.left + portRect.width / 2 - canvasRect.left) / zoom;
        const startY = (portRect.top + portRect.height / 2 - canvasRect.top) / zoom;

        const mouseCoords = getCanvasCoords(e);

        setDraggingWire({
          fromSceneId: incomingSceneId,
          choiceIndex: incomingChoiceIdx,
          startX,
          startY,
          currentX: mouseCoords.x,
          currentY: mouseCoords.y
        });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (activeDragNodeId) {
      // ✨ 줌 배율이 적용된 정밀 마우스 이동 스케일링 보정
      const dx = (e.clientX - dragStartOffset.x) / zoom;
      const dy = (e.clientY - dragStartOffset.y) / zoom;
      
      setNodePositions(prev => ({
        ...prev,
        [activeDragNodeId]: {
          x: Math.max(10, dragStartOffset.nodeX + dx),
          y: Math.max(10, dragStartOffset.nodeY + dy)
        }
      }));
    } else if (draggingWire) {
      // 🔌 와이어 연출 선 캔버스 마우스 가이드 갱신
      const coords = getCanvasCoords(e);
      setDraggingWire(prev => prev ? {
        ...prev,
        currentX: coords.x,
        currentY: coords.y
      } : null);
    }
  };

  const handleMouseUpOrLeave = (e: React.MouseEvent) => {
    setIsPanning(false);
    setActiveDragNodeId(null);

    // 🔌 와이어 조작 마무리기
    if (draggingWire) {
      let bestTargetSceneId: string | null = null;
      let minDistance = 100; // 자석 스냅 자성 흡인 범위 (px)

      vn.scenes.forEach(scene => {
        // 자기 자신으로의 무한 연결은 방어코드 차원에서 배제
        if (scene.id === draggingWire.fromSceneId) return;

        // 정확한 입력 소켓 구하기 (DOM 측정)
        const portEl = document.getElementById(`port-in-${scene.id}`);
        let inX = 0;
        let inY = 0;

        if (portEl && canvasRef.current) {
          const portRect = portEl.getBoundingClientRect();
          const canvasRect = canvasRef.current.getBoundingClientRect();
          inX = (portRect.left + portRect.width / 2 - canvasRect.left) / zoom;
          inY = (portRect.top + portRect.height / 2 - canvasRect.top) / zoom;
        } else {
          // 폴백용 정적 값
          const pos = nodePositions[scene.id] || { x: 100, y: 100 };
          inX = pos.x;
          inY = pos.y + 115;
        }

        const dx = draggingWire.currentX - inX;
        const dy = draggingWire.currentY - inY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
          bestTargetSceneId = scene.id;
        }
      });

      const sourceScene = vn.scenes.find(s => s.id === draggingWire.fromSceneId);

      if (bestTargetSceneId) {
        // 성공적 타겟 입력 소켓 연결 성립!
        if (sourceScene) {
          if (sourceScene.choices.length > 0) {
            // 선택지가 원래 있었을 때
            actions.updateChoice(draggingWire.fromSceneId, draggingWire.choiceIndex, 'nextSceneId', bestTargetSceneId);
          } else {
            // 선택지가 아예 없던 직결 No Choice 씬일 때: 편의상 choices 1개 자동 생성하며 다이렉트 이식
            actions.addChoice(draggingWire.fromSceneId, bestTargetSceneId);
          }
        }
      } else {
        // 먼 대지에 떨어뜨렸으면 -> 기존 연결을 아주 확실하게 떼어내서 삭제 처리
        if (sourceScene && sourceScene.choices.length > 0) {
          actions.updateChoice(draggingWire.fromSceneId, draggingWire.choiceIndex, 'nextSceneId', '');
        }
      }

      setDraggingWire(null);
    }
  };

  // 마우스 커서 위치 기준 피벗 줌 (ComfyUI 타입)
  const handleWheel = (e: React.WheelEvent) => {
    if (viewMode !== 'graph') return;
    
    const target = e.target as HTMLElement;
    if (target.closest('textarea') || target.closest('select') || target.closest('input')) {
      return;
    }

    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const localX = (mouseX - pan.x) / zoom;
    const localY = (mouseY - pan.y) / zoom;

    const scaleFactor = 1.15;
    let nextZoom = zoom;

    if (e.deltaY < 0) {
      nextZoom = Math.min(2.5, zoom * scaleFactor);
    } else {
      nextZoom = Math.max(0.15, zoom / scaleFactor);
    }

    const nextPanX = mouseX - localX * nextZoom;
    const nextPanY = mouseY - localY * nextZoom;

    setZoom(nextZoom);
    setPan({ x: nextPanX, y: nextPanY });
  };

  // 줌인 / 줌아웃 가젯 핸들러
  const handleZoomIn = () => {
    setZoom(z => Math.min(2.5, z * 1.25));
  };

  const handleZoomOut = () => {
    setZoom(z => Math.max(0.15, z / 1.25));
  };

  const handleZoomReset = () => {
    setZoom(0.85);
    setPan({ x: 40, y: 30 });
  };

  // SVG 연결선 계산 (ComfyUI-Style 줌 역산 탑재)
  const recalculateWires = () => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || viewMode !== 'graph') return;

    const canvasRect = canvas.getBoundingClientRect(); 
    const newConnections: ConnectionPath[] = [];

    vn.scenes.forEach(scene => {
      scene.choices.forEach((choice, choiceIdx) => {
        if (!choice.nextSceneId) return;

        const outputPin = document.getElementById(`port-out-${scene.id}-${choiceIdx}`);
        const inputPin = document.getElementById(`port-in-${choice.nextSceneId}`);

        if (outputPin && inputPin) {
          const outRect = outputPin.getBoundingClientRect();
          const inRect = inputPin.getBoundingClientRect();

          const x1 = (outRect.left + outRect.width / 2 - canvasRect.left) / zoom;
          const y1 = (outRect.top + outRect.height / 2 - canvasRect.top) / zoom;

          const x2 = (inRect.left + inRect.width / 2 - canvasRect.left) / zoom;
          const y2 = (inRect.top + inRect.height / 2 - canvasRect.top) / zoom;

          const dx = Math.abs(x2 - x1);
          const controlOffset = Math.max(75, dx * 0.45);
          
          const d = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;

          const isHighlighted = 
            scene.id === selectedSceneId || 
            choice.nextSceneId === selectedSceneId ||
            scene.id === hoveredSceneId ||
            choice.nextSceneId === hoveredSceneId;

          newConnections.push({
            d,
            isHighlighted,
            fromSceneId: scene.id,
            toSceneId: choice.nextSceneId,
            choiceIndex: choiceIdx
          });
        }
      });
    });

    setConnections(newConnections);
  };

  // 렌더링, 노드 이동, 줌 레벨 변동 등의 생명주기 이벤트 시 선 위치 최신화
  useLayoutEffect(() => {
    recalculateWires();
    
    const timer = setTimeout(recalculateWires, 50);
    return () => clearTimeout(timer);
  }, [vn, selectedSceneId, viewMode, hoveredSceneId, zoom, pan, nodePositions, language]);

  // 창 크기 변경 감지 시 재정밀 정렬
  useEffect(() => {
    window.addEventListener('resize', recalculateWires);
    return () => window.removeEventListener('resize', recalculateWires);
  }, [viewMode, zoom]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* 상단 탭 및 조작바 */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-950 z-30">
        <div className="flex items-center gap-1.5 bg-gray-850 p-1 rounded-lg border border-gray-800">
          <button
            onClick={() => setViewMode('graph')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-black tracking-wider uppercase transition-all ${viewMode === 'graph' ? 'bg-indigo-600/90 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
          >
            <RouteIcon className="w-3.5 h-3.5" />{t("노드 흐름도")}</button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-black tracking-wider uppercase transition-all ${viewMode === 'list' ? 'bg-indigo-600/90 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
          >
            <span className="font-mono text-center w-3 font-bold">Ξ</span>{t("목록 개요")}</button>
        </div>
        
        {viewMode === 'graph' ? (
          <div className="flex items-center gap-3">
            <div className="text-[11px] font-mono font-bold text-gray-400 bg-gray-950 px-2 py-0.5 rounded-md border border-gray-800">
              {Math.round(zoom * 100)}%
            </div>
            
            <div className="hidden lg:flex text-[11px] text-gray-400 font-medium select-none items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{t("시작점")}</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>{t("다음장면")}</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>{t("분기선택")}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-400"></span>{t("선택됨")}</span>
              <span className="text-yellow-400 font-bold pl-2 bg-indigo-950/40 px-2.5 py-1.5 rounded border border-indigo-900/50">{t("🔌 마우스로 소켓 선을 떼고 끌어서 다른 곳에 자유롭게 드롭하세요! (자석식 스냅 스틱 지원) | 빈 공간 드롭 시 연결 삭제")}</span>
            </div>
          </div>
        ) : null}
      </div>

      {viewMode === 'list' ? (
        /* 리스트 아웃라인 뷰 */
        <div className="flex-grow overflow-y-auto p-4 custom-scrollbar space-y-6 bg-gray-900">
          {STAGES.map((stageInfo) => {
            const stageScenes = vn.scenes.filter(s => {
              if (stageInfo.id === 'ki') {
                return s.stage === 'ki' || !['ki', 'seung', 'jeon', 'gyeol'].includes(s.stage);
              }
              return s.stage === stageInfo.id;
            });

            return (
              <div key={stageInfo.id} className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2 border-gray-800">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${stageInfo.color.replace('text', 'bg')}`}></div>
                    <span className={`text-[11px] font-black uppercase tracking-widest ${stageInfo.color}`}>{t(stageInfo.label)}</span>
                  </div>
                  <button 
                    onClick={() => handleAddSceneToStage(stageInfo.id)}
                    className="p-1 hover:bg-gray-800 rounded-md transition-all text-gray-500 hover:text-white flex items-center gap-1 text-[11px] uppercase font-bold"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />{t("추가")}</button>
                </div>

                <div className="flex flex-col gap-2 pl-3 border-l border-gray-800/80 ml-1">
                  {stageScenes.length > 0 ? stageScenes.map((scene) => {
                    const isSelected = scene.id === selectedSceneId;
                    const bgUrlName = scene.backgroundUrl && !scene.backgroundUrl.startsWith('data:') ? scene.backgroundUrl.substring(scene.backgroundUrl.lastIndexOf('/') + 1, scene.backgroundUrl.length).split('?')[0] || t('배경 지정') : t("기존 배경");

                    return (
                      <div 
                        key={scene.id}
                        onClick={() => onSelectScene(scene.id)}
                        className={`group p-3 rounded-xl border transition-all cursor-pointer relative ${
                          isSelected 
                            ? 'bg-indigo-950/45 border-yellow-400 shadow-[0_0_15px_rgba(200,241,53,0.2)]' 
                            : 'bg-gray-850/60 border-gray-800 hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              {scene.id === vn.startSceneId && (
                                <span className="text-[11px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase tracking-wider">START</span>
                              )}
                              <span className={`text-xs font-bold truncate ${isSelected ? 'text-yellow-400 font-black' : 'text-gray-200'}`}>
                                {scene.name}
                              </span>
                            </div>
                            
                            <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-1 font-mono">
                              <PhotoIcon className="w-3 h-3 text-gray-600" />
                              <span className="truncate max-w-[130px]">{bgUrlName}</span>
                            </div>
                          </div>
                          
                          <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onPlayFromScene(scene.id);
                            }}
                            className="bg-emerald-500/10 hover:bg-emerald-600 text-emerald-400 hover:text-white p-1 rounded-md transition-all border border-emerald-500/20 shadow"
                            title={t("여기부터 직접 플레이")}
                          >
                            <PlayIcon className="w-3 h-3" />
                          </button>
                        </div>
                        
                        {scene.choices.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-gray-800/40 space-y-1">
                            {scene.choices.map((c, idx) => {
                              const targetScene = vn.scenes.find(s => s.id === c.nextSceneId);
                              const isChoiceConnected = c.nextSceneId && vn.scenes.some(s => s.id === c.nextSceneId);
                              return (
                                <div 
                                  key={idx} 
                                  className={`text-[11px] flex items-center justify-between gap-2 px-2 py-1 rounded border transition-colors ${
                                    isChoiceConnected 
                                      ? 'text-gray-400 bg-gray-900/50 border-gray-800/20' 
                                      : 'text-red-400 bg-red-950/20 border-red-900/40 font-bold'
                                  }`}
                                >
                                  <span className="truncate min-w-0 flex-1 pr-2" title={c.text || ''}>⌥ {c.text || t('(선택지 없음)')}</span>
                                  <span className={`text-[11px] font-bold truncate shrink-0 max-w-[45%] text-right ${isChoiceConnected ? 'text-indigo-400' : 'text-red-400'}`}>
                                    {targetScene ? `➔ ${targetScene.name}` : t("⚠️ 미연결")}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div className="text-[11px] text-gray-600 italic py-3 pl-2">{t("아직 이 단계에 추가된 장면이 없습니다.")}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 무한 줌 & 팬 벡터 캔버스 */
        <div 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onWheel={handleWheel}
          className={`flex-grow overflow-hidden relative bg-[#07090d] select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.04) 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px'
          }}
        >
          {/* ✨ ComfyUI 줌 & 팬 레이어 wrapper ✨ */}
          <div
            ref={canvasRef}
            className="absolute origin-top-left select-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              width: '4500px',
              height: '3500px'
            }}
          >
            {/* 백그라운드 Swimlane 단계 구역 표시선 */}
            <div className="absolute inset-0 pointer-events-none flex gap-[40px] p-[40px] h-full z-0">
              {STAGES.map((stage) => {
                return (
                  <div 
                    key={stage.id} 
                    className="w-[360px] h-full border border-dashed border-gray-800/40 rounded-3xl bg-[#0b0f19]/30 flex flex-col items-center pt-8 flex-shrink-0 select-none pb-20"
                    style={{
                      height: '3400px' 
                    }}
                  >
                    {/* Swimlane Header */}
                    <div className="px-5 py-3 rounded-2xl bg-gray-950/80 border border-gray-850 backdrop-blur-sm shadow-md text-center max-w-[280px]">
                      <div className="flex items-center justify-center gap-2 mb-0.5">
                        <div className={`w-2 h-2 rounded-full ${stage.color.replace('text', 'bg')} animate-pulse`}></div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 font-mono">
                          {stage.subLabel}
                        </span>
                      </div>
                      <div className="text-xs font-black text-white font-sans">
                        {t(stage.label)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SVG 커넥터 와이어 레이어 (ViewportWrapper 내부에 속하므로 자동 줌과 드래그 처리됨!) */}
            <svg 
              className="absolute inset-0 pointer-events-none z-10 w-full h-full"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <filter id="glow-indigo" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glow-yellow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="5.0" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {connections.map((conn, idx) => {
                const isSelectedWire = conn.fromSceneId === selectedSceneId || conn.toSceneId === selectedSceneId;
                return (
                  <g key={`${conn.fromSceneId}-${conn.toSceneId}-${idx}`}>
                    {/* 발광 배경 강조선 */}
                    {conn.isHighlighted && (
                      <path
                        d={conn.d}
                        stroke={isSelectedWire ? '#C8F135' : '#3A4350'}
                        strokeWidth="7"
                        strokeOpacity="0.45"
                        fill="none"
                        filter={isSelectedWire ? 'url(#glow-yellow)' : 'url(#glow-indigo)'}
                      />
                    )}
                    
                    {/* 중심 실선 */}
                    <path
                      d={conn.d}
                      stroke={isSelectedWire ? '#fef08a' : conn.isHighlighted ? '#a5b4fc' : '#1b2230'}
                      strokeWidth={isSelectedWire ? '3.0' : conn.isHighlighted ? '2.5' : '1.8'}
                      strokeDasharray={conn.isHighlighted ? '0' : '4,3.5'}
                      fill="none"
                      className="transition-colors duration-200"
                    />

                    {/* 흐름 구슬 애니메이션 (ComfyUI 전용) */}
                    {conn.isHighlighted && (
                      <circle r="4.5" fill={isSelectedWire ? '#C8F135' : '#7A8596'}>
                        <animateMotion dur="2.2s" repeatCount="indefinite" path={conn.d} />
                      </circle>
                    )}
                  </g>
                );
              })}

              {/* 🔌 드래그 진행 중인 가이드 와이어 인터랙션 벡터 피드백 */}
              {draggingWire && (
                <g>
                  <path
                    d={`M ${draggingWire.startX} ${draggingWire.startY} C ${draggingWire.startX + Math.max(75, Math.abs(draggingWire.currentX - draggingWire.startX) * 0.45)} ${draggingWire.startY}, ${draggingWire.currentX - Math.max(75, Math.abs(draggingWire.currentX - draggingWire.startX) * 0.45)} ${draggingWire.currentY}, ${draggingWire.currentX} ${draggingWire.currentY}`}
                    stroke="#C8F135"
                    strokeWidth="3.5"
                    strokeDasharray="5,4"
                    fill="none"
                    className="animate-pulse"
                  />
                  <circle cx={draggingWire.currentX} cy={draggingWire.currentY} r="5.5" fill="#E1F98F" stroke="#C8F135" strokeWidth="2.5" className="animate-ping" />
                  <circle cx={draggingWire.currentX} cy={draggingWire.currentY} r="4.5" fill="#C8F135" />
                </g>
              )}
            </svg>

            {/* 노드 격자판 (절대 좌표 기반 렌더링) */}
            <div className="absolute inset-0 pointer-events-none z-20 w-full h-full">
              {vn.scenes.map((scene) => {
                const pos = nodePositions[scene.id] || { x: 100, y: 100 };
                const isSelected = scene.id === selectedSceneId;
                const hasChoices = scene.choices.length > 0;
                const isStartScene = scene.id === vn.startSceneId;
                const dialogueCount = scene.dialogue.length;
                
                const bgName = scene.backgroundUrl && !scene.backgroundUrl.startsWith('data:')
                  ? scene.backgroundUrl.substring(scene.backgroundUrl.lastIndexOf('/') + 1).split('?')[0] || t('배경')
                  : t("기존 공용 배경");
                const dialoguePreview = scene.dialogue[0];

                let nodeTypeBadge = "SCENE DRAFT";
                let headerBg = "bg-gray-900";
                
                // ✨ 선택되었을 경우 선명한 노란색 2px 아웃라인 테두리 & 고보정 그림자 부여!
                let cardAccentBorder = isSelected 
                  ? "border-yellow-400 border-2 shadow-[0_0_25px_rgba(234,179,8,0.45)] ring-2 ring-yellow-400/20" 
                  : "border border-gray-800 hover:border-gray-700/80";
                let indicatorColor = "bg-indigo-400";
                
                if (isStartScene) {
                  nodeTypeBadge = "START GATEWAY";
                  headerBg = "bg-emerald-950/20";
                  indicatorColor = "bg-emerald-500";
                } else if (hasChoices) {
                  nodeTypeBadge = "CHOICE STAGE";
                  headerBg = "bg-gray-800/40";
                  indicatorColor = "bg-gray-300";
                }

                return (
                  <div
                    key={scene.id}
                    id={`node-card-${scene.id}`}
                    onMouseEnter={() => setHoveredSceneId(scene.id)}
                    onMouseLeave={() => setHoveredSceneId(null)}
                    onDoubleClick={() => onPlayFromScene(scene.id)}
                    onClick={() => onSelectScene(scene.id)}
                    onMouseDown={(e) => handleNodeMouseDown(e, scene.id)}
                    className={`interactive-node-card absolute group bg-gray-950/95 backdrop-blur border rounded-xl flex flex-col overflow-hidden transition-shadow duration-200 cursor-grab active:cursor-grabbing pointer-events-auto ${cardAccentBorder}`}
                    style={{
                      left: `${pos.x}px`,
                      top: `${pos.y}px`,
                      width: '310px',
                      zIndex: isSelected ? 40 : activeDragNodeId === scene.id ? 35 : 20
                    }}
                  >
                    {/* 입력 소켓 (좌측) - 선택시 황금빛 보정 및 기존 연결선 뽑아내기 드래그 기능 추가 */}
                    <div 
                      id={`port-in-${scene.id}`}
                      onMouseDown={(e) => handleInPortMouseDown(e, scene.id)}
                      className={`absolute w-3.5 h-3.5 rounded-full -left-[7.5px] top-1/2 -translate-y-1/2 border-2 border-gray-950 bg-indigo-500 z-30 transition-all cursor-crosshair shadow-[0_0_6px_rgba(200,241,53,0.5)] ${isSelected ? 'scale-125 bg-yellow-400 border-yellow-300 shadow-[0_0_8px_rgba(234,179,8,0.8)]' : 'scale-100 hover:scale-125 hover:bg-yellow-400 hover:border-yellow-250 animate-pulse'}`}
                      title={t("여기로 들어오는 연결선을 클릭+드래그하여 분리하거나 다른 곳에 연결할 수 있습니다.")}
                    />

                    {/* 카드 헤더 */}
                    <div className={`p-2.5 border-b border-gray-900 flex items-center justify-between select-none ${headerBg}`}>
                      <span className={`text-[8.5px] font-black tracking-widest uppercase flex items-center gap-1.5 ${isStartScene ? 'text-emerald-400' : hasChoices ? 'text-gray-300' : 'text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-yellow-400 animate-ping' : indicatorColor}`}></span>
                        {nodeTypeBadge}
                      </span>
                      <div className="flex items-center gap-2">
                        {isStartScene && (
                          <span className="text-[7.5px] bg-emerald-500 text-black px-1.5 py-0.5 rounded font-black tracking-widest leading-none">DEFAULT</span>
                        )}
                        <span className={`text-[11px] font-bold bg-black/45 px-1.5 py-0.5 rounded border ${isSelected ? 'border-yellow-400/50 text-yellow-400' : 'border-gray-850 text-gray-500'}`}>
                          {isSelected ? 'SELECTED' : 'DRAFT'}
                        </span>
                      </div>
                    </div>

                    {/* 카드 바디 */}
                    <div className="p-3.5 space-y-3 flex-grow">
                      <div className="flex items-start justify-between gap-1.5">
                        <span className={`text-xs font-black leading-tight transition-colors ${isSelected ? 'text-yellow-300' : 'text-slate-100'}`}>
                          {scene.name}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPlayFromScene(scene.id);
                            }}
                            className="p-1 hover:bg-emerald-600/30 text-emerald-400 rounded-md transition-all shadow-sm"
                            title={t("여기서부터 비주얼 싱크 플레이")}
                          >
                            <PlayIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 배경 정보 */}
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-black/30 p-1.5 rounded-lg border border-gray-900">
                        <PhotoIcon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span className="truncate" title={bgName}>{bgName.length > 25 ? bgName.substring(0, 25) + '..' : bgName}</span>
                      </div>

                      {/* 등장 인물 */}
                      {scene.presentCharacterIds.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {scene.presentCharacterIds.map(charId => {
                            const char = vn.characters.find(c => c.id === charId);
                            if (!char) return null;
                            return (
                              <div key={charId} className="text-[11px] bg-gray-900 border border-gray-800 text-slate-300 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                <UserIcon className="w-2.5 h-2.5 text-slate-500" />
                                {char.name}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 대사 미리보기 */}
                      <div className="bg-[#050609]/65 p-2 rounded-lg border border-gray-900 text-[11px] space-y-1">
                        <div className="text-gray-500 flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                          <span>{t("Dialogue preview")}</span>
                          <span>{dialogueCount}{t("Lines")}</span>
                        </div>
                        {dialoguePreview ? (
                          <p className="text-gray-300 italic truncate font-medium">
                            "{dialoguePreview.text}"
                          </p>
                        ) : (
                          <p className="text-gray-600 italic font-mono">{t("No dialogue lines")}</p>
                        )}
                      </div>

                      {/* 분기 선택지 세부 사항 */}
                      {hasChoices ? (
                        <div className="space-y-1.5 pt-1.5 border-t border-gray-900">
                          <div className="text-[11px] text-gray-300 font-bold uppercase tracking-wider">{t("Choice Branches")}</div>
                          <div className="space-y-1">
                            {scene.choices.map((choice, choiceIdx) => {
                              const targetScene = vn.scenes.find(s => s.id === choice.nextSceneId);
                              const isChoiceConnected = choice.nextSceneId && vn.scenes.some(s => s.id === choice.nextSceneId);

                              return (
                                <div 
                                  key={choiceIdx} 
                                  className={`relative px-2 py-1.5 rounded-lg border text-[11px] flex items-center justify-between transition-colors ${
                                    isChoiceConnected 
                                      ? 'bg-black/40 border-gray-900 text-gray-300' 
                                      : 'bg-red-950/20 border-red-500/55 text-red-200'
                                  }`}
                                >
                                  <span className="truncate pr-2 min-w-0 flex-1 font-medium text-slate-300">
                                    ⌥ {choiceIdx + 1}. {choice.text || t('내용 없음')}
                                  </span>
                                  
                                  <div className="flex items-center gap-1 min-w-0 shrink-0 max-w-[50%]">
                                    {targetScene ? (
                                      <span 
                                        className="text-[11px] font-mono text-gray-300 font-bold bg-gray-700/40 px-1 py-0 shadow border border-gray-600/60 rounded overflow-hidden max-w-full truncate"
                                        title={t('이동 목적지: {name}', { name: targetScene.name })}
                                      >
                                        ➔ {targetScene.name}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-red-400 font-bold font-mono px-1 py-0 bg-red-950 border border-red-500/20 rounded animate-pulse">{t("➔ 미연결 ⚠️")}</span>
                                    )}
                                  </div>

                                  {/* 우측 연결 포트 소켓 (선택지 줄마디에 부착) - 드래그 와이어 지원 */}
                                  <div 
                                    id={`port-out-${scene.id}-${choiceIdx}`}
                                    onMouseDown={(e) => handleOutPortMouseDown(e, scene.id, choiceIdx)}
                                    className={`absolute w-3.5 h-3.5 rounded-full -right-[7.5px] top-1/2 -translate-y-1/2 border-2 border-gray-950 bg-gray-300 z-30 transition-all cursor-crosshair shadow-[0_0_6px_rgba(200,241,53,0.5)] ${isSelected ? 'scale-125 bg-yellow-400 border-yellow-300 shadow-[0_0_8px_rgba(234,179,8,0.8)]' : 'scale-100 hover:scale-125 hover:bg-yellow-400 hover:border-yellow-250'}`}
                                    title={t('선택지 {number}의 이동 드래그 포팅 마디', { number: choiceIdx + 1 })}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        /* 단일 후속 흐름 연결 포트 (선택지 없을 때 다이렉트 자동 우측 포트) - 드래그 와이어링 지원 */
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-gray-900 pointer-events-none uppercase font-mono relative">
                          <span>{t("No choice (Direct wire)")}</span>
                          <div 
                            id={`port-out-${scene.id}-0`}
                            onMouseDown={(e) => handleOutPortMouseDown(e, scene.id, 0)}
                            className={`absolute w-3.5 h-3.5 rounded-full -right-[23px] top-1/2 -translate-y-1/2 border-2 border-gray-950 bg-indigo-500 z-30 transition-all pointer-events-auto cursor-crosshair shadow-[0_0_6px_rgba(200,241,53,0.5)] ${isSelected ? 'scale-125 bg-yellow-400 border-yellow-300 shadow-[0_0_8px_rgba(234,179,8,0.8)]' : 'scale-100 hover:scale-125 hover:bg-yellow-400 hover:border-yellow-250 animate-pulse'}`} 
                            title={t("드래그하여 다음 목적지 씬을 직접 와이어로 이식합니다.")}
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* 카드 액션 바 */}
                    <div className="flex justify-between items-center p-2 border-t border-gray-900/40 bg-[#0c0f17] hover:bg-black/50 transition-all text-[11px] gap-2 select-none">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            actions.deleteScene(scene.id);
                          }}
                          className="px-2 py-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all flex items-center justify-center gap-1.5 font-bold"
                          title={t("장면 노드 삭제")}
                        >
                          <TrashIcon className="w-3 h-3" />
                          <span>{t("삭제")}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            actions.duplicateScene(scene.id);
                          }}
                          className="px-2 py-1 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all flex items-center justify-center gap-1.5 font-bold"
                          title={t("장면 노드 복사")}
                        >
                          <CopyIcon className="w-3 h-3" />
                          <span>{t("복사")}</span>
                        </button>
                      </div>
                      {scene.id !== vn.startSceneId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            actions.updateStartSceneId(scene.id);
                          }}
                          className="px-2 py-1 text-indigo-400 hover:text-yellow-400 hover:bg-indigo-600/30 rounded-md transition-all text-[11px] font-black uppercase tracking-wider"
                        >{t("시작점으로 설정")}</button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* ✨ "새 장면 노드 추가" 슬롯 버튼들을 스테이지의 마지막 노드 아래에 완벽하게 정위치 시킴! */}
              {STAGES.map((stage) => {
                const stageScenes = vn.scenes.filter(s => {
                  if (stage.id === 'ki') {
                    return s.stage === 'ki' || !['ki', 'seung', 'jeon', 'gyeol'].includes(s.stage);
                  }
                  return s.stage === stage.id;
                });

                // 가장 밑에 위치한 노드를 찾아 아래에 패딩해서 플로팅 배치
                let maxY = 120;
                stageScenes.forEach(s => {
                  const nodeY = (nodePositions[s.id]?.y) ?? 160;
                  if (nodeY > maxY) {
                    maxY = nodeY;
                  }
                });

                const buttonY = stageScenes.length > 0 ? maxY + 330 : 250;
                const colIdx = STAGES.findIndex(s => s.id === stage.id);
                const buttonX = 65 + colIdx * 400;

                return (
                  <button
                    key={`add-btn-${stage.id}`}
                    onClick={() => handleAddSceneToStage(stage.id)}
                    className="absolute border border-dashed border-gray-800 hover:border-indigo-500/60 bg-gray-900/10 hover:bg-indigo-950/20 text-gray-600 hover:text-indigo-400 rounded-xl transition-all flex flex-col items-center justify-center gap-1 text-[11px] font-bold cursor-pointer pointer-events-auto shadow-sm"
                    style={{
                      left: `${buttonX}px`,
                      top: `${buttonY}px`,
                      width: '310px',
                      height: '75px'
                    }}
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>{t("새 장면 노드 추가 (")}{t('stage.' + stage.id)})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 🔍 ComfyUI 스타일 플로팅 조작 위젯 바 */}
          <div className="absolute bottom-5 left-5 z-40 bg-gray-900/90 backdrop-blur border border-gray-800 rounded-xl p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex items-center gap-1">
            <button
              onClick={handleZoomIn}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all text-sm font-black"
              title={t("확대 (Zoom In)")}
            >
              ＋
            </button>
            <div className="w-px h-4 bg-gray-800"></div>
            <button
              onClick={handleZoomOut}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all text-sm font-black"
              title={t("축소 (Zoom Out)")}
            >
              －
            </button>
            <div className="w-px h-4 bg-gray-800"></div>
            <button
              onClick={handleZoomReset}
              className="px-2.5 py-2 text-[11px] font-black uppercase text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
              title={t("기본 배율 맞춤 (Reset)")}
            >
              FIT
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SceneTree;
