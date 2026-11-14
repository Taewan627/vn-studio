import type { ContentLanguage } from '../i18n/locales';

export interface BundledStory {
  id: string; language: ContentLanguage; title: string; url: string; coverUrl: string;
  sourceProjectHash: string; sourceUpdatedAt: number;
}

// Exact user-approved exports; personal browser projects are never uploaded.
export const BUNDLED_STORIES: BundledStory[] = [
  {
    "id": "builtin-demo-ko",
    "language": "ko",
    "title": "반납된 책 속의 예고",
    "url": "/demos/ko.json",
    "coverUrl": "/demos/ai/ko/fa5bb1561a224c911c0b.jpg",
    "sourceProjectHash": "0e58a1531514e07b46c6898a53ca5086494335e235121738ba3d07105325ac31",
    "sourceUpdatedAt": 1792906176731
  },
  {
    "id": "builtin-demo-ja",
    "language": "ja",
    "title": "記憶の瓶詰め屋",
    "url": "/demos/ja.json",
    "coverUrl": "/demos/ai/ja/9663015bb1753f949857.jpg",
    "sourceProjectHash": "b464501b1a67a72083b49be96ee9b389efbc6053e8071eda5afec29300615fbd",
    "sourceUpdatedAt": 1792889989437
  },
  {
    "id": "builtin-demo-en",
    "language": "en",
    "title": "The Last Departure",
    "url": "/demos/en.json",
    "coverUrl": "/demos/ai/en/f97a4f93145bc57ebc95.jpg",
    "sourceProjectHash": "924bdc194f3048c76ba4488eabb4cb13195f8f023a7f55c260285b2005c5d26b",
    "sourceUpdatedAt": 1792906155374
  }
];
