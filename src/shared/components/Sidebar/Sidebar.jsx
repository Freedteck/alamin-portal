import React, { useState, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Camera } from 'lucide-react';
import { Logo } from '../Logo/Logo';
import { ProfileAvatar } from '../ProfileAvatar/ProfileAvatar';
import { apiClient } from '../../lib/apiClient';
import { schoolStore } from '../../data/schoolData';

export function Sidebar({ items = [], onLogout }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('alamin_user') || '{}');
    } catch {
      return {};
    }
  });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const res = await schoolStore.uploadProfileAvatar(file);
      if (res?.avatarUrl) {
        setCurrentUser((prev) => ({ ...prev, avatarUrl: res.avatarUrl }));
      }
    } catch (err) {
      alert(err?.message || 'Failed to update profile photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleLogoutClick = async () => {
    if (onLogout) {
      await onLogout();
    } else {
      await apiClient.post('/auth/logout').catch(() => {});
      apiClient.clearToken();
      localStorage.removeItem('alamin_user');
      navigate('/login');
    }
  };

  return (
    <aside className="w-64 bg-[#fbf8ed] border-r border-[#c9c7b6] h-screen flex flex-col p-4 shrink-0 font-['Poppins',sans-serif]">
      <div className="mb-4 px-1 pt-1 pb-3 border-b border-[#c9c7b6]/60">
        <Logo variant="dark" className="h-11" showText={true} />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#616218] !text-white shadow-xs font-semibold'
                    : 'text-[#48482d] hover:bg-[#ece7d0] hover:text-[#1c1c14]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {Icon && (
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? '!text-white' : 'text-[#616218] group-hover:text-[#1c1c14]'
                      }`}
                    />
                  )}
                  <span
                    className={`truncate transition-colors ${
                      isActive ? '!text-white font-semibold' : 'text-[#48482d] group-hover:text-[#1c1c14]'
                    }`}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="pt-3 mt-auto border-t border-[#c9c7b6]/60 space-y-2">
        <div className="flex items-center gap-2.5 px-2 py-2 bg-white/70 rounded-xl border border-[#c9c7b6]/40">
          <div className="relative group shrink-0">
            <ProfileAvatar src={currentUser?.avatarUrl} name={currentUser?.name || 'User'} size="sm" shape="circle" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              title="Change profile photo"
              className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#616218] hover:bg-[#494900] text-white rounded-full flex items-center justify-center shadow-xs cursor-pointer"
            >
              <Camera className="w-2.5 h-2.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#1c1c14] truncate">{currentUser?.name || 'Portal User'}</p>
            <p className="text-[10px] text-[#797869] capitalize truncate">
              {currentUser?.role === 'teacher' ? 'Staff' : currentUser?.role || 'User'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogoutClick}
          className="flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-xl transition-colors text-left cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0 text-red-600" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
