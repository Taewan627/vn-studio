// utils/analytics.ts
// GA4 커스텀 이벤트 전송 유틸리티

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

export function trackEvent(eventName: string, params?: Record<string, any>) {
  // Legacy analytics are disabled: this function sends nothing, and this release
  // contains no analytics or telemetry. Existing callers stay compatible.
}

// 사전 정의 이벤트 함수들
export const Analytics = {
  // 프로젝트 로비
  sessionStartLobby: () => trackEvent('session_start_lobby'),
  projectCreate: (type: 'manual' | 'template') => trackEvent('project_create', { project_type: type }),

  // 스토리 생성
  storyGenerate: (preset: string) => trackEvent('story_generate', { genre_preset: preset }),
  recursiveChoice: (step: number) => trackEvent('recursive_choice', { step_number: step }),

  // 캐릭터
  characterAdd: () => trackEvent('character_add'),

  // 씬 편집
  sceneEdit: (action: string) => trackEvent('scene_edit', { edit_action: action }),
  imageGenerate: () => trackEvent('image_generate'),

  // 게임 플레이
  playStart: (fromScene?: string) => trackEvent('play_start', { start_scene: fromScene }),
  playComplete: () => trackEvent('play_complete'),
  playerChoice: (sceneId: string) => trackEvent('player_choice', { scene_id: sceneId }),

  // 내보내기
  exportAction: (format: string) => trackEvent('export_action', { export_format: format }),

  // 설문 전환
  surveyStart: () => trackEvent('survey_start'),
  surveyComplete: () => trackEvent('survey_complete'),
};
