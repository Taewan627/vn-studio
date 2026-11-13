
import { useState, useRef, useEffect } from 'react';
import { VisualNovel, VisualNovelActions, AiOperations, StoryStage } from '../types';
import { generateStory, generateCharacterImage, editCharacterImageExpression, generateSceneBackground, generateSceneDialogue, generateRecursiveInitial, generateRecursiveNextStep, summarizeStoryToNovel } from '../services/geminiService';
import { removeCharacterImageBackground } from '../utils/imageProcessing';

import { DEMO_VN } from '../constants';
import { useLanguage } from '../i18n/LanguageProvider';
import { translate } from '../i18n/catalog';
import { resolveContentLanguage, type ContentLanguage } from '../i18n/locales';
import { isImageGenerationEnabled } from '../services/imageGenerationPolicy';

export const useAiOperations = (
  vn: VisualNovel,
  actions: VisualNovelActions,
  setVisualNovel: (vn: VisualNovel) => void,
  setSelectedSceneId: (id: string) => void,
  registerGeneratedProject?: (vn: VisualNovel) => Promise<void | VisualNovel>
): AiOperations => {
  const { language, t } = useLanguage();
  const [requestedLanguage, setContentLanguage] = useState<ContentLanguage | null>(null);
  const contentLanguage = requestedLanguage ?? vn.contentLanguage ?? language;
  useEffect(() => { setContentLanguage(null); }, [vn.id]);
  const [aiTheme, setAiTheme] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const [generatingExpressionsForCharId, setGeneratingExpressionsForCharId] = useState<string | null>(null);
  const [isRemovingBgForExprId, setIsRemovingBgForExprId] = useState<string | null>(null);
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);
  const [isGeneratingDialogue, setIsGeneratingDialogue] = useState(false);

  // 재귀적 연계 생성 상태 추가
  const [recursiveStage, setRecursiveStage] = useState<StoryStage | 'completed' | null>(null);
  const [showRelayedToast, setShowRelayedToast] = useState(false);
  const [recursiveQuestion, setRecursiveQuestion] = useState('');
  const [recursiveChoices, setRecursiveChoices] = useState<string[]>([]);
  const [recursiveSavedTheme, setRecursiveSavedTheme] = useState('');

  const progressIntervalRef = useRef<number | null>(null);

  const updateProgress = (val: number) => setProgress(val);

  const startFakeProgress = (maxProgress = 95, duration = 30000) => {
    setProgress(0);
    const startTime = Date.now();
    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const percentage = Math.min((elapsed / duration) * maxProgress, maxProgress);
      setProgress(Math.floor(percentage));
    }, 200);
  };

  const stopProgress = (finalVal = 100) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgress(finalVal);
  };

  const generateInitialVisuals = async (generatedVN: VisualNovel) => {
    if (!isImageGenerationEnabled()) {
      generatedVN.coverUrl ??= '';
      return;
    }
    const charPromises = generatedVN.characters.map(async (char) => {
      try {
        let rawImg = await generateCharacterImage(char.name, char.aiPrompt || '', '중립');
        if (!rawImg) {
          rawImg = `https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400`;
        }
        const processed = await removeCharacterImageBackground(rawImg).catch(() => rawImg);
        const neutralExpr = char.expressions.find(e => e.name === '중립');
        if (neutralExpr) neutralExpr.imageUrl = processed;
      } catch (e) { 
        console.error(`[AI] Character generation failed: ${char.name}`, e); 
        const neutralExpr = char.expressions.find(e => e.name === '중립');
        if (neutralExpr) {
          neutralExpr.imageUrl = `https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400`;
        }
      }
    });

    const backgroundPromise = (async () => {
      try {
        const coverPrompt = `Title Art: ${generatedVN.title}. ${generatedVN.description}.`;
        const startScene = generatedVN.scenes.find(s => s.id === generatedVN.startSceneId);
        const otherScenes = generatedVN.scenes.filter(s => s.id !== generatedVN.startSceneId);

        const tasks: Promise<any>[] = [];

        // 1. Cover Image Task (Running in parallel)
        tasks.push(
          generateSceneBackground(coverPrompt)
            .then(url => {
              generatedVN.coverUrl = url || `https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800`;
            })
            .catch(() => {
              generatedVN.coverUrl = `https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800`;
            })
        );

        // 2. Start Scene Background Task (Running in parallel)
        if (startScene) {
          tasks.push(
            generateSceneBackground(startScene.aiPrompt || startScene.name)
              .then(url => {
                startScene.backgroundUrl = url || `https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800`;
              })
              .catch(() => {
                startScene.backgroundUrl = `https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800`;
              })
          );
        }

        // 3. Other Scenes Common Background Task (Running in parallel)
        if (otherScenes.length > 0) {
          const secondScene = otherScenes[0];
          tasks.push(
            generateSceneBackground(secondScene.aiPrompt || secondScene.name)
              .then(url => {
                const finalUrl = url || `https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=800`;
                otherScenes.forEach(s => { s.backgroundUrl = finalUrl; });
              })
              .catch(() => {
                const fallbackUrl = `https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=800`;
                otherScenes.forEach(s => { s.backgroundUrl = fallbackUrl; });
              })
          );
        }

        await Promise.all(tasks);
      } catch (e) { 
        console.error("[AI] Background generation failed", e);
        const fallbackBg = `https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=800`;
        if (!generatedVN.coverUrl) generatedVN.coverUrl = fallbackBg;
        generatedVN.scenes.forEach(s => {
          if (!s.backgroundUrl) s.backgroundUrl = fallbackBg;
        });
      }
    })();

    await Promise.all([...charPromises, backgroundPromise]);
  };

  const handleGenerateStory = async () => {
    if (!aiTheme.trim()) return;
    const requestLanguage = contentLanguage;
    setIsGenerating(true);
    setError(null);
    setShowSuccessModal(false);
    startFakeProgress(70, 20000); 

    try {
      const generatedVN = await generateStory(aiTheme, { contentLanguage: requestLanguage });
      generatedVN.contentLanguage = requestLanguage;
      updateProgress(80);

      await generateInitialVisuals(generatedVN);
      
      stopProgress(100);
      if (registerGeneratedProject) {
        await registerGeneratedProject(generatedVN);
      } else {
        setVisualNovel(generatedVN);
      }
      setSelectedSceneId(generatedVN.startSceneId);
      setAiTheme('');
      // 성공 모달 활성화
      setShowSuccessModal(true);
    } catch (e) {
      stopProgress(0);
      setError(e instanceof Error ? e.message : t('스토리 생성 도중 예기치 못한 오류가 발생했습니다.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartRecursiveInitial = async (themeOverride?: string) => {
    const themeToUse = themeOverride !== undefined ? themeOverride : aiTheme;
    if (!themeToUse.trim()) return;
    const requestLanguage = contentLanguage;
    setIsGenerating(true);
    setError(null);
    setShowSuccessModal(false);
    startFakeProgress(70, 20000);

    try {
      const result = await generateRecursiveInitial(themeToUse, { contentLanguage: requestLanguage });
      result.vn.contentLanguage = requestLanguage;
      updateProgress(80);

      await generateInitialVisuals(result.vn);

      stopProgress(100);
      if (registerGeneratedProject) {
        await registerGeneratedProject(result.vn);
      } else {
        setVisualNovel(result.vn);
      }
      setSelectedSceneId(result.vn.startSceneId);
      
      setRecursiveSavedTheme(themeToUse);
      setAiTheme('');
      setRecursiveStage('ki'); // 처음 생성한 뒤 '기(ki)' 단계에서 이야기를 더 발전시킬 수 있도록 'ki'로 세이빙
      setRecursiveQuestion(result.nextQuestion);
      setRecursiveChoices(result.nextChoices);

      setShowSuccessModal(true);
    } catch (e) {
      stopProgress(0);
      setError(e instanceof Error ? e.message : t('릴레이 생성의 기(Starting) 단계 도중 오류가 발생했습니다.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNextRecursiveStep = async (userInput: string) => {
    if (!recursiveStage || recursiveStage === 'completed') return;
    setIsGenerating(true);
    setError(null);
    startFakeProgress(75, 20000);

    try {
      const requestLanguage = resolveContentLanguage(vn.contentLanguage);
      const result = await generateRecursiveNextStep(recursiveSavedTheme, vn, recursiveStage, userInput, { contentLanguage: requestLanguage });
      updateProgress(85);

      const newScenes = result?.newScenes || [];
      // 장면에 해당하는 AI 이미지 배경 배치
      for (let i = 0; isImageGenerationEnabled() && i < newScenes.length; i++) {
        const scene = newScenes[i];
        try {
          let bgUrl = await generateSceneBackground(scene.aiPrompt || scene.name);
          if (!bgUrl) {
            bgUrl = `https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=800`;
          }
          scene.backgroundUrl = bgUrl;
        } catch (err) {
          console.error(`장면 배경 생성 실패: ${scene.name}`, err);
          scene.backgroundUrl = `https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=800`;
        }
      }

      // 비주얼 노벨의 씬 리스트에 추가
      const updatedScenes = [...vn.scenes, ...newScenes];

      // 이전 모든 씬 중에서 'choices'(선택지)가 비어 있는 끝부분 장면을 찾아 새로 만들어진 장면들과 자연스럽게 연결시킵니다.
      if (newScenes.length > 0) {
        const lastStageScenes = vn.scenes.filter(s => s.choices.length === 0);
        lastStageScenes.forEach(ls => {
          const targetInUpdated = updatedScenes.find(s => s.id === ls.id);
          if (targetInUpdated) {
            const stageLabels: Record<string, string> = {
              ki: '기(도입) 분기',
              seung: '승(전개) 분기',
              jeon: '전(절정) 분기',
              gyeol: '결(엔딩) 분기'
            };
            const relationText = requestLanguage === 'ko' ? (stageLabels[recursiveStage] || '내용 보강') : translate(requestLanguage, '연결해 계속하기');
            targetInUpdated.choices = [
              {
                text: `[${relationText}] -> ${newScenes[0].name}`,
                nextSceneId: newScenes[0].id
              }
            ];
          }
        });
      }

      // 신규 및 기존 장면 간의 미연결 선택지 및 불완전 선택지 자동 치유 파스 (Defense in Depth)
      updatedScenes.forEach((scene, sIdx) => {
        if (!scene.choices) scene.choices = [];
        scene.choices.forEach(choice => {
          let targetExists = updatedScenes.some(s => s && s.id === choice.nextSceneId);
          if (!targetExists && choice.nextSceneId) {
            const cleaned = choice.nextSceneId.trim().toLowerCase();
            const foundByName = updatedScenes.find(s => 
              s && s.name && (s.name.trim().toLowerCase() === cleaned || cleaned.includes(s.name.trim().toLowerCase()))
            );
            if (foundByName) {
              choice.nextSceneId = foundByName.id;
              targetExists = true;
            }
          }
          if (!targetExists || !choice.nextSceneId) {
            const fallbackScene = updatedScenes.slice(sIdx + 1).find(s => s && s.id !== scene.id) || 
                                  updatedScenes.find(s => s && s.id !== scene.id);
            if (fallbackScene) {
              choice.nextSceneId = fallbackScene.id;
            }
          }
        });
      });

      const updatedVn: VisualNovel = {
        ...vn,
        scenes: updatedScenes
      };

      setVisualNovel(updatedVn);
      if (newScenes.length > 0) {
        setSelectedSceneId(newScenes[0].id);
      }

      // 사용자가 수동으로 단계를 조작하게 지원하므로, 단계를 강제 점프시키지 않고 
      // 질문과 선택지만 즉각 보정 및 갱신해 줍니다!
      setRecursiveQuestion(result.nextQuestion || translate(requestLanguage, '이어서 이야기를 어떻게 구성할까요?'));
      setRecursiveChoices(result.nextChoices || ['새로운 양상을 연출한다.', '주인공들의 대화를 깊이 있게 나눈다.', '갑작스러운 난관이 등장한다.'].map(text => translate(requestLanguage, text)));

      stopProgress(100);
      setShowRelayedToast(true);
      setTimeout(() => {
        setShowRelayedToast(false);
      }, 3000);
    } catch (e) {
      stopProgress(0);
      setError(e instanceof Error ? e.message : t('다음 스토리 전개 생성 도중 오류가 발생했습니다.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancelRecursive = () => {
    setRecursiveStage(null);
    setRecursiveQuestion('');
    setRecursiveChoices([]);
    setRecursiveSavedTheme('');
  };

  const handleGenerateDemoStory = async () => {
    setIsGenerating(true);
    setProgress(0);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      if (registerGeneratedProject) {
        await registerGeneratedProject(DEMO_VN);
      } else {
        setVisualNovel(DEMO_VN);
      }
      setSelectedSceneId(DEMO_VN.startSceneId);
      setProgress(100);
      setShowSuccessModal(true);
    } catch(e) { setError("데모를 불러올 수 없습니다."); }
    finally { setIsGenerating(false); }
  };

  const handleGenerateAllCharacterExpressions = async (charId: string) => {
    if (!isImageGenerationEnabled()) { setError(t('Image generation disabled')); return; }
    const char = vn.characters.find(c => c.id === charId);
    if (!char) return;

    setGeneratingExpressionsForCharId(charId);
    setProgress(0);
    
    try {
      const neutralExpr = char.expressions.find(e => e.name === '중립') || char.expressions[0];
      let baseImageUrl = neutralExpr?.imageUrl || '';
      
      // If neutral expression doesn't have an image, generate it first as the anchor
      if (!baseImageUrl) {
        updateProgress(10);
        baseImageUrl = await generateCharacterImage(char.name, char.aiPrompt || '', '중립');
        baseImageUrl = await removeCharacterImageBackground(baseImageUrl).catch(() => baseImageUrl);
        if (neutralExpr) actions.updateCharacterExpressionUrl(charId, neutralExpr.id, baseImageUrl);
      }
      
      // Generate all non-neutral expressions anchored to baseImageUrl and character identity
      const otherExprs = char.expressions.filter(e => e.id !== neutralExpr?.id);
      for (let i = 0; i < otherExprs.length; i++) {
        const expr = otherExprs[i];
        try {
          updateProgress(Math.floor(15 + ((i) / otherExprs.length) * 80));
          const newImg = await editCharacterImageExpression(
            baseImageUrl,
            expr.name,
            char.name,
            char.aiPrompt || ''
          );
          const processed = await removeCharacterImageBackground(newImg).catch(() => newImg);
          actions.updateCharacterExpressionUrl(charId, expr.id, processed);
        } catch (exprErr) {
          console.warn(`표정(${expr.name}) 생성 중 오류 발생:`, exprErr);
        }
      }
      updateProgress(100);
    } catch (e: any) {
      console.error("[AI] Generate all expressions error:", e);
      alert(`표정 일괄 생성 중 오류가 발생했습니다.\n${e?.message || '잠시 후 다시 시도해 주세요.'}`);
    } finally {
      setGeneratingExpressionsForCharId(null);
      setProgress(0);
    }
  };

  const handleGenerateSingleExpression = async (charId: string, exprId: string) => {
    if (!isImageGenerationEnabled()) { setError(t('Image generation disabled')); return; }
    const char = vn.characters.find(c => c.id === charId);
    const expr = char?.expressions.find(e => e.id === exprId);
    if (!char || !expr) return;

    setGeneratingExpressionsForCharId(charId);
    setProgress(0);
    try {
      const neutralExpr = char.expressions.find(e => e.name === '중립') || char.expressions[0];
      let baseImageUrl = neutralExpr?.imageUrl || '';

      if (expr.id === neutralExpr?.id || expr.name === '중립') {
        // Generating the base neutral sprite itself
        updateProgress(30);
        const raw = await generateCharacterImage(char.name, char.aiPrompt || '', '중립');
        updateProgress(70);
        const processed = await removeCharacterImageBackground(raw).catch(() => raw);
        actions.updateCharacterExpressionUrl(charId, expr.id, processed);
        updateProgress(100);
        return;
      }

      // If neutral base does not exist yet, generate it first as the anchor
      if (!baseImageUrl) {
        updateProgress(15);
        baseImageUrl = await generateCharacterImage(char.name, char.aiPrompt || '', '중립');
        baseImageUrl = await removeCharacterImageBackground(baseImageUrl).catch(() => baseImageUrl);
        if (neutralExpr) actions.updateCharacterExpressionUrl(charId, neutralExpr.id, baseImageUrl);
      }

      updateProgress(45);
      const newImg = await editCharacterImageExpression(
        baseImageUrl,
        expr.name,
        char.name,
        char.aiPrompt || ''
      );
      updateProgress(80);
      const processed = await removeCharacterImageBackground(newImg).catch(() => newImg);
      actions.updateCharacterExpressionUrl(charId, expr.id, processed);
      updateProgress(100);
    } catch (err: any) {
      console.error("[AI] Single expression error:", err);
      alert(`표정(${expr.name}) 생성 중 오류가 발생했습니다.\n${err?.message || '잠시 후 다시 시도해 주세요.'}`);
    } finally {
      setGeneratingExpressionsForCharId(null);
      setProgress(0);
    }
  };

  const handleRegenerateCharacterAndExpressions = async (charId: string) => {
    if (!isImageGenerationEnabled()) { setError(t('Image generation disabled')); return; }
    const char = vn.characters.find(c => c.id === charId);
    if (!char) return;

    setGeneratingExpressionsForCharId(charId);
    setProgress(0);
    
    try {
      const neutralExpr = char.expressions.find(e => e.name === '중립') || char.expressions[0];
      
      // 1. 기존 중립 이미지가 존재하더라도 무조건 새로 생성
      updateProgress(15);
      let baseImageUrl = await generateCharacterImage(char.name, char.aiPrompt || '', '중립');
      if (!baseImageUrl) {
        throw new Error("이미지 생성 서버로부터 응답을 받지 못했습니다.");
      }
      updateProgress(50);
      baseImageUrl = await removeCharacterImageBackground(baseImageUrl).catch(() => baseImageUrl);
      updateProgress(80);
      
      if (neutralExpr) {
        actions.updateCharacterExpressionUrl(charId, neutralExpr.id, baseImageUrl);
      }
      
      // 2. 다른 표정들은 새로운 캐릭터 기준에 맞추기 위해 초기화/삭제합니다.
      // 이렇게 함으로써 사용자가 새로운 캐릭터를 마음에 들어할 경우 아래의 "일괄 생성" 버튼을 눌러 새 캐릭터 기준으로 일괄 생성할 수 있게 완전히 연계됩니다!
      const otherExprs = char.expressions.filter(e => e.id !== neutralExpr?.id);
      otherExprs.forEach(expr => {
        actions.updateCharacterExpressionUrl(charId, expr.id, '');
      });
      
      updateProgress(100);
    } catch (e: any) {
      console.error("[AI] Regenerate character error:", e);
      alert(`캐릭터 새로 생성 중 오류가 발생했습니다.\n${e?.message || '잠시 후 다시 시도해 주세요.'}`);
    } finally {
      setGeneratingExpressionsForCharId(null);
      setProgress(0);
    }
  };

  const handleRemoveBackground = async (charId: string, exprId: string) => {
    const char = vn.characters.find(c => c.id === charId);
    const expr = char?.expressions.find(e => e.id === exprId);
    if (!char || !expr || !expr.imageUrl) return;

    setIsRemovingBgForExprId(exprId);
    try {
      const newUrl = await removeCharacterImageBackground(expr.imageUrl);
      actions.updateCharacterExpressionUrl(charId, exprId, newUrl);
    } catch (e) { alert('배경 제거 실패'); }
    finally { setIsRemovingBgForExprId(null); }
  };

  const handleGenerateSceneBackground = async (sceneId: string, prompt: string) => {
    if (!isImageGenerationEnabled()) { setError(t('Image generation disabled')); return; }
    if (!prompt) return;
    setIsGeneratingBg(true);
    try {
      const url = await generateSceneBackground(prompt);
      actions.updateScene(sceneId, 'backgroundUrl', url);
    } catch (e) { alert('배경 생성 실패'); }
    finally { setIsGeneratingBg(false); }
  };

  const handleGenerateSceneDialogue = async (sceneId: string, prompt: string, presentCharacterIds: string[]) => {
    setIsGeneratingDialogue(true);
    try {
      const scene = vn.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      const presentChars = vn.characters.filter(c => presentCharacterIds.includes(c.id));
      const newDialogue = await generateSceneDialogue(scene.name, prompt, presentChars, { contentLanguage: resolveContentLanguage(vn.contentLanguage) });
      
      const existingDialogue = scene.dialogue || [];
      const isPlaceholderOnly = existingDialogue.length === 1 && 
        (existingDialogue[0].text === '새 대화를 입력하세요...' || existingDialogue[0].text.trim() === '');
      
      const combinedDialogue = isPlaceholderOnly 
        ? newDialogue 
        : [...existingDialogue, ...newDialogue];
        
      actions.updateScene(sceneId, 'dialogue', combinedDialogue);
    } catch (e) { alert('대화 생성 실패'); }
    finally { setIsGeneratingDialogue(false); }
  };

  // 소설 요약 관련 상태 및 제어 함수
  const [novelSummary, setNovelSummary] = useState('');
  const [isGeneratingNovel, setIsGeneratingNovel] = useState(false);

  const handleGenerateNovel = async () => {
    if (!vn || vn.scenes.length === 0) {
      alert('이야기를 구성할 장면(Scene)이 존재하지 않습니다. 스토리를 생성해 주세요.');
      return;
    }
    setIsGeneratingNovel(true);
    try {
      const summary = await summarizeStoryToNovel(vn, { contentLanguage: resolveContentLanguage(vn.contentLanguage) });
      setNovelSummary(summary);
    } catch (e) {
      alert(e instanceof Error ? e.message : '소설을 구성하는 중 에러가 발생했습니다.');
    } finally {
      setIsGeneratingNovel(false);
    }
  };

  return {
    contentLanguage, setContentLanguage,
    aiTheme, setAiTheme, isGenerating, progress, error,
    showSuccessModal, setShowSuccessModal,
    generatingExpressionsForCharId, isRemovingBgForExprId,
    isGeneratingBg, isGeneratingDialogue,
    recursiveStage, setRecursiveStage, recursiveQuestion, recursiveChoices, recursiveSavedTheme,
    handleStartRecursiveInitial, handleNextRecursiveStep, handleCancelRecursive,
    handleGenerateStory, handleGenerateDemoStory,
    handleGenerateAllCharacterExpressions, handleGenerateSingleExpression, handleRegenerateCharacterAndExpressions, handleRemoveBackground,
    handleGenerateSceneBackground, handleGenerateSceneDialogue,
    // 소설 요약 연계 바인딩 추가
    novelSummary, setNovelSummary, isGeneratingNovel, handleGenerateNovel,
    showRelayedToast, setShowRelayedToast
  };
};

