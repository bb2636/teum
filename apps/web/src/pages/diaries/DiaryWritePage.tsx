import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Type, Image as ImageIcon, Camera } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateDiary, useUpdateDiary, useDiary } from '@/hooks/useDiaries';
import { useUploadImage } from '@/hooks/useUpload';
import { useRandomQuestions } from '@/hooks/useQuestions';
import { FolderSelectModal } from './FolderSelectModal';
import { FormatMenu } from './FormatMenu';
import { ColorPicker } from './ColorPicker';
import { ExitConfirmModal } from './ExitConfirmModal';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getStorageImageSrc } from '@/lib/api';

type TextStyle = 'title' | 'header' | 'subheader' | 'body' | 'mono';
type FormatType = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'unorderedList' | 'orderedList';

const diarySchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  date: z.string().min(1, '날짜를 선택해주세요'),
  folderId: z.string().optional(),
  type: z.enum(['free_form', 'question_based']),
});

type DiaryFormData = z.infer<typeof diarySchema>;

export function DiaryWritePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEditMode = !!id;
  const queryClient = useQueryClient();

  // Load diary data if in edit mode
  const { data: existingDiary, isLoading: isLoadingDiary } = useDiary(id || '');

  const type = existingDiary?.type || (searchParams.get('type') as 'free_form' | 'question_based') || 'free_form';
  
  const createDiary = useCreateDiary();
  const updateDiary = useUpdateDiary();
  const uploadImage = useUploadImage();
  const { data: randomQuestions = [], isLoading: questionsLoading } = useRandomQuestions(3);
  
  // Invalidate random questions cache when page mounts to get fresh questions
  useEffect(() => {
    if (type === 'question_based') {
      queryClient.invalidateQueries({ queryKey: ['questions', 'random'] });
    }
  }, [type, queryClient]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileToUrlMap, setFileToUrlMap] = useState<Map<File, string>>(new Map()); // Track uploaded files
  const [selectedDate, setSelectedDate] = useState(
    searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')
  );
  const [uploading, setUploading] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [selectedTextStyle, setSelectedTextStyle] = useState<TextStyle>('body');
  const [activeFormats, setActiveFormats] = useState<Set<FormatType>>(new Set());
  const [textColor, setTextColor] = useState('#4A2C1A');
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: {},
    watch,
    reset,
  } = useForm<DiaryFormData>({
    resolver: zodResolver(diarySchema),
    defaultValues: {
      type,
      date: selectedDate,
      folderId: undefined, // No default folder - user must select
    },
  });

  // Load existing diary data when in edit mode
  useEffect(() => {
    if (isEditMode && existingDiary) {
      const diaryDate = format(new Date(existingDiary.date), 'yyyy-MM-dd');
      setSelectedDate(diaryDate);
      
      reset({
        title: '', // 제목 필드 제거
        content: existingDiary.content || '',
        type: existingDiary.type,
        date: diaryDate,
        folderId: existingDiary.folderId,
      });

      // Set contentEditable content
      if (contentEditableRef.current && existingDiary.content) {
        // 기존 내용이 순수 텍스트이므로 그대로 표시 (줄바꿈은 <br>로 변환)
        const textWithBreaks = existingDiary.content.replace(/\n/g, '<br>');
        contentEditableRef.current.innerHTML = textWithBreaks;
      }

      // Load images
      if (existingDiary.images && existingDiary.images.length > 0) {
        const imageUrls = existingDiary.images.map((img) => img.imageUrl);
        setSelectedImages(imageUrls);
      }

      // Load answers for question-based diaries
      if (existingDiary.type === 'question_based' && existingDiary.answers) {
        const answerMap: Record<string, string> = {};
        existingDiary.answers.forEach((answer) => {
          answerMap[answer.questionId] = answer.answer;
        });
        setAnswers(answerMap);
      }
    }
  }, [isEditMode, existingDiary, reset]);

  const selectedFolderId = watch('folderId');
  const content = watch('content');

  // HTML을 순수 텍스트로 변환 (줄바꿈 유지) - 함수를 먼저 정의
  const htmlToPlainText = (html: string): string => {
    if (!html) return '';
    
    // 임시 div 생성하여 HTML 파싱
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    
    // <br> 태그를 줄바꿈으로 변환
    tmp.querySelectorAll('br').forEach((br) => {
      br.replaceWith('\n');
    });
    
    // 모든 텍스트 추출 (줄바꿈 포함)
    let text = tmp.textContent || tmp.innerText || '';
    
    // 연속된 공백/줄바꿈 정리 (최대 2개 연속만 허용)
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/[ \t]{2,}/g, ' ');
    
    return text.trim();
  };

  // 스크롤 방지
  useEffect(() => {
    // 스크롤 방지
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.position = 'fixed';
    document.documentElement.style.width = '100%';
    document.documentElement.style.height = '100%';

    // cleanup: 페이지를 벗어날 때 스크롤 복원
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.position = '';
      document.documentElement.style.width = '';
      document.documentElement.style.height = '';
    };
  }, []);

  // Update contentEditable when form content changes
  useEffect(() => {
    if (contentEditableRef.current && content !== contentEditableRef.current.innerHTML) {
      // If content is HTML, use innerHTML; otherwise use innerText
      if (content && content.includes('<')) {
        contentEditableRef.current.innerHTML = content;
      } else {
        contentEditableRef.current.innerText = content || '';
      }
    }
  }, [content]);

  // Handle paste event - extract plain text only
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const clipboardData = e.clipboardData || (window as any).clipboardData;
    const pastedText = clipboardData.getData('text/plain');
    
    // Insert plain text at cursor position
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      // Create text node and insert
      const textNode = document.createTextNode(pastedText);
      range.insertNode(textNode);
      
      // Move cursor after inserted text
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else if (contentEditableRef.current) {
      // If no selection, append to end
      const textNode = document.createTextNode(pastedText);
      contentEditableRef.current.appendChild(textNode);
    }
    
    handleContentChange();
  };

  // Handle contentEditable changes
  const handleContentChange = () => {
    if (contentEditableRef.current) {
      // HTML을 순수 텍스트로 변환하여 저장
      const html = contentEditableRef.current.innerHTML;
      const plainText = htmlToPlainText(html);
      const event = {
        target: { value: plainText },
      } as React.ChangeEvent<HTMLInputElement>;
      register('content').onChange(event);
    }
  };

  // Enter 시 새 줄은 포맷 상속 없이 본문으로 시작
  const handleContentKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    document.execCommand('insertParagraph', false);
    // 새 블록을 본문(p)으로 고정
    document.execCommand('formatBlock', false, 'p');
    // 새 줄 인라인 포맷(굵게/기울임 등) 제거
    document.execCommand('removeFormat', false);
    handleContentChange();
  };

  // Format text functions - only applies to selected text
  const applyFormat = (format: FormatType) => {
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0) {
      // No selection, don't apply format
      return;
    }

    const range = selection.getRangeAt(0);
    
    // If collapsed selection (no text selected), don't apply
    if (range.collapsed && (format === 'bold' || format === 'italic' || format === 'underline' || format === 'strikethrough')) {
      return;
    }

    if (format === 'bold') {
      document.execCommand('bold', false);
    } else if (format === 'italic') {
      document.execCommand('italic', false);
    } else if (format === 'underline') {
      document.execCommand('underline', false);
    } else if (format === 'strikethrough') {
      document.execCommand('strikethrough', false);
    } else if (format === 'unorderedList') {
      document.execCommand('insertUnorderedList', false);
    } else if (format === 'orderedList') {
      document.execCommand('insertOrderedList', false);
    }
    updateActiveFormats();
    handleContentChange();
  };

  const applyTextStyle = (style: TextStyle) => {
    setSelectedTextStyle(style);
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // If no selection, apply to current cursor position (next text)
      return;
    }

    const range = selection.getRangeAt(0);
    
    // If collapsed selection (no text selected), don't apply
    if (range.collapsed) {
      return;
    }

    // Apply style to selected text only
    const styleConfig: Record<TextStyle, { tag: string; fontSize: string; className: string }> = {
      title: { tag: 'h1', fontSize: '24px', className: 'text-style-title' },
      header: { tag: 'h2', fontSize: '20px', className: 'text-style-header' },
      subheader: { tag: 'h3', fontSize: '18px', className: 'text-style-subheader' },
      body: { tag: 'p', fontSize: '16px', className: 'text-style-body' },
      mono: { tag: 'pre', fontSize: '14px', className: 'text-style-mono' },
    };

    const config = styleConfig[style];
    
    // Wrap selected text in a span with the style
    const span = document.createElement('span');
    span.className = config.className;
    span.style.fontSize = config.fontSize;
    
    try {
      range.surroundContents(span);
    } catch (e) {
      // If surroundContents fails, use formatBlock
      document.execCommand('formatBlock', false, config.tag);
    }
    
    handleContentChange();
  };

  const applyTextColor = (color: string) => {
    setTextColor(color);
    const selection = window.getSelection();
    
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // If text is selected, apply color to selected text only
      if (!range.collapsed) {
        // Apply color to selected text
        document.execCommand('foreColor', false, color);
      } else {
        // If no selection, set color for future text input only
        // Create a zero-width span with the color for next input
        const span = document.createElement('span');
        span.style.color = color;
        span.innerHTML = '\u200B'; // Zero-width space to maintain cursor position
        
        try {
          range.insertNode(span);
          // Move cursor after the span
          range.setStartAfter(span);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } catch (e) {
          // If insert fails, use execCommand which applies to next input
          document.execCommand('foreColor', false, color);
        }
      }
    } else {
      // No selection, set color for future text only
      document.execCommand('foreColor', false, color);
    }
    
    setShowColorPicker(false);
    handleContentChange();
  };

  const updateActiveFormats = () => {
    const formats = new Set<FormatType>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('strikethrough')) formats.add('strikethrough');
    setActiveFormats(formats);
  };

  const handleFormatToggle = (format: FormatType) => {
    applyFormat(format);
  };


  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    setSelectedFiles([...selectedFiles, ...newFiles]);

    // Create preview URLs immediately
    const previewUrls: string[] = [];
    newFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
    });
    setSelectedImages([...selectedImages, ...previewUrls]);
    
    // Upload images immediately and insert into content (only for free_form)
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const previewUrl = previewUrls[i];
      
      // Check if file is already uploaded
      if (fileToUrlMap.has(file)) {
        const uploadedUrl = fileToUrlMap.get(file)!;
        // Insert image into content only for free_form
        if (type === 'free_form') {
          insertImageIntoContentEditable(uploadedUrl);
        } else {
          // For question_based, replace blob URL with uploaded URL in selectedImages
          setSelectedImages((prev) => {
            const newImages = [...prev];
            const blobIndex = newImages.findIndex((url) => url === previewUrl);
            if (blobIndex !== -1) {
              newImages[blobIndex] = uploadedUrl;
              URL.revokeObjectURL(previewUrl); // Clean up blob URL
            }
            return newImages;
          });
        }
        continue;
      }
      
      try {
        // Upload image
        const uploadedUrl = await uploadImage.mutateAsync(file);
        
        // Track uploaded file
        setFileToUrlMap((prev) => {
          const newMap = new Map(prev);
          newMap.set(file, uploadedUrl);
          return newMap;
        });
        
        // Insert image into content only for free_form
        if (type === 'free_form') {
          // Insert img tag into contentEditable
          insertImageIntoContentEditable(uploadedUrl);
        } else {
          // For question_based, replace blob URL with uploaded URL in selectedImages
          setSelectedImages((prev) => {
            const newImages = [...prev];
            const blobIndex = newImages.findIndex((url) => url === previewUrl);
            if (blobIndex !== -1) {
              newImages[blobIndex] = uploadedUrl;
              URL.revokeObjectURL(previewUrl); // Clean up blob URL
            }
            return newImages;
          });
        }
      } catch (error) {
        console.error('Failed to upload image:', error);
        // Keep preview URL even if upload fails
      }
    }
    
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const insertImageIntoContentEditable = (imageUrl: string) => {
    if (!contentEditableRef.current) return;
    
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    
    // Create img element
    const img = document.createElement('img');
    img.src = getStorageImageSrc(imageUrl);
    img.alt = 'Uploaded image';
    img.className = 'max-w-full h-auto rounded-lg my-2';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.display = 'block';
    img.style.margin = '8px 0';
    
    // Insert image at cursor position or at the end
    if (range && !range.collapsed) {
      range.deleteContents();
      range.insertNode(img);
    } else {
      // Insert at cursor or at the end
      if (range) {
        range.insertNode(img);
        // Move cursor after image
        range.setStartAfter(img);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
      } else {
        // Append at the end
        contentEditableRef.current.appendChild(img);
        // Add a line break after image
        const br = document.createElement('br');
        contentEditableRef.current.appendChild(br);
      }
    }
    
    // Update content
    handleContentChange();
  };


  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleSaveClick = () => {
    // Show folder selection modal before saving
    setShowFolderModal(true);
  };

  const handleFolderSelect = (folderId: string) => {
    setShowFolderModal(false);
    // Update form with selected folder
    const event = {
      target: { value: folderId },
    } as React.ChangeEvent<HTMLInputElement>;
    register('folderId').onChange(event);
    // Submit diary with selected folder
    setTimeout(() => {
      submitDiary(folderId);
    }, 100);
  };


  const submitDiary = async (folderId?: string) => {
    try {
      setUploading(true);

      const formData = watch();

      // Collect all uploaded image URLs
      const imageUrls: string[] = [];
      
      // For free_form: collect from contentEditable
      if (type === 'free_form') {
        // Extract image URLs from contentEditable
        if (contentEditableRef.current) {
          const images = contentEditableRef.current.querySelectorAll('img');
          images.forEach((img) => {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('blob:')) {
              // Extract URL from src (remove /api/storage/ prefix if present)
              const url = src.replace(/^.*\/api\/storage\//, '/storage/');
              if (!imageUrls.includes(url)) {
                imageUrls.push(url);
              }
            }
          });
        }
      } else {
        // For question_based: collect from selectedImages (uploaded URLs)
        // Images are shown as thumbnails at the bottom, not in content
        selectedImages.forEach((url) => {
          // Only include uploaded URLs (not blob URLs)
          if (!url.startsWith('blob:')) {
            if (!imageUrls.includes(url)) {
              imageUrls.push(url);
            }
          }
        });
      }
      
      // Upload any remaining files that haven't been uploaded yet
      for (const file of selectedFiles) {
        // Check if file is already uploaded
        if (fileToUrlMap.has(file)) {
          const url = fileToUrlMap.get(file)!;
          if (!imageUrls.includes(url)) {
            imageUrls.push(url);
          }
          continue;
        }
        
        try {
          const url = await uploadImage.mutateAsync(file);
          // Track uploaded file
          setFileToUrlMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(file, url);
            return newMap;
          });
          if (!imageUrls.includes(url)) {
            imageUrls.push(url);
          }
        } catch (error) {
          console.error('Failed to upload image:', error);
          // Continue with other images even if one fails
        }
      }

      // Prepare answers for question-based diary
      const answerArray =
        type === 'question_based' && randomQuestions.length > 0
          ? randomQuestions
              .filter((q) => answers[q.id] && answers[q.id].trim())
              .map((q) => ({
                questionId: q.id,
                answer: answers[q.id],
              }))
          : undefined;

      // Get latest content from contentEditable for free_form type and convert to plain text
      let finalContent = formData.content;
      if (type === 'free_form' && contentEditableRef.current) {
        const rawContent = contentEditableRef.current.innerHTML;
        finalContent = htmlToPlainText(rawContent);
      }

      const diaryData = {
        ...formData,
        title: '', // 제목 필드 제거
        content: finalContent,
        folderId: folderId || formData.folderId,
        date: selectedDate,
        imageUrls,
        answers: answerArray,
      };

      if (isEditMode && id) {
        // Update existing diary
        const updatedDiary = await updateDiary.mutateAsync({
          id,
          ...diaryData,
        });

        // Clean up object URLs
        selectedImages.forEach((url) => URL.revokeObjectURL(url));

        navigate(`/diaries/${updatedDiary.id}`);
      } else {
        // Create new diary
        const newDiary = await createDiary.mutateAsync(diaryData);

        // Clean up object URLs
        selectedImages.forEach((url) => URL.revokeObjectURL(url));

        navigate(`/diaries/${newDiary.id}`);
      }
    } catch (error) {
      console.error('Failed to create diary:', error);
      alert('일기 저장에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (data: DiaryFormData) => {
    // If folder is already selected, save directly
    if (data.folderId) {
      await submitDiary(data.folderId);
    } else {
      // Otherwise show folder selection modal
      setShowFolderModal(true);
    }
  };

  const dateObj = new Date(selectedDate);
  const formattedDate = format(dateObj, 'M월 d일 (E)', { locale: ko });

  const handleBackClick = () => {
    setShowExitConfirm(true);
  };

  const handleExitConfirm = () => {
    setShowExitConfirm(false);
    navigate(-1);
  };

  // Free Form Diary - Note style
  // Show loading state when editing and diary is loading
  if (isEditMode && isLoadingDiary) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="text-muted-foreground">일기를 불러오는 중...</div>
      </div>
    );
  }

  if (type === 'free_form') {
    return (
      <div className="min-h-screen bg-[#F5F5F0] pb-20 overflow-hidden" style={{ touchAction: 'none' }}>
        <div className="max-w-md mx-auto h-screen flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
            <button onClick={handleBackClick} className="p-2">
              <ArrowLeft className="w-5 h-5 text-[#4A2C1A]" />
            </button>
            <h1 className="text-base font-medium text-[#4A2C1A]">{formattedDate}</h1>
            <button
              onClick={handleSaveClick}
              disabled={uploading || createDiary.isPending}
              className="p-2"
            >
              <Check className="w-5 h-5 text-[#4A2C1A]" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col">
            {/* Note-style content area */}
            <div 
              className="flex-1 mx-4 my-4 rounded-lg shadow-sm p-4 relative overflow-hidden bg-white"
              style={{
                backgroundImage: 'url(/note.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              <div
                ref={contentEditableRef}
                contentEditable
                onInput={handleContentChange}
                onPaste={handlePaste}
                onKeyDown={handleContentKeyDown}
                onBlur={updateActiveFormats}
                onFocus={updateActiveFormats}
                onSelect={updateActiveFormats}
                data-placeholder="글쓰기 시작..."
                className="relative z-10 w-full h-full resize-none outline-none bg-transparent overflow-y-auto min-h-[200px] [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-medium [&_p]:text-base [&_pre]:text-sm [&_pre]:font-mono"
                style={{ 
                  color: '#4A2C1A', // Default color, individual spans will have their own colors
                  lineHeight: '1.5em',
                  fontSize: '16px', // Default font size, individual elements will have their own sizes
                }}
              />
            </div>

            {/* 선택한 이미지 미리보기 (blob 또는 스토리지 URL 모두 표시) */}
            {selectedImages.length > 0 && (
              <div className="mx-4 mb-2 flex gap-2 overflow-x-auto pb-2">
                {selectedImages.map((url, i) => (
                  <img
                    key={`${url}-${i}`}
                    src={url.startsWith('blob:') ? url : getStorageImageSrc(url)}
                    alt={`미리보기 ${i + 1}`}
                    className="h-20 w-20 flex-shrink-0 rounded-lg object-cover border border-gray-200"
                    loading="eager"
                  />
                ))}
              </div>
            )}

            {/* Toolbar */}
            <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => setShowFormatMenu(true)}
                className="cursor-pointer"
              >
                <Type className="w-6 h-6 text-gray-600" />
              </button>
              <button
                type="button"
                onClick={handleCameraClick}
                className="cursor-pointer"
              >
                <Camera className="w-6 h-6 text-gray-600" />
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                className="hidden"
              />
              <label className="cursor-pointer">
                <ImageIcon className="w-6 h-6 text-gray-600" />
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            </div>
          </form>

          {/* Format Menu */}
          {showFormatMenu && (
            <FormatMenu
              onClose={() => setShowFormatMenu(false)}
              onStyleSelect={applyTextStyle}
              onFormatToggle={handleFormatToggle}
              onColorSelect={() => setShowColorPicker(true)}
              selectedStyle={selectedTextStyle}
              activeFormats={activeFormats}
              textColor={textColor}
            />
          )}

          {/* Color Picker */}
          {showColorPicker && (
            <ColorPicker
              onClose={() => setShowColorPicker(false)}
              onColorSelect={applyTextColor}
              selectedColor={textColor}
            />
          )}

          {/* Folder Selection Modal */}
          {showFolderModal && (
            <FolderSelectModal
              selectedFolderId={selectedFolderId}
              onSelect={handleFolderSelect}
              onClose={() => setShowFolderModal(false)}
            />
          )}

          {/* Exit Confirm Modal */}
          {showExitConfirm && (
            <ExitConfirmModal
              onClose={() => setShowExitConfirm(false)}
              onConfirm={handleExitConfirm}
            />
          )}
        </div>
      </div>
    );
  }

  // Question-based Diary - 2번 이미지 스타일
  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24 overflow-hidden relative" style={{ touchAction: 'none' }}>
      <div className="max-w-md mx-auto h-screen flex flex-col overflow-hidden relative">
        {/* Header - 2번: 원형 뒤로가기, 중앙 날짜, 체크 저장 */}
        <div className="flex items-center justify-between px-4 py-3 bg-white">
          <button
            onClick={handleBackClick}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#4A2C1A]" />
          </button>
          <h1 className="text-lg font-medium text-[#4A2C1A]">{formattedDate}</h1>
          <button
            onClick={handleSaveClick}
            disabled={uploading || createDiary.isPending}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <Check className="w-5 h-5 text-[#4A2C1A]" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
          {/* 질문 영역 - 목록/확장 뷰 전환 */}
          <div className="flex-1 flex flex-col overflow-hidden px-4 py-5">
            {questionsLoading ? (
              <div className="text-center py-8 text-gray-500">질문을 불러오는 중...</div>
            ) : randomQuestions.length > 0 ? (
              // 3개 질문 카드: 클릭한 카드만 인라인으로 확장
              <div className="space-y-4 overflow-y-auto">
                {randomQuestions.map((question) => (
                  <div
                    key={question.id}
                    className={`w-full text-left bg-white rounded-2xl shadow-sm border border-gray-100 transition-all ${
                      expandedQuestionId === question.id ? 'p-5 flex flex-col' : 'p-4'
                    }`}
                    style={
                      expandedQuestionId === question.id
                        ? { minHeight: 'min(80vw, 420px)' }
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        setExpandedQuestionId(
                          expandedQuestionId === question.id ? null : question.id
                        );
                      }}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[#4A2C1A] font-medium flex-1">{question.question}</p>
                      </div>
                      {expandedQuestionId !== question.id && (
                        <div className="space-y-2">
                          {answers[question.id]?.trim() && (
                            <p className="text-gray-400 text-sm truncate">
                              {answers[question.id].trim()}
                            </p>
                          )}
                          {!answers[question.id]?.trim() && (
                            <p className="text-gray-400 text-sm">글쓰기 시작...</p>
                          )}
                        </div>
                      )}
                    </button>
                    {expandedQuestionId === question.id && (
                      <>
                        <textarea
                          id={`answer-${question.id}`}
                          value={answers[question.id] || ''}
                          onChange={(e) =>
                            setAnswers((prev) => ({
                              ...prev,
                              [question.id]: e.target.value,
                            }))
                          }
                          onClick={(e) => e.stopPropagation()}
                          placeholder="글쓰기 시작..."
                          className="flex-1 w-full min-h-[200px] mt-3 bg-transparent resize-none focus:outline-none text-[#4A2C1A] placeholder:text-gray-400 text-base overflow-y-auto"
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-100 rounded-2xl p-6">
                <p className="text-sm text-gray-500">사용 가능한 질문이 없습니다</p>
              </div>
            )}
          </div>

          {/* 선택한 이미지 미리보기 (질문기록, blob 또는 스토리지 URL 모두 표시) */}
          {selectedImages.length > 0 && (
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
              {selectedImages.map((url, i) => (
                <img
                  key={`${url}-${i}`}
                  src={url.startsWith('blob:') ? url : getStorageImageSrc(url)}
                  alt={`미리보기 ${i + 1}`}
                  className="h-16 w-16 flex-shrink-0 rounded-lg object-cover border border-gray-200"
                  loading="eager"
                />
              ))}
            </div>
          )}

          {/* 포맷 툴바 - 2번: 둥근 모서리 플로팅 스타일 */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 mx-4 bg-white rounded-full shadow-lg px-6 py-3 flex items-center justify-center gap-8">
            <button
              type="button"
              onClick={() => setShowFormatMenu(true)}
              className="cursor-pointer p-1"
            >
              <Type className="w-6 h-6 text-gray-600" />
            </button>
            <button type="button" onClick={handleCameraClick} className="cursor-pointer p-1">
              <Camera className="w-6 h-6 text-gray-600" />
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
            />
            <label className="cursor-pointer p-1">
              <ImageIcon className="w-6 h-6 text-gray-600" />
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </label>
          </div>
        </form>
      </div>

      {/* Format Menu for question-based */}
      {showFormatMenu && (
        <FormatMenu
          onClose={() => setShowFormatMenu(false)}
          onStyleSelect={applyTextStyle}
          onFormatToggle={handleFormatToggle}
          onColorSelect={() => setShowColorPicker(true)}
          selectedStyle={selectedTextStyle}
          activeFormats={activeFormats}
          textColor={textColor}
        />
      )}

      {showColorPicker && (
        <ColorPicker
          onClose={() => setShowColorPicker(false)}
          onColorSelect={applyTextColor}
          selectedColor={textColor}
        />
      )}

      {/* Folder Selection Modal */}
      {showFolderModal && (
        <FolderSelectModal
          selectedFolderId={selectedFolderId}
          onSelect={handleFolderSelect}
          onClose={() => setShowFolderModal(false)}
        />
      )}

      {/* Exit Confirm Modal */}
      {showExitConfirm && (
        <ExitConfirmModal
          onClose={() => setShowExitConfirm(false)}
          onConfirm={handleExitConfirm}
        />
      )}
    </div>
  );
}
