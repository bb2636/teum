import { X, List, ListOrdered } from 'lucide-react';
import { t } from '@/lib/i18n';

type TextStyle = 'title' | 'header' | 'subheader' | 'body' | 'mono';
type FormatType = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'unorderedList' | 'orderedList';

interface FormatMenuProps {
  onClose: () => void;
  onStyleSelect: (style: TextStyle) => void;
  onFormatToggle: (format: FormatType) => void;
  onColorSelect: () => void;
  selectedStyle?: TextStyle;
  activeFormats: Set<FormatType>;
  textColor?: string;
  isKeyboardOpen?: boolean;
}

export function FormatMenu({
  onClose,
  onStyleSelect,
  onFormatToggle,
  onColorSelect,
  selectedStyle,
  activeFormats,
  textColor = '#4A2C1A',
  isKeyboardOpen = false,
}: FormatMenuProps) {
  const textStyles: { value: TextStyle; labelKey: string }[] = [
    { value: 'title', labelKey: 'diary.styleTitle' },
    { value: 'header', labelKey: 'diary.styleHeader' },
    { value: 'subheader', labelKey: 'diary.styleSubheader' },
    { value: 'body', labelKey: 'diary.styleBody' },
    { value: 'mono', labelKey: 'diary.styleMono' },
  ];

  const preventBlur = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="shrink-0 w-full z-50"
      style={{ backgroundColor: '#D1D1D6' }}
      onPointerDown={preventBlur}
    >
      <div className="w-full max-w-md mx-auto">
        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <span className="text-[15px] font-medium text-black">{t('diary.formatTitle')}</span>
          <button onClick={onClose} className="w-[30px] h-[30px] flex items-center justify-center rounded-full bg-black/10">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="px-4 pt-2 space-y-3" style={{ paddingBottom: isKeyboardOpen ? '12px' : 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 min-w-max items-center">
              {textStyles.map((style) => (
                <button
                  key={style.value}
                  onPointerDown={preventBlur}
                  onClick={() => onStyleSelect(style.value)}
                  className={`px-4 py-[6px] rounded-md text-[15px] font-medium transition-colors whitespace-nowrap ${
                    selectedStyle === style.value
                      ? 'bg-white/60 text-black border border-gray-400'
                      : 'text-black/70'
                  }`}
                >
                  {t(style.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg overflow-hidden flex" style={{ backgroundColor: '#C7C7CC' }}>
            <button
              onPointerDown={preventBlur}
              onClick={() => onFormatToggle('bold')}
              className={`flex-1 py-[10px] text-[16px] font-bold transition-colors ${
                activeFormats.has('bold')
                  ? 'bg-gray-400/80 text-black'
                  : 'bg-white text-black'
              }`}
            >
              B
            </button>
            <div className="w-[1px]" style={{ backgroundColor: '#C7C7CC' }} />
            <button
              onPointerDown={preventBlur}
              onClick={() => onFormatToggle('italic')}
              className={`flex-1 py-[10px] text-[16px] italic transition-colors ${
                activeFormats.has('italic')
                  ? 'bg-gray-400/80 text-black'
                  : 'bg-white text-black'
              }`}
            >
              I
            </button>
            <div className="w-[1px]" style={{ backgroundColor: '#C7C7CC' }} />
            <button
              onPointerDown={preventBlur}
              onClick={() => onFormatToggle('underline')}
              className={`flex-1 py-[10px] text-[16px] underline transition-colors ${
                activeFormats.has('underline')
                  ? 'bg-gray-400/80 text-black'
                  : 'bg-white text-black'
              }`}
            >
              U
            </button>
            <div className="w-[1px]" style={{ backgroundColor: '#C7C7CC' }} />
            <button
              onPointerDown={preventBlur}
              onClick={() => onFormatToggle('strikethrough')}
              className={`flex-1 py-[10px] text-[16px] line-through transition-colors ${
                activeFormats.has('strikethrough')
                  ? 'bg-gray-400/80 text-black'
                  : 'bg-white text-black'
              }`}
            >
              T
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="rounded-lg overflow-hidden flex" style={{ backgroundColor: '#C7C7CC', width: 'calc(50% - 0.25rem)' }}>
              <button
                onPointerDown={preventBlur}
                onClick={() => onFormatToggle('orderedList')}
                className={`flex-1 py-[10px] flex items-center justify-center transition-colors ${
                  activeFormats.has('orderedList')
                    ? 'bg-gray-400/80 text-black'
                    : 'bg-white text-black'
                }`}
              >
                <ListOrdered className="w-5 h-5" />
              </button>
              <div className="w-[1px]" style={{ backgroundColor: '#C7C7CC' }} />
              <button
                onPointerDown={preventBlur}
                onClick={() => onFormatToggle('unorderedList')}
                className={`flex-1 py-[10px] flex items-center justify-center transition-colors ${
                  activeFormats.has('unorderedList')
                    ? 'bg-gray-400/80 text-black'
                    : 'bg-white text-black'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
            <button
              onPointerDown={preventBlur}
              onClick={() => {
                onClose();
                onColorSelect();
              }}
              className="w-9 h-9 rounded-full border-2 border-white/80 flex-shrink-0 shadow-sm"
              style={{ backgroundColor: textColor }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
