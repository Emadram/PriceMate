import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../stores/authStore';
import { FiHeart, FiMessageSquare, FiShield, FiChevronRight, FiLogOut, FiUser } from 'react-icons/fi';
import BackButton from '../components/BackButton';

const Profile = () => {
    const { t } = useTranslation();
    const { user, logout, updateProfileName, updatePasswordWhileLoggedIn } = useAuthStore();

    const [displayName, setDisplayName] = useState('');
    const [nameSaving, setNameSaving] = useState(false);

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordSaving, setPasswordSaving] = useState(false);

    useEffect(() => {
        if (user?.name != null) setDisplayName(user.name);
    }, [user?.$id, user?.name]);

    if (!user) return <Navigate to="/login" />;

    const initials = user.name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U';

    const joinDate = new Date(user.$createdAt).getFullYear();

    const handleSaveName = async (e) => {
        e.preventDefault();
        if (displayName.trim() === (user.name || '').trim()) return;
        setNameSaving(true);
        try {
            await updateProfileName(displayName);
        } finally {
            setNameSaving(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordSaving(true);
        try {
            const ok = await updatePasswordWhileLoggedIn(oldPassword, newPassword, confirmPassword);
            if (ok) {
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } finally {
            setPasswordSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F5F5F7] dark:bg-black text-gray-900 dark:text-gray-100 pb-safe">
            <header className="bg-white/80 dark:bg-black/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 dark:border-white/5 p-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <BackButton to="/" />
                    <h1 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <FiUser className="text-brand-600" />
                        {t('profile')}
                    </h1>
                    <div className="w-10" />
                </div>
            </header>

            <div className="max-w-md mx-auto px-6 pt-6">
                {/* Profile Top Section */}
                <div className="flex flex-col items-center text-center mb-12">
                    <div className="h-24 w-24 bg-white dark:bg-gray-900 rounded-[2rem] flex items-center justify-center text-brand-600 dark:text-brand-500 text-3xl font-black shadow-soft mb-6 border border-gray-100 dark:border-gray-800">
                        {initials}
                    </div>
                    <h1 className="text-3xl font-black tracking-tight mb-1">
                        {user.name}
                    </h1>
                    <p className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-widest">
                        Member since {joinDate}
                    </p>
                </div>

                {/* Settings Groups */}
                <div className="space-y-6">
                    {/* Activity Group */}
                    <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-2 shadow-soft border border-gray-100/50 dark:border-gray-800/50">
                        <Link
                            to="/favorites"
                            state={{ from: '/profile' }}
                            className="flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-[2rem] transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <span
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-500 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-400"
                                    aria-hidden
                                >
                                    <FiHeart size={22} className="fill-current" strokeWidth={2} />
                                </span>
                                <span className="font-bold tracking-tight">{t('favorites', 'My Favorites')}</span>
                            </div>
                            <FiChevronRight className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                        </Link>

                        <div className="h-px bg-gray-100/50 dark:bg-gray-800/50 mx-6" />

                        <Link
                            to="/feedback"
                            className="flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-[2rem] transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="tap-target h-11 w-11 flex items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-900/20 text-brand-600">
                                    <FiMessageSquare size={20} />
                                </div>
                                <span className="font-bold tracking-tight">{t('send_feedback', 'Send Feedback')}</span>
                            </div>
                            <FiChevronRight className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>

                    {/* Account Info */}
                    <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 shadow-soft border border-gray-100/50 dark:border-gray-800/50 space-y-6">
                        <div>
                            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-1 block">Email Address</span>
                            <span className="font-bold text-sm tracking-tight">{user.email}</span>
                        </div>
                        <div className="h-px bg-gray-100/50 dark:bg-gray-800/50" />

                        <form onSubmit={handleSaveName} className="space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                                <FiUser size={12} className="text-brand-600" />
                                <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">Display name</span>
                            </div>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                autoComplete="name"
                                className="w-full min-h-11 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/30"
                            />
                            <button
                                type="submit"
                                disabled={nameSaving || displayName.trim() === (user.name || '').trim() || !displayName.trim()}
                                className="tap-target w-full min-h-11 rounded-2xl bg-black dark:bg-white py-3 text-xs font-black uppercase tracking-widest text-white dark:text-black transition-opacity disabled:opacity-40 disabled:pointer-events-none hover:opacity-90"
                            >
                                {nameSaving ? t('saving', 'Saving…') : t('save_name', 'Save name')}
                            </button>
                        </form>

                        <div className="h-px bg-gray-100/50 dark:bg-gray-800/50" />

                        <form onSubmit={handleChangePassword} className="space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                                <FiShield size={12} className="text-amber-500" />
                                <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">Change password</span>
                            </div>
                            <input
                                type="password"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                autoComplete="current-password"
                                placeholder={t('current_password', 'Current password')}
                                className="w-full min-h-11 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/30 placeholder:text-gray-400"
                            />
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                autoComplete="new-password"
                                placeholder={t('new_password', 'New password (min 8 characters)')}
                                className="w-full min-h-11 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/30 placeholder:text-gray-400"
                            />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                                placeholder={t('confirm_new_password', 'Confirm new password')}
                                className="w-full min-h-11 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/30 placeholder:text-gray-400"
                            />
                            <button
                                type="submit"
                                disabled={passwordSaving || !oldPassword || !newPassword || !confirmPassword}
                                className="tap-target w-full min-h-11 rounded-2xl border border-gray-200 dark:border-gray-600 py-3 text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white transition-opacity disabled:opacity-40 disabled:pointer-events-none hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                {passwordSaving ? t('updating', 'Updating…') : t('update_password', 'Update password')}
                            </button>
                        </form>

                        <div className="h-px bg-gray-100/50 dark:bg-gray-800/50" />
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <FiShield size={12} className="text-green-500" />
                                <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">Account Identity</span>
                            </div>
                            <span className="font-mono text-[9px] text-gray-400 break-all">{user.$id}</span>
                        </div>
                    </div>
                </div>

                {/* Logout Action */}
                <div className="mt-12 text-center">
                    <button
                        onClick={() => logout()}
                        className="tap-target inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all active:scale-95"
                    >
                        <FiLogOut size={16} />
                        {t('logout', 'Sign Out')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Profile;
