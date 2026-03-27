import { useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';

export function MusicDownloadPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const name = params.get('name') || 'music.mp3';
  const downloadUrl = `/api/music/download/${token}/${encodeURIComponent(name)}`;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-20 h-20 bg-[#F5F0EB] rounded-full flex items-center justify-center mb-6">
        <Download className="w-10 h-10 text-[#4A2C1A]" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2 text-center">{name}</h1>
      <p className="text-sm text-gray-500 mb-8 text-center">아래 버튼을 눌러 다운로드하세요</p>
      <a
        href={downloadUrl}
        download={name}
        className="w-full max-w-xs py-3 bg-[#4A2C1A] text-white text-center rounded-full font-medium text-lg"
      >
        다운로드
      </a>
    </div>
  );
}
