
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * 정밀한 마젠타 배경 제거 로직
 * 좌측 상단 픽셀을 기준으로 배경색을 감지하고, 유클리드 거리 임계값을 사용하여 픽셀을 투명하게 처리합니다.
 */
export async function removeCharacterImageBackground(baseImage: string): Promise<string> {
    if (!baseImage) return "";
    return new Promise((resolve) => {
        const img = new Image();
        // data: URL 또는 상대 경로(/...)에서는 CORS 헤더가 없으므로 crossOrigin을 설정하면 Chrome/Safari에서 이미지 로딩 에러(onerror)가 발생합니다.
        // 오직 외부 http/https URL에만 anonymous를 적용합니다.
        if (baseImage.startsWith('http://') || baseImage.startsWith('https://')) {
            img.crossOrigin = "anonymous";
        }
        
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                
                // Limit character width to max 512px to maximize processing speed and decrease base64 storage footprints
                const maxDimension = 512;
                let targetWidth = img.width || 512;
                let targetHeight = img.height || 512;
                if (targetWidth > maxDimension) {
                    const ratio = maxDimension / targetWidth;
                    targetWidth = maxDimension;
                    targetHeight = Math.round(targetHeight * ratio);
                }
                
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    resolve(baseImage);
                    return;
                }

                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // 기준 배경색 감지 (0,0 픽셀)
                const bgR = data[0];
                const bgG = data[1];
                const bgB = data[2];

                // 색상 차이 임계값 (마젠타는 더 공격적으로 처리)
                const isMagenta = (bgR > 200 && bgG < 100 && bgB > 200);
                const threshold = isMagenta ? 85 : 45;

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    // 유클리드 색상 거리 계산
                    const distance = Math.sqrt(
                        Math.pow(r - bgR, 2) +
                        Math.pow(g - bgG, 2) +
                        Math.pow(b - bgB, 2)
                    );

                    if (distance < threshold) {
                        data[i + 3] = 0; // Alpha 0
                    } else if (distance < threshold + 15) {
                        // 테두리 부드럽게 처리 (Anti-aliasing 효과)
                        data[i + 3] = ((distance - threshold) / 15) * 255;
                    }
                }

                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch (canvasErr) {
                console.warn("[imageProcessing] 배경 제거 캔버스 처리 실패, 원본 유지:", canvasErr);
                resolve(baseImage);
            }
        };

        img.onerror = (e) => {
            console.warn("[imageProcessing] 배경 제거 이미지 로드 실패, 원본 유지:", e);
            resolve(baseImage);
        };
        img.src = baseImage;
    });
}

/**
 * 정밀한 이미지 리사이징 및 고성능 JPEG 압축 유틸리티
 * 배경이미지 가로 1024px 이하로 축소 및 압축(퀄리티 0.4)을 적용해 base64 용량을 최적화하고 선명도를 유지합니다.
 */
export async function resizeAndCompressImage(base64OrUrl: string, maxWidth: number = 1024, quality: number = 0.4): Promise<string> {
    if (!base64OrUrl) return '';
    // 원격 외부 URL(예: loremflickr.com 등)은 원본 그대로 사용
    if (base64OrUrl.startsWith('http') && !base64OrUrl.startsWith('data:')) {
        return base64OrUrl;
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // 가로 크기가 maxWidth보다 크면 비율에 맞게 줄임
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(base64OrUrl);
                return;
            }

            // JPEG를 위한 불투명 배경색 채우기
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            ctx.drawImage(img, 0, 0, width, height);

            // JPEG 포맷으로 최대 압축률(quality) 적용해 변환
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedDataUrl);
        };

        img.onerror = () => {
            // 변환 오류 발생 시 복구성 회복을 위해 원본 반환
            resolve(base64OrUrl);
        };
        img.src = base64OrUrl;
    });
}

