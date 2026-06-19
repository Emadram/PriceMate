import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { LuCircleCheck as CheckCircle, LuCircleX as XCircle, LuLoaderCircle as Loader2, LuArrowRight as ArrowRight } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../stores/authStore';

const verificationRequests = new Map();

const VerifyEmail = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const verifyEmail = useAuthStore((state) => state.verifyEmail);
    const userId = searchParams.get('userId');
    const secret = searchParams.get('secret');
    const [status, setStatus] = useState(userId && secret ? 'verifying' : 'error'); // verifying, success, error

    useEffect(() => {
        if (!userId || !secret) return;

        const requestKey = `${userId}:${secret}`;

        let isActive = true;

        const executeVerification = async () => {
            let requestPromise = verificationRequests.get(requestKey);
            if (!requestPromise) {
                requestPromise = verifyEmail(userId, secret);
                verificationRequests.set(requestKey, requestPromise);
            }

            const success = await requestPromise;
            if (!isActive) return;

            setStatus(success ? 'success' : 'error');
            if (success) {
                setTimeout(() => {
                    if (isActive) navigate('/login');
                }, 3000);
            }

            if (verificationRequests.get(requestKey) === requestPromise) {
                verificationRequests.delete(requestKey);
            }
        };

        executeVerification();

        return () => { isActive = false; };
    }, [userId, secret, verifyEmail, navigate]);

    return (
        <div className="min-h-screen bg-[#F5F5F7] dark:bg-black flex flex-col items-center justify-center px-6 py-12 pt-safe">
            <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-[3rem] p-12 shadow-soft border border-gray-100 dark:border-white/5 text-center">
                {status === 'verifying' && (
                    <div className="space-y-6">
                        <div className="flex justify-center">
                            <Loader2 className="h-16 w-16 text-brand-600 animate-spin" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            {t('verifying_email', 'Verifying Email')}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">
                            {t('verifying_email_description', 'Please wait while we confirm your email address...')}
                        </p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-center">
                            <div className="h-20 w-20 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center">
                                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-500" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            {t('email_verified', 'Email Verified!')}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">
                            {t('email_verified_description', 'Thank you for verifying your email. You can now use all features of PriceMate.')}
                        </p>
                        <div className="pt-4 text-[10px] text-gray-400 uppercase tracking-widest font-black">
                            {t('redirecting_to_login', 'Redirecting to login...')}
                        </div>
                        <Link
                            to="/login"
                            className="tap-target inline-flex items-center gap-2 px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-[12px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
                        >
                            {t('go_to_login', 'Go to Login')}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                )}

                {status === 'error' && (
                    <div className="space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-center">
                            <div className="h-20 w-20 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center">
                                <XCircle className="h-10 w-10 text-red-600 dark:text-red-500" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            {t('verification_failed', 'Verification Failed')}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">
                            {t('verification_failed_description', 'The verification link is invalid or has expired. Log in to request a new verification email.')}
                        </p>
                        <Link
                            to="/login"
                            className="tap-target inline-flex items-center gap-2 px-8 py-4 bg-brand-600 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
                        >
                            {t('go_to_login', 'Go to Login')}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VerifyEmail;
