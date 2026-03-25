import { X } from 'lucide-react';

interface ColorPickerProps {
  onClose: () => void;
  onColorSelect: (color: string) => void;
  selectedColor?: string;
  keyboardHeight?: number;
}

// 10 columns x 6 rows = 60 colors with natural gradient
// Each row contains only colors from its designated color family
const colorPalette = [
  // Row 1: Pure grayscale (white to black)
  '#FFFFFF', '#E5E5E5', '#CCCCCC', '#B3B3B3', '#999999', '#808080', '#666666', '#4D4D4D', '#333333', '#000000',
  // Row 2: Light blue to medium blue (pure blue tones only)
  '#E3F2FD', '#BBDEFB', '#90CAF9', '#64B5F6', '#42A5F5', '#2196F3', '#1E88E5', '#1976D2', '#1565C0', '#0D47A1',
  // Row 3: Light purple (bright, desaturated) to medium purple (medium saturation) - pure purple tones only
  '#F3E5F5', '#E1BEE7', '#CE93D8', '#BA68C8', '#AB47BC', '#9C27B0', '#8E24AA', '#7B1FA2', '#6A1B9A', '#4A148C',
  // Row 4: Light pink to red (pure pink/red tones only)
  '#FCE4EC', '#F8BBD0', '#F48FB1', '#F06292', '#EC407A', '#E91E63', '#D81B60', '#C2185B', '#AD1457', '#B71C1C',
  // Row 5: Yellow to orange (pure yellow/orange tones only)
  '#FFFDE7', '#FFF9C4', '#FFF59D', '#FFF176', '#FFEE58', '#FFEB3B', '#FFC107', '#FFB300', '#FFA000', '#FF8F00',
  // Row 6: Light green to dark green (pure green tones only)
  '#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784', '#66BB6A', '#4CAF50', '#43A047', '#388E3C', '#2E7D32', '#1B5E20',
];

export function ColorPicker({ onClose, onColorSelect, selectedColor, keyboardHeight = 0 }: ColorPickerProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end animate-overlay-fade" onClick={onClose}>
      <div
        className="bg-gradient-to-b from-gray-200 to-gray-100 rounded-t-3xl w-full max-w-md mx-auto animate-modal-sheet"
        style={{ marginBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-b from-gray-300 to-gray-200 px-4 py-3 flex items-center justify-center rounded-t-3xl relative">
          <h2 className="text-lg font-semibold text-[#4A2C1A]">색상</h2>
          <button onClick={onClose} className="absolute right-4 text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Color Grid */}
        <div className="p-4" style={{ paddingBottom: keyboardHeight > 0 ? '16px' : 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="grid grid-cols-10 gap-0">
            {colorPalette.map((color) => (
              <button
                key={color}
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
