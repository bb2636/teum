import { X, List, ListOrdered } from 'lucide-react';

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
}

export function FormatMenu({
  onClose,
  onStyleSelect,
  onFormatToggle,
  onColorSelect,
  selectedStyle,
  activeFormats,
  textColor = '#4A2C1A',
}: FormatMenuProps) {
  const textStyles: { value: TextStyle; label: string; fontSize: string }[] = [
    { value: 'title', label: '제목', fontSize: 'text-2xl' },
    { value: 'header', label: '머리말', fontSize: 'text-xl' },
    { value: 'subheader', label: '부머리말', fontSize: 'text-lg' },
    { value: 'body', label: '본문', fontSize: 'text-base' },
    { value: 'mono', label: '모노 스타', fontSize: 'text-sm' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end animate-overlay-fade" onClick={onClose}>
      <div
        className="bg-gray-200 rounded-t-3xl w-full max-w-md mx-auto animate-modal-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-200 border-b border-gray-300 px-4 py-3 flex items-center justify-between rounded-t-3xl">
          <h2 className="text-lg font-semibold text-[#4A2C1A]">포맷</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Text Styles - Horizontal Scroll */}
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-1 min-w-max items-center">
              {textStyles.map((style) => (
                <button
                  key={style.value}
                  onClick={() => onStyleSelect(style.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${style.fontSize} ${
                    selectedStyle === style.value
                      ? 'bg-gray-300 text-[#4A2C1A]'
                      : 'bg-gray-100 text-[#4A2C1A] hover:bg-gray-200'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Formatting - B, I, U, T in one row with dividers */}
          <div className="bg-gray-300 rounded-lg p-2 flex gap-0" id="text-format-container">
            <button
              onClick={() => onFormatToggle('bold')}
              className={`flex-1 py-2 text-sm font-medium transition-colors border-r border-gray-400 first:rounded-l-lg ${
                activeFormats.has('bold')
                  ? 'bg-gray-400 text-[#4A2C1A]'
                  : 'bg-white text-[#4A2C1A] hover:bg-gray-200'
              }`}
            >
              B
            </button>
            <button
              onClick={() => onFormatToggle('italic')}
              className={`flex-1 py-2 text-sm font-medium italic transition-colors border-r border-gray-400 ${
                activeFormats.has('italic')
                  ? 'bg-gray-400 text-[#4A2C1A]'
                  : 'bg-white text-[#4A2C1A] hover:bg-gray-200'
              }`}
            >
              I
            </button>
            <button
              onClick={() => onFormatToggle('underline')}
              className={`flex-1 py-2 text-sm font-medium underline transition-colors border-r border-gray-400 ${
                activeFormats.has('underline')
                  ? 'bg-gray-400 text-[#4A2C1A]'
                  : 'bg-white text-[#4A2C1A] hover:bg-gray-200'
              }`}
            >
              U
            </button>
            <button
              onClick={() => onFormatToggle('strikethrough')}
              className={`flex-1 py-2 text-sm font-medium line-through transition-colors last:rounded-r-lg ${
                activeFormats.has('strikethrough')
                  ? 'bg-gray-400 text-[#4A2C1A]'
                  : 'bg-white text-[#4A2C1A] hover:bg-gray-200'
              }`}
            >
              T
            </button>
          </div>

          {/* List Formatting and Color Picker in one row */}
          <div className="flex items-center justify-between">
            {/* List Formatting - Left side, 2 buttons with divider, half width of B/I/U/T container */}
            <div className="bg-gray-300 rounded-lg p-2 flex gap-0" style={{ width: 'calc(50% - 0.25rem)' }}>
              <button
                onClick={() => onFormatToggle('orderedList')}
                className={`flex-1 py-2 flex items-center justify-center transition-colors border-r border-gray-400 first:rounded-l-lg ${
                  activeFormats.has('orderedList')
                    ? 'bg-gray-400 text-[#4A2C1A]'
                    : 'bg-white text-[#4A2C1A] hover:bg-gray-200'
                }`}
              >
                <ListOrdered className="w-5 h-5" />
              </button>
              <button
                onClick={() => onFormatToggle('unorderedList')}
                className={`flex-1 py-2 flex items-center justify-center transition-colors last:rounded-r-lg ${
                  activeFormats.has('unorderedList')
                    ? 'bg-gray-400 text-[#4A2C1A]'
                    : 'bg-white text-[#4A2C1A] hover:bg-gray-200'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
            {/* Color Picker - Right side, separate from list buttons */}
            <button
              onClick={() => {
                onClose();
                onColorSelect();
              }}
              className="w-8 h-8 rounded-full border-2 border-white flex-shrink-0"
              style={{ backgroundColor: textColor }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
