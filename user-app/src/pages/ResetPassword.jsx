import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LuLock as Lock, LuArrowRight as ArrowRight, LuLoaderCircle as Loader2 } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../stores/authStore';
import BackButton from '../components/BackButton';
import AppLogo from '../components/AppLogo';

const ResetPassword = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const confirmPasswordReset = useAuthStore((state) => state.confirmPasswordReset);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const userId = searchParams.get('userId');
    const secret = searchParams.get('secret');
    const isValidLink = Boolean(userId && secret);

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => navigate('/login'), 3000);
            return () => clearTimeout(timer);
        }
    }, [success, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isValidLink) {
            setError(t('reset_link_invalid', 'This reset link is invalid or expired.'));
            return;
        }

        setError(null);
        setLoading(true);
        const ok = await confirmPasswordReset(userId, secret, password, confirmPassword);
        if (ok) {
            setSuccess(true);
        } else {
            setError(useAuthStore.getState().error || t('reset_password_failed', 'Failed to reset password.'));
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#F5F5F7] dark:bg-black flex flex-col px-6 py-12 pt-safe relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-500/5 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="max-w-md mx-auto w-full mb-8">
                <BackButton to="/login" />
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative">
                <div className="flex justify-center mb-8">
                    <AppLogo size="md" shellClassName="shadow-xl shadow-brand-500/20 dark:shadow-brand-900/40 active:scale-95 transition-transform cursor-pointer" />
                </div>

                <h2 className="text-center text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                    {t('new_password_title', 'New password')}
                </h2>
                <p className="mt-3 text-center text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">
                    {t('new_password_subtitle', 'Set a new password for your account')}
                </p>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative">
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl py-10 px-8 shadow-soft border border-white dark:border-white/5 rounded-[3rem]">
                    {!isValidLink ? (
                        <div className="space-y-4 text-center">
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                                {t('reset_link_invalid', 'This reset link is invalid or expired.')}
                            </p>
                            <Link
                                to="/forgot-password"
                                className="tap-target inline-flex items-center justify-center gap-2 w-full min-h-11 py-4 bg-black dark:bg-white text-white dark:text-black rounded-[1.5rem] text-[12px] font-black uppercase tracking-widest"
                            >
                                {t('request_new_link', 'Request a new link')}
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    ) : success ? (
                        <div className="space-y-4 text-center">
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                                {t('password_updated_redirecting', 'Password updated. Redirecting to login...')}
                            </p>
                            <Link
                                to="/login"
                                className="tap-target inline-flex items-center justify-center gap-2 w-full min-h-11 py-4 bg-black dark:bg-white text-white dark:text-black rounded-[1.5rem] text-[12px] font-black uppercase tracking-widest"
                            >
                                {t('go_to_login', 'Go to Login')}
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    ) : (
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {error && (
                                <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2">
                                    <p className="text-xs text-red-600 dark:text-red-400 font-bold text-center uppercase tracking-wider">{error}</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label htmlFor="password" className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                                    {t('new_password', 'New Password')}
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                        <Lock className="h-4 w-4 text-gray-300 group-focus-within:text-brand-500 transition-colors" />
                                    </div>
                                    <input
                                        id="password"
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder={t('password_min_placeholder')}
                                        className="block w-full pl-12 pr-6 py-4 bg-gray-50/50 dark:bg-black/20 border-gray-100 dark:border-white/5 focus:bg-white dark:focus:bg-black border focus:border-brand-500 dark:focus:border-brand-500 rounded-2xl text-[15px] font-bold transition-all outline-none text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-700 shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="confirmPassword" className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                                    {t('confirm_password', 'Confirm Password')}
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                        <Lock className="h-4 w-4 text-gray-300 group-focus-within:text-brand-500 transition-colors" />
                                    </div>
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder={t('reenter_password', 'Re-enter password')}
                                        className="block w-full pl-12 pr-6 py-4 bg-gray-50/50 dark:bg-black/20 border-gray-100 dark:border-white/5 focus:bg-white dark:focus:bg-black border focus:border-brand-500 dark:focus:border-brand-500 rounded-2xl text-[15px] font-bold transition-all outline-none text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-700 shadow-inner"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-brand-600 text-white rounded-[1.5rem] text-[15px] font-black uppercase tracking-[0.2em] hover:bg-black dark:hover:bg-white dark:hover:text-black active:scale-[0.98] transition-all focus:outline-none disabled:opacity-50 disabled:active:scale-100 shadow-xl shadow-brand-500/20"
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <span>{t('update_password', 'Update password')}</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
