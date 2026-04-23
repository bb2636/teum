import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Type, Image as ImageIcon, Camera, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateDiary, useUpdateDiary, useDiary, useDiaryCount } from '@/hooks/useDiaries';
import { useUploadImage } from '@/hooks/useUpload';
import { useSubscriptions, getEffectiveSubscription } from '@/hooks/usePayment';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { useRandomQuestions } from '@/hooks/useQuestions';
import { FolderSelectModal } from './FolderSelectModal';
import { FormatMenu } from './FormatMenu';
import { ColorPicker } from './ColorPicker';
import { ExitConfirmModal } from './ExitConfirmModal';
import { TitleSuggestionModal } from './TitleSuggestionModal';
import { AdModal } from '@/components/AdModal';
import { apiRequest } from '@/lib/api';
import { format } from 'date-fns';
import { getDateLocale } from '@/lib/dateFnsLocale';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '@/contexts/ThemeContext';
import { getStorageImageSrc } from '@/lib/api';
import { useT } from '@/hooks/useTranslation';
import { Toast } from '@/components/Toast';

type TextStyle = 'title' | 'header' | 'subheader' | 'body' | 'mono';
type FormatType = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'unorderedList' | 'orderedList';

const diarySchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  date: z.string().min(1),
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
  const { data: subscriptions = [] } = useSubscriptions();
  const { data: diaryCount = 0 } = useDiaryCount();
  const activeSubscription = getEffectiveSubscription(subscriptions);
  const { data: randomQuestions = [], isLoading: questionsLoading } = useRandomQuestions(3);
  const [showAdModal, setShowAdModal] = useState(false);
  const [pendingFolderId, setPendingFolderId] = useState<string | undefined>(undefined);
  
  // Invalidate random questions cache when page mounts to get fresh questions (only for new diaries)
  useEffect(() => {
    if (type === 'question_based' && !isEditMode) {
      queryClient.invalidateQueries({ queryKey: ['questions', 'random'] });
    }
  }, [type, queryClient, isEditMode]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const editQuestions = useMemo(() => {
    if (isEditMode && existingDiary?.type === 'question_based' && existingDiary.answers) {
      return existingDiary.answers.map((a) => ({
        id: a.questionId,
        question: a.question?.question || t('diary.deletedQuestion'),
      }));
    }
    return [];
  }, [isEditMode, existingDiary]);

  const activeQuestions = isEditMode ? editQuestions : randomQuestions;
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileToUrlMap, setFileToUrlMap] = useState<Map<File, string>>(new Map());
  const [uploadErrorToast, setUploadErrorToast] = useState(false);
  const t = useT();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const defaultTextColor = isDark ? '#FFFFFF' : '#4A2C1A';
  const [selectedDate, setSelectedDate] = useState(
    searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')
  );
  const [uploading, setUploading] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showContentRequired, setShowContentRequired] = useState<string | null>(null);
  const [selectedTextStyle, setSelectedTextStyle] = useState<TextStyle>('body');
  const [activeFormats, setActiveFormats] = useState<Set<FormatType>>(new Set());
  const [textColor, setTextColor] = useState(defaultTextColor);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const isUserInputRef = useRef(false);
  const isInitializingRef = useRef(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const isIOS = Capacitor.getPlatform() === 'ios' || /iPhone|iPad|iPod/.test(navigator.userAgent);
  const savedSelectionRef = useRef<Range | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
      setShowExitConfirm(true);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    let backButtonListener: Promise<{ remove: () => void }> | null = null;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        backButtonListener = App.addListener('backButton', () => {
          setShowExitConfirm(true);
        });
      });
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (backButtonListener) {
        backButtonListener.then?.((l) => l.remove?.());
      }
    };
  }, []);

  const {
    register,
    handleSubmit,
    formState: {},
    watch,
    reset,
    setValue,
  } = useForm<DiaryFormData>({
    resolver: zodResolver(diarySchema),
    defaultValues: {
      type,
      date: selectedDate,
      folderId: undefined,
    },
  });

  // Load existing diary data when in edit mode
  useEffect(() => {
    if (isEditMode && existingDiary) {
      const diaryDate = format(new Date(existingDiary.date), 'yyyy-MM-dd');
      setSelectedDate(diaryDate);
      
      reset({
        title: existingDiary.title || '',
        content: existingDiary.content || '',
        type: existingDiary.type,
        date: diaryDate,
        folderId: existingDiary.folderId,
      });

      // Set contentEditable content and restore images
      if (contentEditableRef.current) {
        isInitializingRef.current = true;
        const textWithBreaks = existingDiary.content
          ? existingDiary.content.replace(/\n/g, '<br>')
          : '';
        contentEditableRef.current.innerHTML = textWithBreaks;

        if (
          existingDiary.type === 'free_form' &&
          existingDiary.images &&
          existingDiary.images.length > 0
        ) {
          existingDiary.images.forEach((img) => {
            insertImageIntoContentEditable(img.imageUrl);
          });
        }
        setTimeout(() => {
          isInitializingRef.current = false;
        }, 0);
      }

      // Load images for question_based (thumbnail display)
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

  useEffect(() => {
    if (keyboardHeight > 0) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, [keyboardHeight]);

  useEffect(() => {
    let cleanups: (() => void)[] = [];
    let unmounted = false;

    if (Capacitor.isNativePlatform()) {
      let pluginWorking = false;
      import('@capacitor/keyboard').then(({ Keyboard }) => {
        if (unmounted) return;
        const showP = Keyboard.addListener('keyboardWillShow', (info) => {
          pluginWorking = true;
          setKeyboardHeight(info.keyboardHeight);
        });
        const hideP = Keyboard.addListener('keyboardWillHide', () => {
          setKeyboardHeight(0);
        });
        cleanups.push(() => {
          showP.then?.((h) => h.remove());
          hideP.then?.((h) => h.remove());
        });
      }).catch(() => {});

      const vv = window.visualViewport;
      if (vv) {
        let lastKbHeight = 0;
        const handleViewport = () => {
          if (pluginWorking) return;
          const kbHeight = window.innerHeight - vv.height;
          const newHeight = kbHeight > 50 ? kbHeight : 0;
          if (newHeight !== lastKbHeight) {
            lastKbHeight = newHeight;
            setKeyboardHeight(newHeight);
          }
        };
        vv.addEventListener('resize', handleViewport);
        vv.addEventListener('scroll', handleViewport);
        cleanups.push(() => {
          vv.removeEventListener('resize', handleViewport);
          vv.removeEventListener('scroll', handleViewport);
        });
      }

      return () => { unmounted = true; cleanups.forEach(fn => fn()); };
    }

    const vv = window.visualViewport;
    if (vv) {
      let lastKbHeight = 0;
      const handleViewport = () => {
        const kbHeight = window.innerHeight - vv.height;
        const newHeight = kbHeight > 50 ? kbHeight : 0;
        if (newHeight !== lastKbHeight) {
          lastKbHeight = newHeight;
          setKeyboardHeight(newHeight);
        }
      };

      vv.addEventListener('resize', handleViewport);
      vv.addEventListener('scroll', handleViewport);

      return () => {
        vv.removeEventListener('resize', handleViewport);
        vv.removeEventListener('scroll', handleViewport);
      };
    }

    let focusTimer: ReturnType<typeof setTimeout>;
    const handleFocusIn = () => {
      focusTimer = setTimeout(() => {
        const diff = window.innerHeight - (window.visualViewport?.height ?? window.innerHeight);
        setKeyboardHeight(diff > 50 ? diff : 0);
      }, 300);
    };
    const handleFocusOut = () => {
      clearTimeout(focusTimer);
      setKeyboardHeight(0);
    };
    window.addEventListener('resize', handleFocusIn);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('resize', handleFocusIn);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Update contentEditable when form content changes (only for external/programmatic changes)
  useEffect(() => {
    if (isUserInputRef.current) {
      isUserInputRef.current = false;
      return;
    }
    if (isInitializingRef.current) {
      return;
    }
    if (contentEditableRef.current && content !== contentEditableRef.current.innerHTML) {
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
    
    const clipboardData = e.clipboardData || (window as unknown as { clipboardData?: DataTransfer }).clipboardData;
    if (!clipboardData) return;
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
      isUserInputRef.current = true;
      const html = contentEditableRef.current.innerHTML;
      const plainText = htmlToPlainText(html);
      const event = {
        target: { value: plainText },
      } as React.ChangeEvent<HTMLInputElement>;
      register('content').onChange(event);
    }
  };

  const handleContentKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return;

    const isInList =
      document.queryCommandState('insertOrderedList') ||
      document.queryCommandState('insertUnorderedList');

    if (isInList) {
      handleContentChange();
      return;
    }

    const sel = window.getSelection();
    let currentBlock = '';
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.getRangeAt(0).startContainer;
      while (node && node !== contentEditableRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = (node as Element).tagName.toLowerCase();
          if (['h1', 'h2', 'h3', 'pre'].includes(tag)) {
            currentBlock = tag;
            break;
          }
        }
        node = node.parentNode;
      }
    }

    e.preventDefault();
    document.execCommand('insertParagraph', false);

    if (currentBlock) {
      document.execCommand('formatBlock', false, currentBlock);
    }

    handleContentChange();
  };

  const removeStrikethroughTags = (_node: Node) => {
    const editor = contentEditableRef.current;
    if (!editor) return;

    const strikeTags = editor.querySelectorAll('strike, s, del');
    strikeTags.forEach((tag) => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);

      if (range.intersectsNode(tag)) {
        const parent = tag.parentNode;
        if (parent) {
          while (tag.firstChild) {
            parent.insertBefore(tag.firstChild, tag);
          }
          parent.removeChild(tag);
        }
      }
    });
  };

  const applyFormat = (format: FormatType) => {
    restoreSelection();
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      contentEditableRef.current?.focus();
    }

    if (format === 'strikethrough') {
      const isActive = document.queryCommandState('strikethrough');
      if (isActive && selection && selection.rangeCount > 0) {
        removeStrikethroughTags(contentEditableRef.current!);
      } else {
        document.execCommand('strikethrough', false);
      }
      updateActiveFormats();
      handleContentChange();
      return;
    }

    const commandMap: Record<string, string> = {
      bold: 'bold',
      italic: 'italic',
      underline: 'underline',
      unorderedList: 'insertUnorderedList',
      orderedList: 'insertOrderedList',
    };

    document.execCommand(commandMap[format], false);
    updateActiveFormats();
    handleContentChange();
  };

  const applyTextStyle = (style: TextStyle) => {
    setSelectedTextStyle(style);
    restoreSelection();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      contentEditableRef.current?.focus();
    }

    const tagMap: Record<TextStyle, string> = {
      title: 'h1',
      header: 'h2',
      subheader: 'h3',
      body: 'p',
      mono: 'pre',
    };

    document.execCommand('formatBlock', false, tagMap[style]);
    handleContentChange();
  };

  const applyTextColor = (color: string) => {
    setTextColor(color);
    restoreSelection();
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

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const currentRange = sel.getRangeAt(0);
      if (contentEditableRef.current?.contains(currentRange.startContainer)) {
        return;
      }
    }
    const range = savedSelectionRef.current;
    if (range) {
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  };

  const detectCurrentBlockStyle = useCallback((): TextStyle => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 'body';
    let node: Node | null = sel.getRangeAt(0).startContainer;
    while (node && node !== contentEditableRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as Element).tagName.toLowerCase();
        if (tag === 'h1') return 'title';
        if (tag === 'h2') return 'header';
        if (tag === 'h3') return 'subheader';
        if (tag === 'pre') return 'mono';
      }
      node = node.parentNode;
    }
    return 'body';
  }, []);

  const isInsideStrikethrough = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    let node: Node | null = sel.anchorNode;
    while (node && node !== contentEditableRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as Element).tagName.toLowerCase();
        if (tag === 'strike' || tag === 's' || tag === 'del') return true;
        const style = window.getComputedStyle(node as Element);
        if (style.textDecorationLine?.includes('line-through')) return true;
      }
      node = node.parentNode;
    }
    return false;
  }, []);

  const updateActiveFormats = useCallback(() => {
    const formats = new Set<FormatType>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('strikethrough') || isInsideStrikethrough()) formats.add('strikethrough');
    if (document.queryCommandState('insertUnorderedList')) formats.add('unorderedList');
    if (document.queryCommandState('insertOrderedList')) formats.add('orderedList');
    setActiveFormats(formats);
    setSelectedTextStyle(detectCurrentBlockStyle());
  }, [detectCurrentBlockStyle, isInsideStrikethrough]);

  const handleFormatToggle = (format: FormatType) => {
    restoreSelection();
    applyFormat(format);
    saveSelection();
  };

  const scrollCaretIntoView = useCallback(() => {
    setTimeout(() => {
      const container = editorScrollRef.current;
      const sel = savedSelectionRef.current || (window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0) : null);
      if (container && sel) {
        const caretRect = sel.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (caretRect && caretRect.top > 0) {
          const caretRelative = caretRect.top - containerRect.top;
          const visibleHeight = containerRect.height;
          if (caretRelative > visibleHeight - 40 || caretRelative < 0) {
            const offset = caretRect.top - containerRect.top + container.scrollTop - visibleHeight / 2;
            container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
          }
        }
      }
    }, 50);
  }, []);


  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    setSelectedFiles((prev) => [...prev, ...newFiles]);

    const previewUrls: string[] = [];
    newFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
    });
    setSelectedImages((prev) => [...prev, ...previewUrls]);
    
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
      } catch {
        setSelectedImages((prev) => prev.filter((url) => url !== previewUrl));
        setSelectedFiles((prev) => prev.filter((f) => f !== file));
        URL.revokeObjectURL(previewUrl);
        setUploadErrorToast(true);
      }
    }
    
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const insertImageIntoContentEditable = (imageUrl: string) => {
    if (!contentEditableRef.current) return;
    
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    
    const isRangeInsideContent = range && contentEditableRef.current.contains(range.startContainer);
    
    const container = document.createElement('div');
    container.className = 'relative block my-2';
    container.style.display = 'block';
    container.style.margin = '8px 0';
    container.style.width = '100%';
    container.style.maxWidth = '100%';
    container.style.padding = '4px';
    
    const img = document.createElement('img');
    img.src = getStorageImageSrc(imageUrl);
    img.alt = '';
    img.className = 'rounded-lg';
    img.style.maxWidth = '100%';
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.display = 'block';
    img.style.objectFit = 'contain';
    img.dataset.imageUrl = imageUrl;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'absolute top-0 right-0 w-7 h-7 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors z-10';
    deleteBtn.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    deleteBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const deletedUrl = img.dataset.imageUrl || '';
      container.remove();
      if (deletedUrl) {
        setSelectedFiles((prev) => {
          const newFiles = prev.filter((file) => {
            const mappedUrl = fileToUrlMap.get(file);
            return mappedUrl !== deletedUrl;
          });
          return newFiles;
        });
        setSelectedImages((prev) => prev.filter((u) => u !== deletedUrl));
      }
      handleContentChange();
    };
    
    container.appendChild(img);
    container.appendChild(deleteBtn);
    
    if (isRangeInsideContent && range) {
      if (!range.collapsed) {
        range.deleteContents();
      }
      range.insertNode(container);
    } else {
      contentEditableRef.current.appendChild(container);
    }
    
    // Add a line break and empty text node after container to ensure text input works
    const br = document.createTextNode('\n'); // Use text node with newline instead of <br>
    const emptyTextNode = document.createTextNode(''); // Empty text node for cursor positioning
    
    if (container.nextSibling) {
      container.parentNode?.insertBefore(br, container.nextSibling);
      container.parentNode?.insertBefore(emptyTextNode, br.nextSibling);
    } else {
      container.parentNode?.appendChild(br);
      container.parentNode?.appendChild(emptyTextNode);
    }
    
    // Move cursor to the empty text node after the line break
    setTimeout(() => {
      const newRange = document.createRange();
      newRange.setStart(emptyTextNode, 0);
      newRange.collapse(true);
      const newSelection = window.getSelection();
      if (newSelection) {
        newSelection.removeAllRanges();
        newSelection.addRange(newRange);
        // Focus the contentEditable to ensure input works
        contentEditableRef.current?.focus();
      }
    }, 10);
    
    // Update content
    handleContentChange();
  };


  const handleCameraClick = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const perms = await CapCamera.checkPermissions();
        if (perms.camera !== 'granted') {
          const requested = await CapCamera.requestPermissions({ permissions: ['camera'] });
          if (requested.camera !== 'granted') {
            alert(t('diary.cameraPermissionDenied') || '카메라 권한이 필요합니다. 설정에서 카메라 권한을 허용해주세요.');
            return;
          }
        }
        const photo = await CapCamera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
        });
        if (photo.webPath) {
          const response = await fetch(photo.webPath);
          const blob = await response.blob();
          const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
          const fakeEvent = {
            target: { files: [file] },
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          handleImageSelect(fakeEvent);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('denied') || msg.includes('permission')) {
          alert(t('diary.cameraPermissionDenied') || '카메라 권한이 필요합니다. 설정에서 카메라 권한을 허용해주세요.');
        } else if (!msg.includes('cancelled') && !msg.includes('User cancelled')) {
        }
      }
    } else {
      if (cameraInputRef.current) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          cameraInputRef.current.setAttribute('capture', 'environment');
        } else {
          cameraInputRef.current.removeAttribute('capture');
        }
        cameraInputRef.current.click();
      }
    }
  };

  const isSavingRef = useRef(false);

  const hasTextContent = (): boolean => {
    if (type === 'free_form') {
      if (contentEditableRef.current) {
        const clone = contentEditableRef.current.cloneNode(true) as HTMLDivElement;
        clone.querySelectorAll('img').forEach((img) => img.remove());
        const text = (clone.textContent || clone.innerText || '')
          .replace(/\u00A0/g, '')
          .replace(/\n/g, '')
          .trim();
        return text.length > 0;
      }
      return false;
    }
    if (type === 'question_based') {
      return Object.values(answers).some((a) => {
        const text = (a || '').replace(/<[^>]*>/g, '').trim();
        return text.length > 0;
      });
    }
    return true;
  };

  const [showTitleSuggestion, setShowTitleSuggestion] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [titleSuggestionLoading, setTitleSuggestionLoading] = useState(false);

  const buildTitleSuggestionPayload = () => {
    let contentText = '';
    if (type === 'free_form' && contentEditableRef.current) {
      const clone = contentEditableRef.current.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('img').forEach((img) => img.remove());
      contentText = (clone.textContent || clone.innerText || '').trim();
    }

    const answersPayload =
      type === 'question_based' && activeQuestions.length > 0
        ? activeQuestions
            .filter((q) => answers[q.id] && answers[q.id].replace(/<[^>]*>/g, '').trim())
            .map((q) => ({
              question: q.question || '',
              answer: (answers[q.id] || '').replace(/<[^>]*>/g, '').trim(),
            }))
        : undefined;

    return {
      type,
      content: contentText,
      answers: answersPayload,
      count: 3,
    };
  };

  const fetchTitleSuggestions = async () => {
    setTitleSuggestionLoading(true);
    try {
      const payload = buildTitleSuggestionPayload();
      const res = await apiRequest<{ success: boolean; data?: { titles?: string[] } }>(
        '/ai/suggest-titles',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      setTitleSuggestions(res?.data?.titles ?? []);
    } catch (err) {
      console.error('Failed to fetch title suggestions:', err);
      setTitleSuggestions([]);
    } finally {
      setTitleSuggestionLoading(false);
    }
  };

  const handleSaveClick = () => {
    if (!hasTextContent()) {
      setShowContentRequired(t('diary.enterContentRequired'));
      return;
    }

    setShowFolderModal(true);
  };

  const handleTitleSuggestionSelect = (title: string) => {
    setValue('title', title, { shouldDirty: true, shouldValidate: false });
    setShowTitleSuggestion(false);
    setShowFolderModal(true);
  };

  const handleTitleSuggestionClose = () => {
    setShowTitleSuggestion(false);
  };

  const needsAd = !isEditMode && !activeSubscription && diaryCount >= 3;

  const handleFolderSelect = (folderId: string) => {
    setShowFolderModal(false);
    if (!folderId || folderId.trim() === '') {
      console.error('[AdFlow] Invalid folderId:', folderId);
      alert(t('diary.selectFolder'));
      return;
    }
    const event = {
      target: { value: folderId },
    } as React.ChangeEvent<HTMLInputElement>;
    register('folderId').onChange(event);

    if (needsAd) {
      setPendingFolderId(folderId);
      setShowAdModal(true);
    } else {
      setTimeout(() => {
        submitDiary(folderId);
      }, 100);
    }
  };

  const handleAdComplete = useCallback(() => {
    setShowAdModal(false);
    if (pendingFolderId && !isSavingRef.current) {
      isSavingRef.current = true;
      setTimeout(() => {
        submitDiary(pendingFolderId);
      }, 100);
    }
  }, [pendingFolderId]);


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
        } catch {
        }
      }

      // Prepare answers for question-based diary
      const answerArray =
        type === 'question_based' && activeQuestions.length > 0
          ? activeQuestions
              .filter((q) => answers[q.id] && answers[q.id].trim())
              .map((q) => ({
                questionId: q.id,
                answer: answers[q.id],
              }))
          : undefined;

      let finalContent = formData.content;
      if (type === 'free_form' && contentEditableRef.current) {
        const tmp = contentEditableRef.current.cloneNode(true) as HTMLElement;
        tmp.querySelectorAll('font[color]').forEach((font) => {
          const color = font.getAttribute('color');
          if (color) {
            const span = document.createElement('span');
            span.style.cssText = `color: ${color} !important`;
            span.innerHTML = font.innerHTML;
            font.replaceWith(span);
          }
        });
        tmp.querySelectorAll('[style]').forEach((el) => {
          const style = (el as HTMLElement).style;
          if (style.color && !style.cssText.includes('!important')) {
            style.setProperty('color', style.color, 'important');
          }
        });
        finalContent = tmp.innerHTML;
      }

      // Ensure folderId is properly set - validate that it's not empty string
      const finalFolderId = (folderId !== undefined && folderId !== null && folderId !== '') 
        ? folderId 
        : (formData.folderId !== undefined && formData.folderId !== null && formData.folderId !== '' 
          ? formData.folderId 
          : undefined);

      const diaryData = {
        ...formData,
        title: type === 'free_form' ? (formData.title || '').trim() : '',
        content: finalContent,
        folderId: finalFolderId,
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
      alert(t('diary.saveFailed'));
    } finally {
      setUploading(false);
      isSavingRef.current = false;
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
  const locale = getDateLocale();
  const formattedDate = format(dateObj, t('diary.dateFormat'), { locale });

  const handleBackClick = () => {
    setShowExitConfirm(true);
  };

  const handleExitConfirm = useCallback(() => {
    setShowExitConfirm(false);
    navigate('/', { replace: true });
  }, [navigate]);

  // Free Form Diary - Note style
  // Show loading state when editing and diary is loading
  if (isEditMode && isLoadingDiary) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-muted-foreground">{t('diary.loadingDiary')}</div>
      </div>
    );
  }

  if (type === 'free_form') {
    return (
      <div
        className="bg-white flex flex-col overflow-hidden"
        style={keyboardHeight > 0 ? {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: `${window.innerHeight - keyboardHeight}px`,
          zIndex: 10,
        } : { height: '100dvh' }}
      >
        {(uploading || createDiary.isPending || updateDiary.isPending) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-overlay-fade">
            <div className="bg-white rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-lg animate-modal-pop">
              <div className="w-8 h-8 border-[3px] border-amber-300 border-t-amber-600 rounded-full animate-spin" />
              <p className="text-sm font-medium" style={{ color: '#4A2C1A' }}>{t('diary.preparingCheer')}</p>
              <p className="text-xs text-gray-400">{t('diary.savingDiary')}</p>
            </div>
          </div>
        )}
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col overflow-hidden bg-white">
          <div className="flex items-center justify-between px-4 py-3 bg-white shrink-0" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
            <button 
              onClick={handleBackClick} 
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#4A2C1A]" />
            </button>
            <h1 className="text-sm font-normal text-gray-600">{formattedDate}</h1>
            <button
              onClick={handleSaveClick}
              disabled={uploading || createDiary.isPending}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <Check className="w-5 h-5 text-[#4A2C1A]" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
            <div ref={editorScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-white">
              <input
                {...register('title')}
                type="text"
                placeholder={t('diary.titlePlaceholder')}
                className="w-full px-4 pt-4 pb-2 text-lg font-semibold outline-none bg-white border-b border-gray-100 dark:bg-[#1a1a1a] dark:border-gray-800"
                style={{ color: defaultTextColor }}
                maxLength={100}
              />
              <div
                ref={contentEditableRef}
                contentEditable
                onInput={handleContentChange}
                onPaste={handlePaste}
                onKeyDown={handleContentKeyDown}
                onKeyUp={updateActiveFormats}
                onBlur={updateActiveFormats}
                onFocus={updateActiveFormats}
                onSelect={() => { updateActiveFormats(); saveSelection(); }}
                data-placeholder={t('diary.writingPlaceholder')}
                className="w-full resize-none outline-none bg-white dark:bg-[#1a1a1a] min-h-[200px] px-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-medium [&_p]:text-base [&_pre]:text-sm [&_pre]:font-mono [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-gray-400"
                style={{ 
                  color: defaultTextColor,
                  lineHeight: '24px',
                  fontSize: '16px',
                  paddingTop: '12px',
                  paddingBottom: '60px',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                }}
              />
            </div>

          </form>

          {!showFormatMenu && !showColorPicker && (
            <div
              className="shrink-0 px-4 py-2 bg-white"
              style={{
                paddingBottom: keyboardHeight > 0 ? '8px' : 'calc(8px + env(safe-area-inset-bottom, 0px))',
              }}
            >
              <div className="max-w-md mx-auto">
                <div className="bg-white rounded-full shadow-lg px-4 py-3 flex items-center justify-center gap-4 w-fit">
                  <button
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); saveSelection(); }}
                    onClick={() => {
                      setShowFormatMenu(true);
                      scrollCaretIntoView();
                    }}
                    className="cursor-pointer p-1"
                  >
                    <Type className="w-6 h-6 text-gray-600" />
                  </button>
                  {!isIOS && (
                    <button
                      type="button"
                      onClick={handleCameraClick}
                      className="cursor-pointer p-1"
                    >
                      <Camera className="w-6 h-6 text-gray-600" />
                    </button>
                  )}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="cursor-pointer p-1"
                  >
                    <ImageIcon className="w-6 h-6 text-gray-600" />
                  </button>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {showFormatMenu && (
            <FormatMenu
              onClose={() => setShowFormatMenu(false)}
              onStyleSelect={applyTextStyle}
              onFormatToggle={handleFormatToggle}
              onColorSelect={() => setShowColorPicker(true)}
              selectedStyle={selectedTextStyle}
              activeFormats={activeFormats}
              textColor={textColor}
              isKeyboardOpen={keyboardHeight > 0}
            />
          )}

          {showColorPicker && (
            <ColorPicker
              onClose={() => setShowColorPicker(false)}
              onColorSelect={applyTextColor}
              selectedColor={textColor}
              isKeyboardOpen={keyboardHeight > 0}
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

          <AdModal
            isOpen={showAdModal}
            onClose={() => setShowAdModal(false)}
            onAdComplete={handleAdComplete}
          />

          <TitleSuggestionModal
            open={showTitleSuggestion}
            loading={titleSuggestionLoading}
            titles={titleSuggestions}
            onSelect={handleTitleSuggestionSelect}
            onClose={handleTitleSuggestionClose}
            onRetry={fetchTitleSuggestions}
          />

          {showContentRequired && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 mx-8 max-w-sm w-full text-center shadow-xl">
                <p className="text-brown-900 text-base mb-5">{showContentRequired}</p>
                <button
                  type="button"
                  onClick={() => setShowContentRequired(null)}
                  className="w-full py-2.5 bg-[#4A2C1A] hover:bg-[#3A2010] text-white rounded-full font-medium"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          )}

          <Toast
            message={t('error.imageUploadFailed')}
            isVisible={uploadErrorToast}
            onClose={() => setUploadErrorToast(false)}
          />
        </div>
      </div>
    );
  }

  // Question-based Diary
  return (
    <div
      className="bg-white flex flex-col overflow-hidden"
      style={keyboardHeight > 0 ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: `${window.innerHeight - keyboardHeight}px`,
        zIndex: 10,
      } : { height: '100dvh' }}
    >
      {(uploading || createDiary.isPending || updateDiary.isPending) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-overlay-fade">
          <div className="bg-white rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-lg animate-modal-pop">
            <div className="w-8 h-8 border-[3px] border-amber-300 border-t-amber-600 rounded-full animate-spin" />
            <p className="text-sm font-medium" style={{ color: '#4A2C1A' }}>{t('diary.preparingCheer')}</p>
            <p className="text-xs text-gray-400">{t('diary.savingDiary')}</p>
          </div>
        </div>
      )}
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col overflow-hidden bg-white">
        <div className="flex items-center justify-between px-4 py-3 bg-white shrink-0" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
          <button 
            onClick={handleBackClick} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#4A2C1A]" />
          </button>
          <h1 className="text-base font-medium text-[#4A2C1A]">{formattedDate}</h1>
          <button
            onClick={handleSaveClick}
            disabled={uploading || createDiary.isPending}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <Check className="w-5 h-5 text-[#4A2C1A]" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden px-4 py-5">
            {(isEditMode ? isLoadingDiary : questionsLoading) ? (
              <div className="text-center py-8 text-gray-500">{t('diary.loadingQuestions')}</div>
            ) : activeQuestions.length > 0 ? (
              // 3개 질문 카드: 클릭한 카드만 인라인으로 확장
              <div className="space-y-4 overflow-y-auto">
                {activeQuestions.map((question) => (
                  <div
                    key={question.id}
                    className={`w-full text-left bg-gray-100 rounded-xl transition-all ${
                      expandedQuestionId === question.id ? 'p-4 flex flex-col' : 'p-4'
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
                            <p className="text-gray-400 text-sm">{t('diary.writingPlaceholder')}</p>
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
                          onFocus={(e) => {
                            setTimeout(() => {
                              e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 300);
                          }}
                          placeholder={t('diary.writingPlaceholder')}
                          className="flex-1 w-full min-h-[200px] mt-3 bg-gray-100 rounded-lg resize-none focus:outline-none text-[#4A2C1A] placeholder:text-gray-400 text-base overflow-y-auto p-3"
                          style={{
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            hyphens: 'auto',
                          }}
                          wrap="soft"
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-100 rounded-2xl p-6">
                <p className="text-sm text-gray-500">{t('diary.noQuestions')}</p>
              </div>
            )}
          </div>

          {selectedImages.length > 0 && (
            <div className="px-4 py-2">
              <p className="text-xs text-gray-400 mb-1.5">{t('diary.imageCardHint')}</p>
              <div className="flex overflow-x-auto pb-2 pl-2 pt-2 pr-2">
                {selectedImages.map((url, index) => (
                  <div key={index} className="relative shrink-0 w-20 h-20 mr-3">
                    <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={url.startsWith('blob:') ? url : getStorageImageSrc(url)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
                        setSelectedImages((prev) => prev.filter((_, i) => i !== index));
                        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center z-10"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </form>
      </div>
      {!showFormatMenu && !showColorPicker && (
        <div
          className="shrink-0 px-4 py-2 bg-white"
          style={{
            paddingBottom: keyboardHeight > 0 ? '8px' : 'calc(8px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-full shadow-lg px-4 py-3 flex items-center justify-center gap-4 w-fit">
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); saveSelection(); }}
                onClick={() => {
                  setShowFormatMenu(true);
                  scrollCaretIntoView();
                }}
                className="cursor-pointer p-1"
              >
                <Type className="w-6 h-6 text-gray-600" />
              </button>
              {!isIOS && (
                <button type="button" onClick={handleCameraClick} className="cursor-pointer p-1">
                  <Camera className="w-6 h-6 text-gray-600" />
                </button>
              )}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="cursor-pointer p-1"
              >
                <ImageIcon className="w-6 h-6 text-gray-600" />
              </button>
              <input
                ref={galleryInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}

      {showFormatMenu && (
        <FormatMenu
          onClose={() => setShowFormatMenu(false)}
          onStyleSelect={applyTextStyle}
          onFormatToggle={handleFormatToggle}
          onColorSelect={() => setShowColorPicker(true)}
          selectedStyle={selectedTextStyle}
          activeFormats={activeFormats}
          textColor={textColor}
          isKeyboardOpen={keyboardHeight > 0}
        />
      )}

      {showColorPicker && (
        <ColorPicker
          onClose={() => setShowColorPicker(false)}
          onColorSelect={applyTextColor}
          selectedColor={textColor}
          isKeyboardOpen={keyboardHeight > 0}
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

      <TitleSuggestionModal
        open={showTitleSuggestion}
        loading={titleSuggestionLoading}
        titles={titleSuggestions}
        onSelect={handleTitleSuggestionSelect}
        onClose={handleTitleSuggestionClose}
        onRetry={fetchTitleSuggestions}
      />

      {showContentRequired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 mx-8 max-w-sm w-full text-center shadow-xl">
            <p className="text-brown-900 text-base mb-5">{showContentRequired}</p>
            <button
              type="button"
              onClick={() => setShowContentRequired(null)}
              className="w-full py-2.5 bg-[#4A2C1A] hover:bg-[#3A2010] text-white rounded-full font-medium"
            >
              {t('common.confirm')}
            </button>
          </div>
        </div>
      )}

      {/* Exit Confirm Modal */}
      {showExitConfirm && (
        <ExitConfirmModal
          onClose={() => setShowExitConfirm(false)}
          onConfirm={handleExitConfirm}
        />
      )}

      {/* Ad Modal for free users */}
      <AdModal
        isOpen={showAdModal}
        onClose={() => setShowAdModal(false)}
        onAdComplete={handleAdComplete}
      />

      <Toast
        message={t('error.imageUploadFailed')}
        isVisible={uploadErrorToast}
        onClose={() => setUploadErrorToast(false)}
      />
    </div>
  );
}
