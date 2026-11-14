
import { useState, useEffect, useRef } from 'react';
import { VisualNovel, Character, Scene, Choice, DialogueLine, VisualNovelActions, StoryStage, ProjectMetadata } from '../types';
import { getDemoVn, getEmptyVn, LOCAL_STORAGE_KEY, STANDARD_EXPRESSIONS } from '../constants';
import { loadVisualNovelData, saveVisualNovelData, saveProjectAndList, removeFromDB } from '../utils/db';
import { applyQuickImage, type QuickImageUpdate } from '../services/quickImages';
import { useLanguage } from '../i18n/LanguageProvider';
import { isContentLanguage } from '../i18n/locales';
import { incomingSceneChoices, characterReferences, editorSafetyMessage } from '../services/editorReferences';

export const useVisualNovel = () => {
  const { restoreProjectLanguage, language, t } = useLanguage();
  const [vn, setVn] = useState<VisualNovel>(() => getDemoVn(language));
  const [projectList, setProjectList] = useState<ProjectMetadata[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const latest = useRef({ vn, currentProjectId });
  latest.current = { vn, currentProjectId };
  const pendingSave = useRef(false);
  const savedSnapshot = useRef<VisualNovel | null>(null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const importQueue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!pendingSave.current) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // Serialize immediate Quick saves and the existing debounced autosave so an
  // older in-flight write cannot overwrite the latest applied dialogue.
  function persistProject(snapshot: VisualNovel, projectId: string): Promise<boolean> {
    if (savedSnapshot.current === snapshot) return Promise.resolve(true);
    if (latest.current.currentProjectId === projectId) { pendingSave.current = true; setSaveStatus('saving'); }
    const task = saveQueue.current.then(async () => {
      const projectToSave = { ...snapshot, id: projectId, updatedAt: Date.now() };
      const previous: ProjectMetadata[] = await loadVisualNovelData('vn_project_list') || [];
      if (!previous.some(p => p.id === projectId)) throw new Error('Project is no longer registered');
      const updatedList: ProjectMetadata[] = [
        {
          id: projectId, title: snapshot.title || t('새 프로젝트'), description: snapshot.description || '',
          coverUrl: snapshot.coverUrl || '', updatedAt: projectToSave.updatedAt,
          characterCount: snapshot.characters?.length || 0, sceneCount: snapshot.scenes?.length || 0,
          contentLanguage: snapshot.contentLanguage, generationProfile: snapshot.generationProfile,
        }, ...previous.filter(p => p.id !== projectId),
      ].sort((a, b) => b.updatedAt - a.updatedAt);
      if (!await saveProjectAndList(projectId, projectToSave, updatedList)) throw new Error('Project save failed');
      setProjectList(updatedList);
      if (latest.current.vn === snapshot && latest.current.currentProjectId === projectId) {
        savedSnapshot.current = snapshot;
        pendingSave.current = false; setSaveStatus('saved');
      }
    });
    saveQueue.current = task.catch(() => {});
    return task.then(() => true, () => {
      if (latest.current.vn === snapshot && latest.current.currentProjectId === projectId) setSaveStatus('error');
      return false;
    });
  }

  // Initialize and migrate legacy data if necessary
  useEffect(() => {
    const initializeProjects = async () => {
      try {
        const list = await loadVisualNovelData('vn_project_list');
        const activeId = localStorage.getItem('vn_active_project_id');

        if (list && list.length > 0) {
          // List exists
          setProjectList(list);
          const targetId = activeId && list.some((p: ProjectMetadata) => p.id === activeId) 
            ? activeId 
            : list[0].id;
          
          setCurrentProjectId(targetId);
          const projectData = await loadVisualNovelData('vn_proj_' + targetId);
          if (projectData) {
            // Confirm structure compatibility
            projectData.scenes.forEach((s: any, idx: number) => {
              if (!s.stage) {
                if (idx === 0) s.stage = 'ki';
                else if (idx === 1) s.stage = 'seung';
                else if (idx === projectData.scenes.length - 1) s.stage = 'gyeol';
                else s.stage = 'jeon';
              }
            });
            setVn(projectData);
            savedSnapshot.current = projectData;
            // The bundled starter project is not a restored user story. Keep
            // the chosen/default UI language until an actual story is opened.
            if (targetId !== 'proj_demo') restoreProjectLanguage(projectData.contentLanguage);
          } else {
            // Project data load failed, fallback to EMPTY_VN
            setVn({ ...getEmptyVn(t), id: targetId });
          }
        } else {
          // No projects found. Let's migrate legacy data if available.
          const legacyData = await loadVisualNovelData(LOCAL_STORAGE_KEY);
          if (legacyData) {
            const legacyId = 'proj_legacy';
            legacyData.id = legacyId;
            legacyData.updatedAt = Date.now();

            const initialList: ProjectMetadata[] = [{
              id: legacyId,
              title: legacyData.title || '기존 프로젝트',
              description: legacyData.description || '이전 저장소에서 가져옴',
              coverUrl: legacyData.coverUrl || '',
              updatedAt: legacyData.updatedAt,
              characterCount: legacyData.characters?.length || 0,
              sceneCount: legacyData.scenes?.length || 0
            }];

            await saveVisualNovelData('vn_proj_' + legacyId, legacyData);
            await saveVisualNovelData('vn_project_list', initialList);

            setProjectList(initialList);
            setCurrentProjectId(legacyId);
            setVn(legacyData);
            restoreProjectLanguage(legacyData.contentLanguage);
            localStorage.setItem('vn_active_project_id', legacyId);
          } else {
            // No legacy data either. Bootstrap with default DEMO_VN.
            const demoId = 'proj_demo';
            const demoData = { ...getDemoVn(language), id: demoId, updatedAt: Date.now() };

            const initialList: ProjectMetadata[] = [{
              id: demoId,
              title: demoData.title,
              description: demoData.description,
              coverUrl: demoData.coverUrl,
              updatedAt: demoData.updatedAt,
              characterCount: demoData.characters?.length || 0,
              sceneCount: demoData.scenes?.length || 0
            }];

            await saveVisualNovelData('vn_proj_' + demoId, demoData);
            await saveVisualNovelData('vn_project_list', initialList);

            setProjectList(initialList);
            setCurrentProjectId(demoId);
            setVn(demoData);
            localStorage.setItem('vn_active_project_id', demoId);
          }
        }
      } catch (e) {
        console.error("프로젝트 목록 로드 실패", e);
      } finally {
        setIsLoaded(true);
      }
    };
    initializeProjects();
  }, []);

  // Set up auto-saving of current active project
  useEffect(() => {
    if (isLoaded && vn && currentProjectId) {
      // 🌟 Out-of-sync guards: Only autosave if the loaded model's ID matches currentProjectId!
      if (vn.id && vn.id !== currentProjectId) {
        return;
      }

      if (savedSnapshot.current !== vn) { pendingSave.current = true; setSaveStatus('saving'); }
      const timer = setTimeout(() => { void persistProject(vn, currentProjectId); }, 850); // Existing autosave debounce
      return () => clearTimeout(timer);
    }
  }, [vn, currentProjectId, isLoaded]);

  // Project managers actions
  const loadProject = async (id: string) => {
    setIsLoaded(false);
    try {
      const loaded = await loadVisualNovelData('vn_proj_' + id);
      if (loaded) {
        loaded.scenes.forEach((s: any, idx: number) => {
          if (!s.stage) {
            if (idx === 0) s.stage = 'ki';
            else if (idx === 1) s.stage = 'seung';
            else if (idx === loaded.scenes.length - 1) s.stage = 'gyeol';
            else s.stage = 'jeon';
          }
        });
        loaded.id = id; // Ensure ID matches perfectly!
        setCurrentProjectId(id);
        setVn(loaded);
        savedSnapshot.current = loaded; pendingSave.current = false; setSaveStatus('saved');
        restoreProjectLanguage(loaded.contentLanguage);
        localStorage.setItem('vn_active_project_id', id);
        return loaded as VisualNovel;
      }
    } catch (e) {
      console.error("프로젝트 로드 중 에러", e);
    } finally {
      setIsLoaded(true);
    }
  };

  const createNewProject = async (title?: string, description?: string, useDemoTemplate = false) => {
    setIsLoaded(false);
    try {
      const newId = 'proj_' + Date.now();
      const template = useDemoTemplate ? getDemoVn(language) : getEmptyVn(t);
      const newVn: VisualNovel = {
        ...template,
        id: newId,
        title: title || (useDemoTemplate ? t('데모 프로젝트 빌드') : t('새 프로젝트')),
        description: description || t('여기에 대략적인 소개를 입력해 주세요.'),
        updatedAt: Date.now()
      };

      await saveVisualNovelData('vn_proj_' + newId, newVn);

      const newMeta: ProjectMetadata = {
        id: newId,
        title: newVn.title,
        description: newVn.description,
        coverUrl: newVn.coverUrl,
        updatedAt: newVn.updatedAt,
        characterCount: newVn.characters?.length || 0,
        sceneCount: newVn.scenes?.length || 0
      };

      // 🌟 Fetch freshest DB list directly to prevent stale closure overwrites!
      const freshestList = await loadVisualNovelData('vn_project_list') || [];
      const updatedList = [newMeta, ...freshestList.filter((p: any) => p.id !== newId)];
      setProjectList(updatedList);
      await saveVisualNovelData('vn_project_list', updatedList);

      setCurrentProjectId(newId);
      setVn(newVn);
      localStorage.setItem('vn_active_project_id', newId);
    } catch (e) {
      console.error("프로젝트 생성 실패", e);
    } finally {
      setIsLoaded(true);
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await saveQueue.current;
      if (!await removeFromDB('vn_proj_' + id)) throw new Error('Could not delete project');
      
      // 🌟 Fetch freshest DB list directly to prevent stale state issues!
      const freshestList = await loadVisualNovelData('vn_project_list') || [];
      const updatedList = freshestList.filter((p: any) => p.id !== id);
      setProjectList(updatedList);
      if (!await saveVisualNovelData('vn_project_list', updatedList)) throw new Error('Could not save project list');

      if (currentProjectId === id) {
        if (updatedList.length > 0) {
          await loadProject(updatedList[0].id);
        } else {
          // List empty, recreate fresh one
          const defaultId = 'proj_default_new';
          const newVn: VisualNovel = {
            ...getEmptyVn(t),
            id: defaultId,
            title: t('새 프로젝트'),
            description: t('새로운 모험을 기록해 보세요.'),
            updatedAt: Date.now()
          };
          await saveVisualNovelData('vn_proj_' + defaultId, newVn);
          const newMeta: ProjectMetadata = {
            id: defaultId,
            title: newVn.title,
            description: newVn.description,
            coverUrl: newVn.coverUrl,
            updatedAt: newVn.updatedAt,
            characterCount: 0,
            sceneCount: 0
          };
          setProjectList([newMeta]);
          await saveVisualNovelData('vn_project_list', [newMeta]);
          setCurrentProjectId(defaultId);
          setVn(newVn);
          localStorage.setItem('vn_active_project_id', defaultId);
        }
      }
      return true;
    } catch (e) {
      console.error("프로젝트 삭제 실패", e);
      return false;
    }
  };

  const duplicateProject = async (id: string) => {
    try {
      const original = await loadVisualNovelData('vn_proj_' + id);
      if (original) {
        const newId = 'proj_' + Date.now();
        const duplicated: VisualNovel = {
          ...original,
          id: newId,
          title: original.title + t(' (복사본)'),
          updatedAt: Date.now()
        };

        await saveVisualNovelData('vn_proj_' + newId, duplicated);

        const newMeta: ProjectMetadata = {
          id: newId,
          title: duplicated.title,
          description: duplicated.description,
          coverUrl: duplicated.coverUrl,
          updatedAt: duplicated.updatedAt,
          characterCount: duplicated.characters?.length || 0,
          sceneCount: duplicated.scenes?.length || 0
        };

        // 🌟 Fetch freshest DB list directly to prevent stale state issues!
        const freshestList = await loadVisualNovelData('vn_project_list') || [];
        const updatedList = [newMeta, ...freshestList.filter((p: any) => p.id !== newId)];
        setProjectList(updatedList);
        await saveVisualNovelData('vn_project_list', updatedList);

        setCurrentProjectId(newId);
        setVn(duplicated);
        restoreProjectLanguage(duplicated.contentLanguage);
        localStorage.setItem('vn_active_project_id', newId);
      }
    } catch (e) {
      console.error("프로젝트 복사 실패", e);
    }
  };

  const registerGeneratedProject = async (
    generatedVn: VisualNovel,
    importedFrom?: { vn: VisualNovel; currentProjectId: string }
  ) => {
    try {
      const newId = 'proj_' + crypto.randomUUID();
      const registeredAt = Date.now();
      const newVn: VisualNovel = {
        ...generatedVn,
        id: newId,
        updatedAt: importedFrom && generatedVn.updatedAt !== undefined ? generatedVn.updatedAt : registeredAt
      };

      const newMeta: ProjectMetadata = {
        id: newId,
        title: newVn.title || t('새 생성된 프로젝트'),
        description: newVn.description || '',
        coverUrl: newVn.coverUrl || '',
        updatedAt: registeredAt,
        characterCount: newVn.characters?.length || 0,
        sceneCount: newVn.scenes?.length || 0,
        contentLanguage: newVn.contentLanguage, generationProfile: newVn.generationProfile,
      };
      const task = saveQueue.current.then(async () => {
        const freshestList: ProjectMetadata[] = await loadVisualNovelData('vn_project_list') || [];
        if (importedFrom) {
          if (latest.current.vn !== importedFrom.vn || latest.current.currentProjectId !== importedFrom.currentProjectId) {
            throw new Error('Active project changed; import was not applied.');
          }
          if (freshestList.some(p => p.id === newId) || await loadVisualNovelData('vn_proj_' + newId)) {
            throw new Error('Local project ID collision; import was not applied.');
          }
        }
        const updatedList = [newMeta, ...freshestList.filter(p => p.id !== newId)].sort((a, b) => b.updatedAt - a.updatedAt);
        if (!await saveProjectAndList(newId, newVn, updatedList)) throw new Error('Could not save generated project');
        setProjectList(updatedList);
      });
      saveQueue.current = task.catch(() => {});
      await task;

      if (importedFrom && (latest.current.vn !== importedFrom.vn || latest.current.currentProjectId !== importedFrom.currentProjectId)) {
        throw new Error('Import saved in a new slot, but the active project changed. Open it from the project list.');
      }
      if (!importedFrom || isContentLanguage(newVn.contentLanguage)) restoreProjectLanguage(newVn.contentLanguage);
      setCurrentProjectId(newId);
      setVn(newVn);
      latest.current = { vn: newVn, currentProjectId: newId };
      savedSnapshot.current = newVn; pendingSave.current = false; setSaveStatus('saved');
      try { localStorage.setItem('vn_active_project_id', newId); } catch { /* Optional active-project hint. */ }
        return newVn;
    } catch (e) {
      console.error("생성된 스토리 프로젝트 등록 실패", e);
      throw e;
    }
  };

  // Clone the editable snapshot without stripping images from live state. Native
  // cloning also avoids ambiguous concatenated ID keys corrupting image values.
  const smartCloneVisualNovel = (sourceVn: VisualNovel): VisualNovel => structuredClone(sourceVn);

  const updateVn = (updater: (draft: VisualNovel) => VisualNovel) => {
    pendingSave.current = true; setSaveStatus('saving');
    setVn(prev => updater(smartCloneVisualNovel(prev)));
  };

  const saveDialogueLine = async (sceneId: string, index: number, text: string): Promise<boolean> => {
    const current = latest.current;
    if (!isLoaded || !current.currentProjectId || current.vn.id !== current.currentProjectId) return false;
    const next = smartCloneVisualNovel(current.vn);
    const scene = next.scenes.find(s => s.id === sceneId);
    if (!scene?.dialogue[index] || !text.trim()) return false;
    scene.dialogue[index].text = text.trim();
    pendingSave.current = true; setSaveStatus('saving');
    latest.current = { vn: next, currentProjectId: current.currentProjectId };
    setVn(next);
    return persistProject(next, current.currentProjectId);
  };

  const saveQuickImage = async (projectId: string, update: QuickImageUpdate): Promise<boolean> => {
    let source = latest.current.currentProjectId === projectId ? latest.current.vn : null;
    if (!source) {
      await saveQueue.current;
      source = await loadVisualNovelData('vn_proj_' + projectId);
      if (latest.current.currentProjectId === projectId) source = latest.current.vn;
    }
    if (!source || source.id !== projectId || !source.quickImages) return false;
    const next = applyQuickImage(source, update);
    if (latest.current.currentProjectId === projectId) {
      pendingSave.current = true; setSaveStatus('saving');
      latest.current = { vn: next, currentProjectId: projectId };
      setVn(next);
    }
    return persistProject(next, projectId);
  };

  function setVisualNovel(newVn: VisualNovel): void;
  function setVisualNovel(newVn: VisualNovel, options: { importAsNewProject: true }): Promise<VisualNovel>;
  function setVisualNovel(newVn: VisualNovel, options?: { importAsNewProject: true }): void | Promise<VisualNovel> {
    if (options?.importAsNewProject) {
      // Serialize imports, flush the previous slot, and activate only after the
      // existing atomic project/list transaction acknowledges a fresh local ID.
      const task = importQueue.current.then(async () => {
        await saveQueue.current;
        const active = latest.current;
        if (active.currentProjectId) {
          if (active.vn.id && active.vn.id !== active.currentProjectId) {
            throw new Error('Active project identity mismatch; import was not applied.');
          }
          if (savedSnapshot.current !== active.vn && !await persistProject(active.vn, active.currentProjectId)) {
            throw new Error('Could not save the active project; import was not applied.');
          }
        }
        if (latest.current.vn !== active.vn || latest.current.currentProjectId !== active.currentProjectId) {
          throw new Error('Active project changed; import was not applied.');
        }
        return registerGeneratedProject(newVn, active);
      });
      importQueue.current = task.catch(() => {});
      return task;
    }
    if (isContentLanguage(newVn.contentLanguage)) restoreProjectLanguage(newVn.contentLanguage);
    setVn(newVn);
  }

  const updateTitle = (title: string) => updateVn(draft => ({ ...draft, title }));
  const updateDescription = (desc: string) => updateVn(draft => ({ ...draft, description: desc }));
  const updateCoverUrl = (url: string) => updateVn(draft => ({ ...draft, coverUrl: url }));
  const updateStartSceneId = (id: string) => updateVn(draft => ({ ...draft, startSceneId: id }));

  const addCharacter = () => {
    const newId = `char_${Date.now()}`;
    const newCharacter: Character = { 
        id: newId, 
        name: t('새 캐릭터'), 
        // Fix: Use STANDARD_EXPRESSIONS instead of DEFAULT_EXPRESSIONS
        expressions: STANDARD_EXPRESSIONS.map((expr, i) => ({
            id: `${newId}_e${i + 1}`,
            name: expr.name,
            imageUrl: ''
        })),
        aiPrompt: '',
    };
    updateVn(draft => ({ ...draft, characters: [...draft.characters, newCharacter] }));
  };

  const deleteCharacter = (id: string) => {
    const current = latest.current.vn;
    if (!current.characters.some(character => character.id === id)) return;
    const references = characterReferences(current, id);
    if (!window.confirm(editorSafetyMessage(language, 'character', references.lines.length, references.sceneIds.length))) return;
    updateVn(draft => {
      draft.characters = draft.characters.filter(c => c.id !== id);
      draft.scenes.forEach(s => {
        s.presentCharacterIds = s.presentCharacterIds.filter(cid => cid !== id);
        s.dialogue.forEach(d => {
          if (d.characterId === id) { d.characterId = null; d.expressionId = null; }
        });
      });
      return draft;
    });
  };

  const updateCharacterName = (id: string, name: string) => {
    updateVn(draft => {
        const char = draft.characters.find(c => c.id === id);
        if (char) char.name = name;
        return draft;
    });
  };

  const updateCharacterAiPrompt = (id: string, prompt: string) => {
    updateVn(draft => {
        const char = draft.characters.find(c => c.id === id);
        if (char) char.aiPrompt = prompt;
        return draft;
    });
  };

  const updateCharacterExpressionUrl = (charId: string, exprId: string, url: string) => {
    updateVn(draft => {
        const char = draft.characters.find(c => c.id === charId);
        if (char) {
            const expr = char.expressions.find(e => e.id === exprId);
            if (expr) expr.imageUrl = url;
        }
        return draft;
    });
  };

  const addScene = (newSceneId: string, stage: StoryStage) => {
      const newScene: Scene = { 
          id: newSceneId, 
          name: t('새 장면'), 
          stage,
          backgroundUrl: '', 
          presentCharacterIds: [], 
          dialogue: [{ characterId: null, expressionId: null, text: t('새 대화를 입력하세요...') }], 
          choices: [], 
          aiPrompt: '' 
      };
      updateVn(draft => ({ ...draft, scenes: [...draft.scenes, newScene] }));
  };

  const deleteScene = (id: string) => {
    const current = latest.current.vn;
    if (!current.scenes.some(scene => scene.id === id)) return;
    if (current.startSceneId === id) { alert(editorSafetyMessage(language, 'entry')); return; }
    const incoming = incomingSceneChoices(current, id);
    if (incoming.length) { alert(editorSafetyMessage(language, 'incoming', incoming.length)); return; }
    if (!window.confirm(editorSafetyMessage(language, 'scene'))) return;
    updateVn(draft => {
      // Recheck the actual queued snapshot without opening dialogs in a React updater.
      if (draft.startSceneId === id || incomingSceneChoices(draft, id).length) return draft;
      draft.scenes = draft.scenes.filter(scene => scene.id !== id);
      return draft;
    });
  };

  const duplicateScene = (sceneId: string) => {
    updateVn(draft => {
      const idx = draft.scenes.findIndex(s => s.id === sceneId);
      if (idx === -1) return draft;
      const original = draft.scenes[idx];
      const newSceneId = `scene_${Date.now()}`;
      
      const duplicated: Scene = {
        id: newSceneId,
        name: t('{name} (복사)', { name: original.name }),
        stage: original.stage,
        backgroundUrl: original.backgroundUrl,
        presentCharacterIds: [...(original.presentCharacterIds || [])],
        dialogue: (original.dialogue || []).map(line => ({
          characterId: line.characterId,
          expressionId: line.expressionId,
          text: line.text
        })),
        choices: (original.choices || []).map(choice => ({
          text: choice.text,
          nextSceneId: ''
        })),
        aiPrompt: original.aiPrompt || ''
      };

      draft.scenes.splice(idx + 1, 0, duplicated);
      return draft;
    });
  };

  const updateScene = (id: string, field: keyof Scene, value: any) => {
      updateVn(draft => {
        const target = draft.scenes.find(s => s.id === id);
        if (target) (target as any)[field] = value;
        return draft;
      });
  };

  const toggleCharacterInScene = (sceneId: string, charId: string, isPresent: boolean) => {
    if (!isPresent) {
      const affected = characterReferences(latest.current.vn, charId).lines.filter(line => line.sceneId === sceneId).length;
      if (affected && !window.confirm(editorSafetyMessage(language, 'unstage', affected))) return;
    }
    updateVn(draft => {
        const scene = draft.scenes.find(s => s.id === sceneId);
        if (scene) {
            if (isPresent) {
                if (!scene.presentCharacterIds.includes(charId)) scene.presentCharacterIds.push(charId);
            } else {
                scene.presentCharacterIds = scene.presentCharacterIds.filter(id => id !== charId);
                scene.dialogue.forEach(line => {
                    if (line.characterId === charId) { line.characterId = null; line.expressionId = null; }
                });
            }
        }
        return draft;
    });
  };

  const addDialogueLine = (sceneId: string) => {
    updateVn(draft => {
      const scene = draft.scenes.find(s => s.id === sceneId);
      if (scene) scene.dialogue.push({ characterId: null, expressionId: null, text: '' });
      return draft;
    });
  };

  const updateDialogueLine = (sceneId: string, index: number, field: keyof DialogueLine, value: any) => {
    updateVn(draft => {
        const scene = draft.scenes.find(s => s.id === sceneId);
        if (scene && scene.dialogue[index]) {
            const line = scene.dialogue[index];
            if (field === 'characterId' && line.characterId !== value) {
                line.characterId = value;
                line.expressionId = null; // Default expression belongs to the new speaker.
            } else (line as any)[field] = value;
        }
        return draft;
    });
  };

  const deleteDialogueLine = (sceneId: string, index: number) => {
    updateVn(draft => {
        const scene = draft.scenes.find(s => s.id === sceneId);
        if (scene && scene.dialogue.length > 1) {
            scene.dialogue.splice(index, 1);
        }
        return draft;
    });
  };

  const addChoice = (sceneId: string, nextSceneId: string) => {
      updateVn(draft => {
        const scene = draft.scenes.find(s => s.id === sceneId);
        if (scene) scene.choices.push({ text: t('새 선택지'), nextSceneId });
        return draft;
      });
  };

  const updateChoice = (sceneId: string, index: number, field: keyof Choice, value: string) => {
    updateVn(draft => {
      const scene = draft.scenes.find(s => s.id === sceneId);
      if (scene && scene.choices[index]) (scene.choices[index] as any)[field] = value;
      return draft;
    });
  };

  const deleteChoice = (sceneId: string, index: number) => {
    updateVn(draft => {
      const scene = draft.scenes.find(s => s.id === sceneId);
      if (scene) scene.choices.splice(index, 1);
      return draft;
    });
  };

  const updateCharacter = (updater: (draft: VisualNovel) => VisualNovel) => {
    updateVn(updater);
  };

  return {
    vn, setVisualNovel,
    projectList,
    currentProjectId,
    isLoaded,
    saveStatus, saveDialogueLine, saveQuickImage,
    loadProject,
    createNewProject,
    deleteProject,
    duplicateProject,
    registerGeneratedProject,
    actions: {
        updateTitle, updateDescription, updateCoverUrl, updateStartSceneId,
        addCharacter, deleteCharacter, updateCharacterName, updateCharacterAiPrompt, updateCharacterExpressionUrl,
        addScene, deleteScene, duplicateScene, updateScene, toggleCharacterInScene,
        addDialogueLine, updateDialogueLine, deleteDialogueLine, addChoice, updateChoice, deleteChoice,
        updateCharacter
    }
  };
};
