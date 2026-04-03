import { useState, useEffect, useRef } from 'react';
import { useMe } from '@/hooks/useProfile';
import { useAllUsers, useUserPayments, useDeleteUser, useUpdateUserStatus, useAllDiaries, useAdminCancelSubscription, AdminDiary, AdminUser } from '@/hooks/useAdmin';
import { useLogout } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Search, User, X, ChevronDown, ArrowLeft, Trash2, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { QuestionsManagementTab } from './QuestionsManagementTab';
import { SupportManagementTab } from './SupportManagementTab';
import { TermsManagementTab } from './TermsManagementTab';
import { StorageImage } from '@/components/StorageImage';
import { useUncheckedInquiryCount } from '@/hooks/useSupport';

type AdminTab = 'users' | 'diaries' | 'questions' | 'support' | 'terms';
type DiaryFilter = 'all' | 'free' | 'question';

export function AdminPage() {
  const { data: user, isLoading: userLoading } = useMe();
  const { data: users = [], isLoading: usersLoading } = useAllUsers();
  const { data: diaries = [], isLoading: diariesLoading } = useAllDiaries();
  const logout = useLogout();
  const deleteUserMutation = useDeleteUser();
  const updateUserStatusMutation = useUpdateUserStatus();
  const adminCancelSubscription = useAdminCancelSubscription();
  const { data: uncheckedCount = 0 } = useUncheckedInquiryCount();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetailTab, setUserDetailTab] = useState<'profile' | 'subscription'>('profile');
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<'confirm' | 'loading' | 'completed'>('confirm');
  const [diaryFilter, setDiaryFilter] = useState<DiaryFilter>('all');
  const [selectedDiary, setSelectedDiary] = useState<AdminDiary | null>(null);
  
  // All hooks must be called before any early returns
  const { data: userPayments = [] } = useUserPayments(selectedUserId);

  // Add admin-page class to body and root to prevent mobile styles
  useEffect(() => {
    const body = document.body;
    const root = document.getElementById('root');
    
    body.classList.add('admin-page');
    if (root) {
      root.classList.add('admin-page');
    }
    
    // Override any mobile styles
    body.style.display = 'block';
    body.style.flex = 'none';
    body.style.alignItems = 'unset';
    body.style.justifyContent = 'unset';
    body.style.minHeight = '100vh';
    
    if (root) {
      root.style.width = '100%';
      root.style.maxWidth = '100%';
      root.style.margin = '0';
      root.style.boxShadow = 'none';
    }
    
    return () => {
      body.classList.remove('admin-page');
      if (root) {
        root.classList.remove('admin-page');
      }
      body.style.display = '';
      body.style.flex = '';
      body.style.alignItems = '';
      body.style.justifyContent = '';
      body.style.minHeight = '';
      if (root) {
        root.style.width = '';
        root.style.maxWidth = '';
        root.style.margin = '';
        root.style.boxShadow = '';
      }
    };
  }, []);

  // Check if user is admin
  if (userLoading) {
    return <div className="p-6">로딩 중...</div>;
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  // Filter users: exclude admins and apply search query
  const filteredUsers = users.filter((u) => {
    // Exclude admin users
    if (u.role === 'admin') return false;
    
    // Apply search query
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(query) ||
      u.profile?.nickname?.toLowerCase().includes(query) ||
      u.profile?.name?.toLowerCase().includes(query)
    );
  });

  // Get selected user
  const selectedUser = selectedUserId ? filteredUsers.find(u => u.id === selectedUserId) : null;

  // Filter diaries
  const filteredDiaries = diaries.filter((diary) => {
    if (diaryFilter === 'all') return true;
    if (diaryFilter === 'free') return diary.type === 'free_form';
    if (diaryFilter === 'question') return diary.type === 'question_based';
    return true;
  }).filter((diary) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      diary.title?.toLowerCase().includes(query) ||
      diary.content?.toLowerCase().includes(query) ||
      diary.user?.email.toLowerCase().includes(query) ||
      diary.user?.profile?.nickname?.toLowerCase().includes(query) ||
      diary.user?.profile?.name?.toLowerCase().includes(query)
    );
  });

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return '-';
    try {
      return format(new Date(date), 'yy.MM.dd');
    } catch {
      return '-';
    }
  };

  const formatDateOfBirth = (date: string | Date | null | undefined) => {
    if (!date) return '-';
    try {
      return format(new Date(date), 'yy.MM.dd');
    } catch {
      return '-';
    }
  };

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      setShowLogoutModal(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    
    setDeleteStatus('loading');
    try {
      await deleteUserMutation.mutateAsync(deleteUser.id);
      setDeleteStatus('completed');
    } catch (error) {
      console.error('Delete user failed:', error);
      setDeleteStatus('confirm');
    }
  };

  const handleDeleteComplete = () => {
    setDeleteUser(null);
    setDeleteStatus('confirm');
    setSelectedUserId(null);
  };

  return (
    <div className="w-full h-screen bg-white overflow-hidden flex flex-col">
      {/* Delete User Modal */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-overlay-fade">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl text-center animate-modal-pop">
            {deleteStatus === 'confirm' && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-4">삭제하시겠습니까?</h3>
                <p className="text-sm text-gray-600 mb-6">
                  삭제하면 계정과 관련 데이터가 복구되지 않습니다.
                </p>
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    {deleteUser.profile?.profileImageUrl ? (
                      <img
                        src={deleteUser.profile.profileImageUrl}
                        alt={deleteUser.profile.name || deleteUser.email}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  <span className="text-gray-900">{deleteUser.email}</span>
                  {deleteUser.profile?.nickname && (
                    <>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-900">{deleteUser.profile.nickname}</span>
                    </>
                  )}
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      setDeleteUser(null);
                      setDeleteStatus('confirm');
                    }}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    취소
                  </button>
                  <Button
                    onClick={handleDeleteUser}
                    className="px-4 py-2 bg-[#8B4513] hover:bg-[#6B3410] text-white"
                  >
                    나가기
                  </Button>
                </div>
              </>
            )}
            {deleteStatus === 'loading' && (
              <div className="flex items-center justify-center py-12">
                <div className="w-3 h-3 rounded-full bg-[#8B4513] animate-pulse"></div>
              </div>
            )}
            {deleteStatus === 'completed' && (
              <div className="text-center py-6">
                <p className="text-gray-900 mb-6">삭제가 완료되었습니다</p>
                <Button
                  onClick={handleDeleteComplete}
                  className="px-4 py-2 text-[#8B4513] hover:text-[#6B3410] transition-colors"
                >
                  완료
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-overlay-fade">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl animate-modal-pop">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">로그아웃</h3>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">정말 로그아웃 하시겠습니까?</p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => setShowLogoutModal(false)}
                className="px-4 border-0 rounded-full"
              >
                취소
              </Button>
              <Button
                onClick={handleLogout}
                disabled={logout.isPending}
                className="px-4 bg-[#4A2C1A] hover:bg-[#3A2010] text-white"
              >
                {logout.isPending ? '로그아웃 중...' : '로그아웃'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="bg-white flex-shrink-0">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              {/* Admin Logo */}
              <button
                onClick={() => setShowLogoutModal(true)}
                className="flex-shrink-0 hover:opacity-80 transition-opacity"
              >
                <img
                  src="/admin_logo.png"
                  alt="Admin Logo"
                  className="h-12 w-auto"
                />
              </button>
              
              <button
                onClick={() => setActiveTab('users')}
                className={`pb-2 px-1 text-sm font-medium transition-colors ${
                  activeTab === 'users'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                사용자 관리
              </button>
              <button
                onClick={() => setActiveTab('diaries')}
                className={`pb-2 px-1 text-sm font-medium transition-colors ${
                  activeTab === 'diaries'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                일기 관리
              </button>
              <button
                onClick={() => setActiveTab('questions')}
                className={`pb-2 px-1 text-sm font-medium transition-colors ${
                  activeTab === 'questions'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                질문 관리
              </button>
              <button
                onClick={() => setActiveTab('support')}
                className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
                  activeTab === 'support'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                고객센터
                {uncheckedCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-[#4A2C1A]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('terms')}
                className={`pb-2 px-1 text-sm font-medium transition-colors ${
                  activeTab === 'terms'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                약관 관리
              </button>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="검색어를 입력하세요"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto w-full px-6 py-6 relative">
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden w-full">
            {/* Table Header */}
            <div className="bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-8 gap-4 px-4 py-3 text-sm font-medium text-gray-700">
                <div className="text-left">사용자 ID</div>
                <div className="text-center">닉네임</div>
                <div className="text-center">이름</div>
                <div className="text-center">생년월일</div>
                <div className="text-center">구독유무</div>
                <div className="text-center">계정 생성일</div>
                <div className="text-center">계정 상태</div>
                <div className="text-center">삭제</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-200">
              {usersLoading ? (
                <div className="px-4 py-8 text-center text-gray-500">로딩 중...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">사용자가 없습니다.</div>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="grid grid-cols-8 gap-4 px-4 py-3 text-sm hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setUserDetailTab('profile');
                    }}
                  >
                    <div className="flex items-center justify-start gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                      <span className="text-gray-900 truncate">{user.email}</span>
                    </div>
                    <div className="flex items-center justify-center text-gray-900">
                      {user.profile?.nickname || '-'}
                    </div>
                    <div className="flex items-center justify-center text-gray-900">
                      {user.profile?.name || '-'}
                    </div>
                    <div className="flex items-center justify-center text-gray-900">
                      {formatDateOfBirth(user.profile?.dateOfBirth)}
                    </div>
                    <div className="flex items-center justify-center">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          user.hasActiveSubscription
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.hasActiveSubscription ? '구독' : '미구독'}
                      </span>
                    </div>
                    <div className="flex items-center justify-center text-gray-900">
                      {formatDate(user.createdAt)}
                    </div>
                    <div className="flex items-center justify-center relative">
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <Button
                          ref={(el) => {
                            buttonRefs.current[user.id] = el;
                          }}
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const button = buttonRefs.current[user.id];
                            if (button) {
                              const rect = button.getBoundingClientRect();
                              setDropdownPosition({
                                top: rect.bottom + 4,
                                left: rect.left,
                              });
                            }
                            if (user.isWithdrawn) return;
                            setOpenDropdownId(openDropdownId === user.id ? null : user.id);
                          }}
                          disabled={user.isWithdrawn}
                          className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full ${user.isWithdrawn ? 'bg-gray-50 cursor-not-allowed opacity-60' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${user.isWithdrawn ? 'bg-gray-400' : user.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <span className={user.isWithdrawn ? 'text-gray-500' : user.isActive ? 'text-green-600' : 'text-red-600'}>
                              {user.isWithdrawn ? '탈퇴(정지됨)' : user.isActive ? '활성됨' : '정지됨'}
                            </span>
                          </span>
                          <ChevronDown className="w-3 h-3 text-gray-500" />
                        </Button>
                        {openDropdownId === user.id && dropdownPosition && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => {
                                setOpenDropdownId(null);
                                setDropdownPosition(null);
                              }}
                            />
                            <div 
                              className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[120px]"
                              style={{
                                top: `${dropdownPosition.top}px`,
                                left: `${dropdownPosition.left}px`,
                              }}
                            >
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (user.isActive) return; // 이미 활성 상태면 무시
                                  try {
                                    await updateUserStatusMutation.mutateAsync({
                                      userId: user.id,
                                      isActive: true,
                                    });
                                    setOpenDropdownId(null);
                                    setDropdownPosition(null);
                                  } catch (error) {
                                    console.error('Failed to update user status:', error);
                                    alert('사용자 상태 변경에 실패했습니다.');
                                  }
                                }}
                                disabled={updateUserStatusMutation.isPending || user.isActive}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2.5 first:rounded-t-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <span className="text-green-600">활성됨</span>
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!user.isActive) return; // 이미 정지 상태면 무시
                                  try {
                                    await updateUserStatusMutation.mutateAsync({
                                      userId: user.id,
                                      isActive: false,
                                    });
                                    setOpenDropdownId(null);
                                    setDropdownPosition(null);
                                  } catch (error) {
                                    console.error('Failed to update user status:', error);
                                    alert('사용자 상태 변경에 실패했습니다.');
                                  }
                                }}
                                disabled={updateUserStatusMutation.isPending || !user.isActive}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2.5 last:rounded-b-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                <span className="text-red-600">정지됨</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteUser(user);
                          setDeleteStatus('confirm');
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'diaries' && (
          <div className="w-full">
            {/* Filter Tabs */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-2">
                <button
                  onClick={() => setDiaryFilter('all')}
                  className={`pb-2 px-1 text-sm font-medium transition-colors ${
                    diaryFilter === 'all'
                      ? 'text-purple-600 border-b-2 border-purple-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => setDiaryFilter('free')}
                  className={`pb-2 px-1 text-sm font-medium transition-colors ${
                    diaryFilter === 'free'
                      ? 'text-purple-600 border-b-2 border-purple-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  자유형식
                </button>
                <button
                  onClick={() => setDiaryFilter('question')}
                  className={`pb-2 px-1 text-sm font-medium transition-colors ${
                    diaryFilter === 'question'
                      ? 'text-purple-600 border-b-2 border-purple-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  문답형식
                </button>
              </div>
              <p className="text-sm text-gray-500">
                {diaryFilter === 'all' && `전체 ${filteredDiaries.length}개`}
                {diaryFilter === 'free' && `자유형식 ${filteredDiaries.length}개`}
                {diaryFilter === 'question' && `문답형식 ${filteredDiaries.length}개`}
              </p>
            </div>

            {/* Diary Grid */}
            {diariesLoading ? (
              <div className="text-center py-12 text-gray-500">로딩 중...</div>
            ) : filteredDiaries.length === 0 ? (
              <div className="text-center py-12 text-gray-500">일기가 없습니다.</div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {filteredDiaries.map((diary) => (
                  <div
                    key={diary.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedDiary(diary)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {format(new Date(diary.date), 'M월 d일 (E)', { locale: ko })}
                        </span>
                      </div>
                      {diary.folder && (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {diary.folder.name}
                        </span>
                      )}
                    </div>
                    {diary.type === 'question_based' && diary.answers && diary.answers.length > 0 && (
                      <div className="mb-2">
                        <span className="text-xs text-purple-600">
                          {diary.answers.length}개의 문답
                        </span>
                        <p className="text-xs text-gray-600 mt-1">
                          {diary.answers[0]?.question?.question || '질문'}
                        </p>
                      </div>
                    )}
                    {diary.title && (
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">
                        {diary.title}
                      </h3>
                    )}
                    <p className="text-sm text-gray-600 line-clamp-3 mb-3 whitespace-pre-wrap">
                      {(() => {
                        const content = diary.type === 'question_based' && diary.answers && diary.answers.length > 0
                          ? diary.answers[0]?.answer || diary.content || '내용 없음'
                          : diary.content || '내용 없음';
                        // HTML 태그 제거
                        const tmp = document.createElement('div');
                        tmp.innerHTML = content;
                        return tmp.textContent || tmp.innerText || '내용 없음';
                      })()}
                    </p>
                    {diary.images && diary.images.length > 0 && (
                      <div className="mb-3">
                        <StorageImage
                          url={diary.images[0].imageUrl}
                          alt="Diary"
                          className="w-full h-32 object-cover rounded"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        {diary.user?.profile?.profileImageUrl ? (
                          <img
                            src={diary.user.profile.profileImageUrl}
                            alt={diary.user.profile.name || diary.user.email}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <User className="w-3 h-3 text-gray-500" />
                        )}
                      </div>
                      <span className="text-xs text-gray-600">
                        {diary.user?.profile?.nickname || diary.user?.email || 'Unknown'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'questions' && <QuestionsManagementTab />}

        {activeTab === 'support' && <SupportManagementTab />}

        {activeTab === 'terms' && <TermsManagementTab />}
      </div>

      {/* Diary Detail Modal */}
      {selectedDiary && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40 animate-overlay-fade"
            onClick={() => setSelectedDiary(null)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div
              className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto pointer-events-auto animate-modal-pop"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                  {selectedDiary.folder && (
                    <span className="text-sm text-gray-600">{selectedDiary.folder.name}</span>
                  )}
                  <span className="text-sm text-gray-600">
                    {format(new Date(selectedDiary.date), 'M월 d일 (E)', { locale: ko })}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDiary(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6">
                {/* User Info */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    {selectedDiary.user?.profile?.profileImageUrl ? (
                      <img
                        src={selectedDiary.user.profile.profileImageUrl}
                        alt={selectedDiary.user.profile.name || selectedDiary.user.email}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  <span className="text-gray-900 font-medium">
                    {selectedDiary.user?.profile?.nickname || selectedDiary.user?.email || 'Unknown'}
                  </span>
                </div>

                {/* Title */}
                {selectedDiary.title && (
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">{selectedDiary.title}</h2>
                )}

                {/* Question-based Diary */}
                {selectedDiary.type === 'question_based' && selectedDiary.answers && selectedDiary.answers.length > 0 && (
                  <div className="space-y-6 mb-6">
                    {selectedDiary.answers.map((answer, index) => (
                      <div key={answer.id} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {answer.question?.question || `질문 ${index + 1}`}
                        </h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{answer.answer}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Free-form Diary */}
                {selectedDiary.type === 'free_form' && selectedDiary.content && (
                  <div className="mb-6">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {(() => {
                        // HTML 태그 제거 (기존 데이터에 <br> 태그가 있을 수 있음)
                        const tmp = document.createElement('div');
                        tmp.innerHTML = selectedDiary.content;
                        let text = tmp.textContent || tmp.innerText || '';
                        // <br> 태그를 줄바꿈으로 변환
                        text = text.replace(/<br\s*\/?>/gi, '\n');
                        // HTML 엔티티 디코딩
                        text = text.replace(/&nbsp;/g, ' ');
                        return text;
                      })()}
                    </p>
                  </div>
                )}

                {/* Images */}
                {selectedDiary.images && selectedDiary.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    {selectedDiary.images.map((image) => (
                      <StorageImage
                        key={image.id}
                        url={image.imageUrl}
                        alt="Diary"
                        className="w-full h-48 object-cover rounded"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* User Detail Panel - Slides in from right */}
      {selectedUser && (
        <>
          {/* Overlay Background */}
          <div
            className="fixed inset-0 bg-black/30 z-40 animate-overlay-fade"
            onClick={() => setSelectedUserId(null)}
          />
          
          {/* Detail Panel */}
          <div className="fixed right-0 top-0 h-full w-[500px] bg-white shadow-2xl z-50 overflow-y-auto animate-slide-in-right">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 z-10">
              <button
                onClick={() => setSelectedUserId(null)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>목록으로</span>
              </button>
            </div>

            {/* User Profile Header */}
            <div className="px-6 py-6 border-b border-gray-200">
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  {selectedUser.profile?.profileImageUrl ? (
                    <StorageImage
                      url={selectedUser.profile.profileImageUrl}
                      alt={selectedUser.profile.name || selectedUser.email}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-gray-500" />
                  )}
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedUser.profile?.name || selectedUser.email}
                </h2>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setUserDetailTab('profile')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    userDetailTab === 'profile'
                      ? 'bg-gray-200 text-gray-900'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  프로필
                </button>
                <button
                  onClick={() => setUserDetailTab('subscription')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    userDetailTab === 'subscription'
                      ? 'bg-gray-200 text-gray-900'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  구독이력
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              {userDetailTab === 'profile' && (
                <div className="space-y-0">
                  <div className="flex items-center justify-between py-3 border-b border-gray-200">
                    <label className="text-sm font-medium text-gray-900">메일 주소</label>
                    <p className="text-sm text-gray-900">{selectedUser.email}</p>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-200">
                    <label className="text-sm font-medium text-gray-900">이름</label>
                    <p className="text-sm text-gray-900">{selectedUser.profile?.name || '-'}</p>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-200">
                    <label className="text-sm font-medium text-gray-900">닉네임</label>
                    <p className="text-sm text-gray-900">{selectedUser.profile?.nickname || '-'}</p>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-200">
                    <label className="text-sm font-medium text-gray-900">생년월일</label>
                    <p className="text-sm text-gray-900">{formatDateOfBirth(selectedUser.profile?.dateOfBirth)}</p>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-200">
                    <label className="text-sm font-medium text-gray-900">생성일</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedUser.createdAt)}</p>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-200">
                    <label className="text-sm font-medium text-gray-900">구독유무</label>
                    <p className="text-sm text-gray-900">
                      {selectedUser.hasActiveSubscription ? '구독' : '미구독'}
                    </p>
                  </div>
                </div>
              )}

              {userDetailTab === 'subscription' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">구독 상세 내역</h3>
                  <div className="space-y-0">
                    <div className="grid grid-cols-4 gap-4 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 border-b border-gray-200">
                      <div>결제일</div>
                      <div>상품명</div>
                      <div>결제금액</div>
                      <div>상태/관리</div>
                    </div>
                    {userPayments.length === 0 ? (
                      <div className="px-4 py-8 text-sm text-center text-gray-500">
                        구독 이력이 없습니다.
                      </div>
                    ) : (
                      userPayments.map((payment) => {
                        // 결제일 = paidAt 또는 createdAt
                        const paymentDate = payment.paidAt || payment.createdAt;
                        
                        // 상태 결정 로직
                        let status: '결제완료' | '취소됨' | '만료됨' = '만료됨';
                        let statusClass = 'bg-gray-100 text-gray-600';
                        
                        if (payment.status === 'completed' && payment.subscription) {
                          const subscription = payment.subscription;
                          const now = new Date();
                          const endDate = subscription.endDate ? new Date(subscription.endDate) : null;
                          
                          if (subscription.status === 'cancelled') {
                            status = '취소됨';
                            statusClass = 'bg-red-100 text-red-800';
                          } else if (subscription.status === 'active' && (!endDate || endDate >= now)) {
                            status = '결제완료';
                            statusClass = 'bg-green-100 text-green-800';
                          } else if (endDate && endDate < now) {
                            status = '만료됨';
                            statusClass = 'bg-gray-100 text-gray-600';
                          } else if (subscription.status === 'expired') {
                            status = '만료됨';
                            statusClass = 'bg-gray-100 text-gray-600';
                          }
                        } else if (payment.status === 'completed' && !payment.subscription) {
                          // 구독 정보가 없으면 결제일 기준으로 30일 지났는지 확인
                          const paymentDateObj = new Date(paymentDate);
                          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                          if (paymentDateObj >= thirtyDaysAgo) {
                            status = '결제완료';
                            statusClass = 'bg-green-100 text-green-800';
                          } else {
                            status = '만료됨';
                            statusClass = 'bg-gray-100 text-gray-600';
                          }
                        }
                        
                        return (
                          <div key={payment.id} className="grid grid-cols-4 gap-4 px-4 py-3 text-sm border-b border-gray-200">
                            <div className="text-gray-900">{formatDate(paymentDate)}</div>
                            <div className="text-gray-900">Monthly Plan</div>
                            <div className="text-gray-900">
                              {parseFloat(payment.amount).toLocaleString('ko-KR')}원
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs ${statusClass}`}>
                                {status}
                              </span>
                              {payment.subscription && payment.subscription.status === 'active' && (
                                <button
                                  onClick={async () => {
                                    if (!selectedUserId || !payment.subscription) return;
                                    if (!confirm('해당 유저의 구독을 취소하시겠습니까?')) return;
                                    try {
                                      await adminCancelSubscription.mutateAsync({
                                        userId: selectedUserId,
                                        subscriptionId: payment.subscription.id,
                                      });
                                      alert('구독이 취소되었습니다.');
                                    } catch (err) {
                                      alert(err instanceof Error ? err.message : '구독 취소에 실패했습니다.');
                                    }
                                  }}
                                  disabled={adminCancelSubscription.isPending}
                                  className="px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                >
                                  {adminCancelSubscription.isPending ? '취소 중...' : '구독 취소'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
