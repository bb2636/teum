import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme, type Theme } from '@/contexts/ThemeContext';
import { useT } from '@/hooks/useTranslation';
import { useUpdateProfile } from '@/hooks/useProfile';
import { getCurrentLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export function AppSettingsPage() {
  const navigate = useNavigate();
  const t = useT();
  const { setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const updateProfile = useUpdateProfile();

  const [selectedLanguage, setSelectedLanguage] = useState<'ko' | 'en'>(getCurrentLanguage());
  const [selectedTheme, setSelectedTheme] = useState<Theme>(theme);
  const [showLanguageList, setShowLanguageList] = useState(false);
  const [showThemeList, setShowThemeList] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({ language: selectedLanguage });
      setLanguage(selectedLanguage);
      setTheme(selectedTheme);
      setShowSaveSuccess(true);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-beige-50 dark:bg-[#4A2C1A]">
        <div className="max-w-md mx-auto px-4 py-6" style={{ paddingTop: 'max(24px, env(safe-area-inset-top, 24px))' }}>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-brown-900 dark:text-white">{t('my.appSettings')}</h1>
            <button
              type="button"
              onClick={() => navigate('/my')}
              className="p-2 rounded-full hover:bg-brown-100 dark:hover:bg-[#3A2010]"
              aria-label="Close"
            >
              <X className="w-5 h-5 dark:text-white" />
            </button>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-brown-900 dark:text-white">{t('my.selectLanguage')}</label>
              <button
                type="button"
                onClick={() => setShowLanguageList(true)}
                className="w-full h-10 rounded-md border border-input bg-gray-50 dark:bg-[#3A2010] dark:border-[#5A3C2A] px-3 text-sm flex items-center justify-between text-left"
              >
                <span className="text-brown-900 dark:text-white">
                  {selectedLanguage === 'ko' ? t('my.langKorean') : t('my.langEnglish')}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground dark:text-gray-300 shrink-0" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-brown-900 dark:text-white">{t('my.themeSettings')}</label>
              <button
                type="button"
                onClick={() => setShowThemeList(true)}
                className="w-full h-10 rounded-md border border-input bg-gray-50 dark:bg-[#3A2010] dark:border-[#5A3C2A] px-3 text-sm flex items-center justify-between text-left"
              >
                <span className="text-brown-900 dark:text-white">
                  {selectedTheme === 'light' ? t('my.themeLight') : t('my.themeDark')}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground dark:text-gray-300 shrink-0" />
              </button>
            </div>

            <Button
              type="button"
              onClick={handleSave}
              className="w-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white py-3 rounded-full dark:bg-white dark:text-[#4A2C1A] dark:hover:bg-gray-200"
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </div>

      {showSaveSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-overlay-fade">
          <div className="bg-white dark:bg-[#3A2010] rounded-xl max-w-sm w-full p-6 shadow-lg text-center animate-modal-pop">
            <p className="text-brown-900 dark:text-white mb-6">{t('my.saved')}</p>
            <Button
              type="button"
              className="w-full bg-[#4A2C1A] hover:bg-[#3A2010] rounded-full dark:bg-white dark:text-[#4A2C1A]"
              onClick={() => { setShowSaveSuccess(false); navigate('/my'); }}
            >
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      )}

      {showLanguageList && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 animate-overlay-fade"
          onClick={() => setShowLanguageList(false)}
        >
          <div
            className="bg-white dark:bg-[#3A2010] rounded-t-2xl w-full max-w-md shadow-lg pb-safe flex flex-col animate-modal-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-brown-100 dark:border-[#5A3C2A] flex items-center justify-between shrink-0">
              <h2 className="text-lg font-semibold text-brown-900 dark:text-white">{t('my.selectLanguage')}</h2>
              <button type="button" onClick={() => setShowLanguageList(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#4A2C1A]" aria-label="Close">
                <X className="w-5 h-5 dark:text-white" />
              </button>
            </div>
            <div className="divide-y divide-brown-100 dark:divide-[#5A3C2A] py-2">
              {([{ value: 'ko' as const, label: t('my.langKorean') }, { value: 'en' as const, label: t('my.langEnglish') }]).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setSelectedLanguage(value); setShowLanguageList(false); }}
                  className="w-full p-4 flex items-center justify-between hover:bg-brown-50 dark:hover:bg-[#4A2C1A] transition-colors text-left"
                >
                  <span className="font-medium text-brown-900 dark:text-white">{label}</span>
                  {selectedLanguage === value && <Check className="w-5 h-5 text-brown-600 dark:text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showThemeList && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 animate-overlay-fade"
          onClick={() => setShowThemeList(false)}
        >
          <div
            className="bg-white dark:bg-[#3A2010] rounded-t-2xl w-full max-w-md shadow-lg pb-safe flex flex-col animate-modal-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-brown-100 dark:border-[#5A3C2A] flex items-center justify-between shrink-0">
              <h2 className="text-lg font-semibold text-brown-900 dark:text-white">{t('my.themeSettings')}</h2>
              <button type="button" onClick={() => setShowThemeList(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#4A2C1A]" aria-label="Close">
                <X className="w-5 h-5 dark:text-white" />
              </button>
            </div>
            <div className="divide-y divide-brown-100 dark:divide-[#5A3C2A] py-2">
              {([{ value: 'light' as const, label: t('my.themeLight') }, { value: 'dark' as const, label: t('my.themeDark') }]).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setSelectedTheme(value); setShowThemeList(false); }}
                  className="w-full p-4 flex items-center justify-between hover:bg-brown-50 dark:hover:bg-[#4A2C1A] transition-colors text-left"
                >
                  <span className="font-medium text-brown-900 dark:text-white">{label}</span>
                  {selectedTheme === value && <Check className="w-5 h-5 text-brown-600 dark:text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
