
import type { ContentLanguage } from './i18n/locales';

export interface StoryCardOption {
  id: string;
  title: string;
  tags: string[];
  description: string;
}

export interface Expression {
  id: string;
  name: string;
  imageUrl: string;
}

export interface Character {
  id: string;
  name: string;
  expressions: Expression[];
  aiPrompt?: string;
  description?: string;
}

export interface Choice {
  text: string;
  nextSceneId: string;
}

export interface DialogueLine {
  characterId: string | null;
  expressionId: string | null;
  text: string;
}

export type StoryStage = 'ki' | 'seung' | 'jeon' | 'gyeol';

export interface Scene {
  id: string;
  name: string;
  stage: StoryStage; 
  backgroundUrl: string;
  presentCharacterIds: string[];
  dialogue: DialogueLine[];
  choices: Choice[];
  aiPrompt?: string;
}

export interface ProjectMetadata {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  updatedAt: number;
  characterCount?: number;
  sceneCount?: number;
  contentLanguage?: ContentLanguage;
  generationProfile?: 'quick';
}

export interface VisualNovel {
  quickImages?: {
    version: 1;
    background: 'queued' | 'generating' | 'ready' | 'failed';
    characters: Record<string, 'queued' | 'generating' | 'ready' | 'failed'>;
  };
  generationProfile?: 'quick';
  generationSource?: 'ai' | 'demo';
  contentLanguage?: ContentLanguage;
  id?: string;
  title: string;
  description: string;
  coverUrl: string;
  characters: Character[];
  scenes: Scene[];
  startSceneId: string;
  updatedAt?: number;
}

export interface VisualNovelActions {
  updateTitle: (title: string) => void;
  updateDescription: (desc: string) => void;
  updateCoverUrl: (url: string) => void;
  updateStartSceneId: (id: string) => void;
  addCharacter: () => void;
  deleteCharacter: (id: string) => void;
  updateCharacterName: (id: string, name: string) => void;
  updateCharacterAiPrompt: (id: string, prompt: string) => void;
  updateCharacterExpressionUrl: (charId: string, exprId: string, url: string) => void;
  addScene: (newSceneId: string, stage: StoryStage) => void;
  deleteScene: (id: string) => void;
  updateScene: (id: string, field: keyof Scene, value: any) => void;
  toggleCharacterInScene: (sceneId: string, charId: string, isPresent: boolean) => void;
  addDialogueLine: (sceneId: string) => void;
  updateDialogueLine: (sceneId: string, index: number, field: keyof DialogueLine, value: any) => void;
  deleteDialogueLine: (sceneId: string, index: number) => void;
  addChoice: (sceneId: string, nextSceneId: string) => void;
  updateChoice: (sceneId: string, index: number, field: keyof Choice, value: string) => void;
  deleteChoice: (sceneId: string, index: number) => void;
  duplicateScene: (id: string) => void;
  updateCharacter: (updater: (draft: VisualNovel) => VisualNovel) => void;
}

export interface AiOperations {
  contentLanguage: ContentLanguage;
  setContentLanguage: (language: ContentLanguage) => void;
  aiTheme: string;
  setAiTheme: (theme: string) => void;
  isGenerating: boolean;
  progress: number;
  error: string | null;
  showSuccessModal: boolean; // 추가된 성공 모달 노출 상태
  setShowSuccessModal: (val: boolean) => void; // 추가된 성공 모달 제어 함수
  generatingExpressionsForCharId: string | null;
  isRemovingBgForExprId: string | null;
  isGeneratingBg: boolean;
  isGeneratingDialogue: boolean;
  // 재귀적 스토리 생성 연동 상태 및 핸들러 추가
  recursiveStage: StoryStage | 'completed' | null;
  setRecursiveStage: (stage: StoryStage | 'completed' | null) => void;
  recursiveQuestion: string;
  recursiveChoices: string[];
  recursiveSavedTheme: string;
  handleStartRecursiveInitial: (themeOverride?: string) => Promise<void>;
  handleNextRecursiveStep: (userInput: string) => Promise<void>;
  handleCancelRecursive: () => void;
  // 기존 핸들러
  handleGenerateStory: () => Promise<void>;
  handleGenerateDemoStory: () => Promise<void>;
  handleGenerateAllCharacterExpressions: (charId: string) => Promise<void>;
  handleGenerateSingleExpression: (charId: string, exprId: string) => Promise<void>;
  handleRegenerateCharacterAndExpressions: (charId: string) => Promise<void>;
  handleRemoveBackground: (charId: string, exprId: string) => Promise<void>;
  handleGenerateSceneBackground: (sceneId: string, prompt: string) => Promise<void>;
  handleGenerateSceneDialogue: (sceneId: string, prompt: string, presentCharacterIds: string[]) => Promise<void>;
  // 소설 요약 관련 상태 및 함수
  novelSummary: string;
  setNovelSummary: (val: string) => void;
  isGeneratingNovel: boolean;
  handleGenerateNovel: () => Promise<void>;
  showRelayedToast: boolean;
  setShowRelayedToast: (val: boolean) => void;
}

