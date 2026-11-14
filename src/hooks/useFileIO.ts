
import { useRef, ChangeEvent, useState } from 'react';
import { VisualNovel } from '../types';
import { LOCAL_STORAGE_KEY, getEmptyVn } from '../constants';
import { exportToRenpy, exportToHtml } from '../services/exportService';
import { prepareWebPackageAssets, WebPackageAssetError } from '../services/webPackageAssets';
import { prepareRenpyExportData } from '../services/renpyExportData';
import { saveVisualNovelData, removeFromDB } from '../utils/db';
import { useLanguage } from '../i18n/LanguageProvider';
import { validateVisualNovel } from '../services/validateVisualNovel';

import JSZip from 'jszip';

interface UseFileIOProps {
  vn: VisualNovel;
  setVisualNovel: {
    (vn: VisualNovel): void;
    (vn: VisualNovel, options: { importAsNewProject: true }): Promise<VisualNovel>;
  };
  setSelectedSceneId: (id: string) => void;
  currentProjectId?: string;
}

const toRenpyId = (str: string) => str.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

export const useFileIO = ({ vn, setVisualNovel, setSelectedSceneId, currentProjectId }: UseFileIOProps) => {
  const { language, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingWeb, setIsExportingWeb] = useState(false);

  const handleSaveToLocalStorage = async () => {
    try {
      const dbKey = currentProjectId ? 'vn_proj_' + currentProjectId : LOCAL_STORAGE_KEY;
      const success = await saveVisualNovelData(dbKey, vn);
      if (success) {
        alert(t('"{title}" 프로젝트가 로컬 브라우저 DB에 무사히 저장되었습니다!', { title: vn.title }));
      } else {
        alert(t('경고: 저장에 실패하여 일부 데이터가 유실될 수 있습니다.'));
      }
    } catch (e) {
      console.error("데이터 저장에 실패했습니다", e);
      alert(t('오류: 프로젝트를 브라우저에 저장할 수 없습니다.'));
    }
  };

  const handleSaveToFile = () => {
    try {
      const jsonString = JSON.stringify(vn, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
      const safeTitle = vn.title.replace(/[^\p{L}\p{N}_-]/gu, '_').substring(0, 20);
      
      a.download = `${safeTitle}_${dateStr}_${timeStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("파일 저장 실패", e);
      alert(t('오류: 파일을 저장할 수 없습니다.'));
    }
  };

  const handleLoadFromFileClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string') throw new Error(t('파일이 텍스트가 아닙니다.'));
        let parsedData: unknown;
        try { parsedData = JSON.parse(text); }
        catch { throw new Error('Invalid JSON syntax.'); }
        const validation = validateVisualNovel(parsedData);
        if (!validation.valid) {
          throw new Error(validation.errors.map(error => `${error.code} at ${error.path || '/'}`).join('; '));
        }

        const confirmation = language === 'ja'
          ? 'このファイルを新しいプロジェクトとして読み込みますか？現在のプロジェクトは保持されます。'
          : language === 'en'
            ? 'Import this file as a new project? The current project will be kept.'
            : '이 파일을 새 프로젝트로 가져오시겠습니까? 현재 프로젝트는 유지됩니다.';
        if (window.confirm(confirmation)) {
          const imported = await setVisualNovel(validation.data, { importAsNewProject: true });
          setSelectedSceneId(imported.startSceneId);
          alert(t('프로젝트(이미지 포함)를 성공적으로 불러왔습니다!'));
        }
      } catch (err) {
        console.error("파일 불러오기 실패", err);
        alert(`${t('오류: 파일을 불러올 수 없습니다.')} ${err instanceof Error ? err.message : ''}`);
      } finally {
          if(e.target) e.target.value = '';
      }
    };
    reader.onerror = () => {
      alert(t('파일을 읽는 중 오류가 발생했습니다.'));
      if(e.target) e.target.value = '';
    };
    reader.readAsText(file);
  };

  const base64ToBlob = (base64: string) => {
    const parts = base64.split(';base64,');
    if (parts.length < 2) return null;
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  };

  /**
   * Web Package (.zip) Export - embedded image assets
   */
  const handleExportWebPackage = async () => {
    if (typeof JSZip === 'undefined') {
        alert(t('JSZip 라이브러리가 로드되지 않았습니다.'));
        return;
    }

    setIsExportingWeb(true);
    try {
        // Validate every image before creating any downloadable artifact.
        const { data: webVnData, assets } = prepareWebPackageAssets(vn);
        const zip = new JSZip();
        zip.file("index.html", exportToHtml(webVnData, true, language));
        zip.file("project.json", JSON.stringify(webVnData, null, 2));
        for (const asset of assets) zip.file(asset.path, asset.bytes);

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle = vn.title.replace(/[^\p{L}\p{N}_-]/gu, '_').toLowerCase();
        a.download = `${safeTitle || 'visual-novel'}_web_package.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(t('웹 패키지가 생성되었습니다! 압축을 풀고 index.html을 여세요.'));
    } catch (e) {
        console.error("Web Package Export Failed", e);
        alert(e instanceof WebPackageAssetError ? e.message : t('오류: 웹 패키지를 생성할 수 없습니다.'));
    } finally {
        setIsExportingWeb(false);
    }
  };

  const handleExportToRenpy = async () => {
    if (typeof JSZip === 'undefined') {
        alert(t('JSZip 라이브러리가 로드되지 않았습니다.'));
        return;
    }

    setIsExporting(true);
    try {
      const plan = prepareRenpyExportData(vn);
      const renpyScript = exportToRenpy(vn);
      const zip = new JSZip();
      zip.file("script.rpy", renpyScript);
      zip.file("id-map.json", JSON.stringify(plan.idMap, null, 2));
      zip.file("README.txt", "Copy script.rpy and images/ into an existing Ren'Py project's game directory.\n"
        + "This archive is an export payload, not a complete SDK or standalone executable.\n"
        + "Text is literal; no authored interpolation/tags. Cover images are not used.\n");
      for (const asset of plan.assets) zip.file(asset.path, asset.bytes);

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = vn.title.replace(/[^\p{L}\p{N}_-]/gu, '_').toLowerCase();
      a.download = `${safeTitle || 'visual-novel'}_renpy_package.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert(t('Ren’Py 내보내기가 생성되었습니다. 기존 Ren’Py 프로젝트의 game 폴더에 복사하세요. 독립 실행 파일은 포함되지 않습니다.'));
    } catch (e) {
      console.error("Ren'Py Export Failed", e);
      alert(t("오류: Ren'Py 패키지를 생성할 수 없습니다.") + ' ' + (e instanceof Error ? e.message : ""));
    } finally {
        setIsExporting(false);
    }
  };

  const handleExportToHtml = () => {
    try {
      const htmlContent = exportToHtml(vn, false, language);
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = vn.title.replace(/[^\p{L}\p{N}_-]/gu, '_').substring(0, 20);
      a.download = `${safeTitle}_SINGLE_FILE.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("HTML Export Failed", e);
      alert(t('오류: HTML 파일을 생성할 수 없습니다.'));
    }
  };

  const handleReset = async () => {
    if (window.confirm(t('현재 프로젝트의 모든 인물 정보와 장면 스크립트를 비우고 리셋하시겠습니까?\n프로젝트 슬롯 자체는 그대로 유지됩니다.'))) {
      const dbKey = currentProjectId ? 'vn_proj_' + currentProjectId : LOCAL_STORAGE_KEY;
      const resetVn = {
        ...getEmptyVn(t),
        ...(vn.contentLanguage ? { contentLanguage: vn.contentLanguage } : {}),
        title: vn.title,
        description: vn.description,
        coverUrl: vn.coverUrl
      };
      await saveVisualNovelData(dbKey, resetVn);
      setVisualNovel(resetVn);
      setSelectedSceneId(resetVn.startSceneId);
    }
  };

  return {
    fileInputRef,
    isExporting,
    isExportingWeb,
    handleSaveToLocalStorage,
    handleSaveToFile,
    handleLoadFromFileClick,
    handleFileSelected,
    handleExportToRenpy,
    handleExportToHtml,
    handleExportWebPackage,
    handleReset
  };
};
