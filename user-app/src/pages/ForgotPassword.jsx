import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../stores/authStore';
import BackButton from '../components/BackButton';

const ForgotPassword = () => {
    const { t } = useTranslation();
    const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState(null);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendCount, setResendCount] = useState(0);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => {
            setResendCooldown((prev) => Math.max(prev - 1, 0));
        }, 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const sendResetEmail = async () => {
        if (resendCooldown > 0) return false;
        setError(null);
        setLoading(true);

        const success = await requestPasswordReset(email);
        if (success) {
            setSent(true);
            const nextCount = resendCount + 1;
            setResendCount(nextCount);
            setResendCooldown(nextCount * 30);
        } else {
            setError(useAuthStore.getState().error || t('reset_email_failed', 'Failed to send reset email.'));
        }
        setLoading(false);
        return success;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await sendResetEmail();
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
                    <div className="w-16 h-16 bg-white/90 dark:bg-gray-900/60 rounded-[2rem] flex items-center justify-center shadow-xl shadow-brand-500/20 active:scale-95 transition-transform cursor-pointer border border-gray-100/70 dark:border-gray-800/60 overflow-hidden">
                        <img
                            src="/LogoPriceMate.png"
                            alt="PriceMate"
                            className="h-full w-full object-contain p-2"
                            loading="eager"
                            decoding="async"
                        />
                    </div>
                </div>

                <h2 className="text-center text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                    {t('reset_password_title', 'Reset password')}
                </h2>
                <p className="mt-3 text-center text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">
                    {t('reset_password_subtitle', 'We will email you a reset link')}
                </p>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative">
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl py-10 px-8 shadow-soft border border-white dark:border-white/5 rounded-[3rem]">
                    {sent ? (
                        <div className="space-y-4 text-center">
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                                {t('reset_link_sent', 'Check your inbox for the password reset link.')}
                            </p>
                            <button
                                type="button"
                                onClick={sendResetEmail}
                                disabled={loading || resendCooldown > 0}
                                className="tap-target w-full min-h-11 py-4 bg-brand-600 text-white rounded-[1.5rem] text-[12px] font-black uppercase tracking-widest hover:bg-black dark:hover:bg-white dark:hover:text-black disabled:opacity-60"
                            >
                                {loading
                                    ? t('resend_sending')
                                    : resendCooldown > 0
                                        ? t('resend_in', { seconds: resendCooldown })
                                        : t('resend_reset_link', 'Resend Reset Link')}
                            </button>
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
                                <label htmlFor="email" className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                                    {t('email_address')}
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                        <Mail className="h-4 w-4 text-gray-300 group-focus-within:text-brand-500 transition-colors" />
                                    </div>
                                    <input
                                        id="email"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="name@example.com"
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
                                        <span>{t('send_reset_link', 'Send reset link')}</span>
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

export default ForgotPassword;
