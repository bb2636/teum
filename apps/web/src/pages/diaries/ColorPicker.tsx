import { X } from 'lucide-react';

interface ColorPickerProps {
  onClose: () => void;
  onColorSelect: (color: string) => void;
  selectedColor?: string;
  keyboardHeight?: number;
}

const colorPalette = [
  '#FFFFFF', '#E5E5E5', '#CCCCCC', '#B3B3B3', '#999999', '#808080', '#666666', '#4D4D4D', '#333333', '#000000',
  '#E3F2FD', '#BBDEFB', '#90CAF9', '#64B5F6', '#42A5F5', '#2196F3', '#1E88E5', '#1976D2', '#1565C0', '#0D47A1',
  '#F3E5F5', '#E1BEE7', '#CE93D8', '#BA68C8', '#AB47BC', '#9C27B0', '#8E24AA', '#7B1FA2', '#6A1B9A', '#4A148C',
  '#FCE4EC', '#F8BBD0', '#F48FB1', '#F06292', '#EC407A', '#E91E63', '#D81B60', '#C2185B', '#AD1457', '#B71C1C',
  '#FFFDE7', '#FFF9C4', '#FFF59D', '#FFF176', '#FFEE58', '#FFEB3B', '#FFC107', '#FFB300', '#FFA000', '#FF8F00',
  '#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784', '#66BB6A', '#4CAF50', '#43A047', '#388E3C', '#2E7D32', '#1B5E20',
];

export function ColorPicker({ onClose, onColorSelect, selectedColor, keyboardHeight = 0 }: ColorPickerProps) {
  const preventBlur = (e: React.PointerEvent | React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="fixed left-0 right-0 z-50"
      style={{ bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0px' }}
      onPointerDown={preventBlur}
    >
      <div
        className="bg-gradient-to-b from-gray-200 to-gray-100 rounded-t-3xl w-full max-w-md mx-auto animate-modal-sheet"
      >
        <div className="sticky top-0 bg-gradient-to-b from-gray-300 to-gray-200 px-4 py-3 flex items-center justify-center rounded-t-3xl relative">
          <h2 className="text-lg font-semibold text-[#4A2C1A]">색상</h2>
          <button onClick={onClose} className="absolute right-4 text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4" style={{ paddingBottom: keyboardHeight > 0 ? '16px' : 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="grid grid-cols-10 gap-0">
            {colorPalette.map((color) => (
              <button
                key={color}
                onPointerDown={preventBlur}
                onClick={() => onColorSelect(color)}
                className={`aspect-square transition-all ${
                  selectedColor === color
                    ? 'border-2 border-white scale-105 shadow-md z-10 relative'
                    : 'border-0 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: color,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
