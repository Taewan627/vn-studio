import type { ContentLanguage } from '../i18n/locales';

// Aligned translations keep the same idea when the UI language changes. No provider calls.
export const QUICK_IDEAS: Record<ContentLanguage, string[]> = {
  ko: [
    '어느 날 미래의 나에게서 경고 메시지가 도착했다.',
    '마지막 우주선에서 내 이름을 아는 로봇을 만났다.',
    '비가 오는 날에만 문을 여는 마법 서점을 발견했다.',
    '잃어버린 기억을 병에 담아 파는 가게에 들어갔다.',
    '도서관의 반납된 책 속에서 내일의 범행 예고를 찾았다.',
    '마지막 열차의 승객은 나와 수상한 탐정뿐이었다.',
    '익명의 편지에 적힌 약속 장소에서 첫사랑을 만났다.',
    '매일 같은 시간에 들리는 피아노 소리의 주인을 찾아갔다.',
    '폐업 전날의 작은 식당에서 오랜 친구와 재회했다.',
    '할머니의 오래된 라디오에서 어린 시절의 내 목소리가 흘러나왔다.',
    '고양이가 말을 걸며 사라진 달을 찾아 달라고 부탁했다.',
    '용이 되는 시험을 앞둔 친구가 도망치자고 말했다.',
    '화성의 온실에서 지구에서 온 마지막 씨앗이 싹텄다.',
    '거울 속의 내가 오늘 하루만 자리를 바꾸자고 제안했다.',
    '이웃에게 잘못 배달된 꽃다발이 뜻밖의 우정을 만들었다.',
    '동네 사진관에서 아직 찍지 않은 사진을 건네받았다.',
  ],
  ja: [
    'ある日、未来の自分から警告のメッセージが届いた。',
    '最後の宇宙船で、自分の名前を知るロボットに出会った。',
    '雨の日だけ開く魔法の本屋を見つけた。',
    '失くした記憶を瓶に詰めて売る店に入った。',
    '図書館に返された本の中で、明日の犯行予告を見つけた。',
    '最終列車の乗客は、自分と怪しい探偵だけだった。',
    '匿名の手紙に書かれた待ち合わせ場所で、初恋の人に会った。',
    '毎日同じ時刻に聞こえるピアノの音をたどった。',
    '閉店前日の小さな食堂で、昔の友人と再会した。',
    '祖母の古いラジオから、子どもの頃の自分の声が流れた。',
    '猫が話しかけてきて、消えた月を探してほしいと頼んだ。',
    '竜になる試験を控えた友人が、一緒に逃げようと言った。',
    '火星の温室で、地球から来た最後の種が芽を出した。',
    '鏡の中の自分が、今日だけ入れ替わろうと提案した。',
    '隣人に誤配された花束から、思いがけない友情が生まれた。',
    '町の写真館で、まだ撮っていない写真を渡された。',
  ],
  en: [
    'One day, a warning arrives from my future self.',
    'On the last spaceship, I meet a robot that knows my name.',
    'I discover a magical bookshop that opens only on rainy days.',
    'I enter a shop that sells lost memories in glass bottles.',
    'Inside a returned library book, I find a warning about tomorrow’s crime.',
    'The last train carries only me and a suspicious detective.',
    'An anonymous letter leads me to a meeting with my first love.',
    'I follow the piano music that plays at the same time every day.',
    'On a small diner’s final night, I reunite with an old friend.',
    'My grandmother’s old radio plays a recording of my childhood voice.',
    'A talking cat asks me to find the missing moon.',
    'Before the test to become a dragon, my friend asks me to run away.',
    'In a greenhouse on Mars, the last seed from Earth begins to sprout.',
    'My reflection offers to trade places with me for just one day.',
    'A bouquet delivered to the wrong neighbor starts an unexpected friendship.',
    'A neighborhood photo studio hands me a photo I have not taken yet.',
  ],
};

const key = 'vna_quick_ideas_seen';
export function nextQuickIdea(): number {
  let seen: number[] = [];
  try { const stored = JSON.parse(sessionStorage.getItem(key) || '[]'); if (Array.isArray(stored)) seen = stored; } catch {}
  let available = QUICK_IDEAS.ko.map((_, i) => i).filter(i => !seen.includes(i));
  if (!available.length) { available = QUICK_IDEAS.ko.map((_, i) => i).filter(i => i !== seen.at(-1)); seen = seen.slice(-1); }
  const index = available[Math.floor(Math.random() * available.length)];
  try { sessionStorage.setItem(key, JSON.stringify([...seen, index])); } catch {}
  return index;
}
