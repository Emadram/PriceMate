import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../stores/authStore';
import BackButton from '../components/BackButton';

const Login = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const resendVerification = useAuthStore((state) => state.resendVerification);
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState(null);
    const [errorCode, setErrorCode] = useState(null);
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendCount, setResendCount] = useState(0);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => {
            setResendCooldown((prev) => Math.max(prev - 1, 0));
        }, 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setErrorCode(null);
        setLoading(true);

        const success = await login(formData.email, formData.password);
        if (success) {
            navigate('/');
        } else {
            const { error: storeError, errorCode: storeErrorCode } = useAuthStore.getState();
            setError(storeError || t('invalid_credentials'));
            setErrorCode(storeErrorCode || null);
            setLoading(false);
        }
    };

    const handleResendVerification = async () => {
        if (resendCooldown > 0 || resendLoading) return;
        if (!formData.email || !formData.password) {
            setError(t('resend_verification_need_credentials'));
            setErrorCode('email_not_verified');
            return;
        }

        setResendLoading(true);
        const success = await resendVerification(formData.email, formData.password);
        if (success) {
            const nextCount = resendCount + 1;
            setResendCount(nextCount);
            setResendCooldown(nextCount * 30);
        }
        setResendLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#F5F5F7] dark:bg-black flex flex-col px-6 py-12 pt-safe relative overflow-hidden">
            {/* Soft background decor */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-500/5 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="max-w-md mx-auto w-full mb-8">
                <BackButton to="/" />
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative">
                <div className="flex justify-center mb-8">
                    <div className="w-16 h-16 bg-brand-600 dark:bg-brand-700 rounded-[2rem] flex items-center justify-center shadow-xl shadow-brand-500/20 dark:shadow-brand-900/40 active:scale-95 transition-transform cursor-pointer">
                        <span className="text-white font-black text-3xl tracking-tighter">P</span>
                    </div>
                </div>
                
                <h2 className="text-center text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                    {t('login_title')}
                </h2>
                <p className="mt-3 text-center text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">
                    {t('login_subtitle')}
                </p>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative">
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl py-10 px-8 shadow-soft border border-white dark:border-white/5 rounded-[3rem]">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 space-y-3">
                                <p className="text-xs text-red-600 dark:text-red-400 font-bold text-center uppercase tracking-wider">{error}</p>
                                {errorCode === 'email_not_verified' && (
                                    <button
                                        type="button"
                                        onClick={handleResendVerification}
                                        disabled={resendLoading || resendCooldown > 0}
                                        className="w-full py-3 bg-white text-red-600 border border-red-200 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-red-50 disabled:opacity-60"
                                    >
                                        {resendLoading
                                            ? t('resend_sending')
                                            : resendCooldown > 0
                                                ? t('resend_in', { seconds: resendCooldown })
                                                : t('resend_verification_email')}
                                    </button>
                                )}
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
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="name@example.com"
                                    className="block w-full pl-12 pr-6 py-4 bg-gray-50/50 dark:bg-black/20 border-gray-100 dark:border-white/5 focus:bg-white dark:focus:bg-black border focus:border-brand-500 dark:focus:border-brand-500 rounded-2xl text-[15px] font-bold transition-all outline-none text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-700 shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label htmlFor="password" className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                                    {t('password')}
                                </label>
                                <Link to="/forgot-password" className="tap-target inline-flex items-center justify-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
                                    {t('forgot')}
                                </Link>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-gray-300 group-focus-within:text-brand-500 transition-colors" />
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="••••••••"
                                    className="block w-full pl-12 pr-6 py-4 bg-gray-50/50 dark:bg-black/20 border-gray-100 dark:border-white/5 focus:bg-white dark:focus:bg-black border focus:border-brand-500 dark:focus:border-brand-500 rounded-2xl text-[15px] font-bold transition-all outline-none text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-700 shadow-inner"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-brand-600 dark:bg-brand-700 text-white rounded-[1.5rem] text-[15px] font-black uppercase tracking-[0.2em] hover:bg-black dark:hover:bg-brand-600 active:scale-[0.98] transition-all focus:outline-none disabled:opacity-50 disabled:active:scale-100 shadow-xl shadow-brand-500/20 dark:shadow-brand-900/40"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <span>{t('sign_in')}</span>
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="mt-10 text-center text-[14px] text-gray-500 font-medium">
                    {t('dont_have_account')}{' '}
                    <Link to="/register" className="tap-target inline-flex items-center justify-center px-2 py-1 rounded-lg font-black text-brand-600 dark:text-brand-400 hover:text-black dark:hover:text-brand-300 transition-colors uppercase tracking-widest text-[11px] ml-1">
                        {t('create_one')}
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
