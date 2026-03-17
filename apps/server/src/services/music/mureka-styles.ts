/**
 * Mureka 스타일/장르 목록
 * 뮤레카 API prompt에 사용하는 영문 태그.
 * (공식 장르 API가 없어 문서·사례 기반 목록 유지)
 * @see https://platform.mureka.ai/docs
 * @see MUREKA_SETUP.md
 */
export interface MusicStyleOption {
  tag: string;
  labelKo: string;
}

export const MUREKA_GENRES: MusicStyleOption[] = [
  { tag: 'pop', labelKo: '팝' },
  { tag: 'ballad', labelKo: '발라드' },
  { tag: 'rock', labelKo: '록' },
  { tag: 'indie', labelKo: '인디' },
  { tag: 'acoustic', labelKo: '어쿠스틱' },
  { tag: 'piano', labelKo: '피아노' },
  { tag: 'R&B', labelKo: 'R&B' },
  { tag: 'jazz', labelKo: '재즈' },
  { tag: 'classical', labelKo: '클래식' },
  { tag: 'electronic', labelKo: '일렉트로닉' },
  { tag: 'hip-hop', labelKo: '힙합' },
  { tag: 'latin', labelKo: '라틴' },
  { tag: 'world-music', labelKo: '월드뮤직' },
  { tag: 'metal', labelKo: '메탈' },
  { tag: 'country', labelKo: '컨트리' },
  { tag: 'folk', labelKo: '포크' },
  { tag: 'k-pop', labelKo: '케이팝' },
  { tag: 'lo-fi', labelKo: '로파이' },
  { tag: 'ambient', labelKo: '앰비언트' },
  { tag: 'chill', labelKo: '칠' },
  { tag: 'soul', labelKo: '솔' },
  { tag: 'blues', labelKo: '블루스' },
  { tag: 'reggae', labelKo: '레게' },
  { tag: 'orchestral', labelKo: '오케스트라' },
  { tag: 'cinematic', labelKo: '시네마틱' },
  { tag: 'gospel', labelKo: '가스펠' },
  { tag: 'bossanova', labelKo: '보사노바' },
  { tag: 'synth-pop', labelKo: '신스팝' },
  { tag: 'dream-pop', labelKo: '드림팝' },
];
