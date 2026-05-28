import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Loader2, CheckCircle2, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../stores/authStore';
import BackButton from '../components/BackButton';

const ALLERGY_OPTIONS = [
    { id: 'milk', labelKey: 'allergy_option_milk' },
    { id: 'lactose', labelKey: 'allergy_option_lactose' },
    { id: 'gluten', labelKey: 'allergy_option_gluten' },
    { id: 'peanut', labelKey: 'allergy_option_peanut' },
    { id: 'tree nuts', labelKey: 'allergy_option_tree_nuts' },
    { id: 'soy', labelKey: 'allergy_option_soy' },
    { id: 'egg', labelKey: 'allergy_option_egg' },
    { id: 'fish', labelKey: 'allergy_option_fish' },
    { id: 'shellfish', labelKey: 'allergy_option_shellfish' },
    { id: 'sesame', labelKey: 'allergy_option_sesame' }
];

const Register = () => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: ''
    });
    const [selectedAllergies, setSelectedAllergies] = useState([]);
    const [noKnownAllergies, setNoKnownAllergies] = useState(false);
    const [allergyError, setAllergyError] = useState('');
    const signup = useAuthStore((state) => state.signup);
    const error = useAuthStore((state) => state.error);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const hasAnsweredAllergyQuestion = noKnownAllergies || selectedAllergies.length > 0;

    const toggleAllergy = (id) => {
        setAllergyError('');
        setNoKnownAllergies(false);
        setSelectedAllergies((prev) =>
            prev.includes(id)
                ? prev.filter((item) => item !== id)
                : [...prev, id]
        );
    };

    const toggleNoKnownAllergies = () => {
        setAllergyError('');
        setNoKnownAllergies((prev) => {
            const next = !prev;
            if (next) setSelectedAllergies([]);
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!hasAnsweredAllergyQuestion) {
            setAllergyError(t('allergy_profile_required_error'));
            return;
        }

        setLoading(true);
        const signupAllergies = noKnownAllergies ? [] : selectedAllergies;
        const success = await signup(formData.email, formData.password, formData.name, signupAllergies);
        if (success) {
            // Redirect to login page instead of Home, since they are logged out
            // until they verify their email.
            navigate('/login');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#F5F5F7] dark:bg-black flex flex-col px-6 py-12 pt-safe relative overflow-hidden">
            {/* Soft background decor */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-500/5 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="max-w-md mx-auto w-full mb-8">
                <BackButton to="/" />
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
                    {t('register_title')}
                </h2>
                <p className="mt-3 text-center text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">
                    {t('register_subtitle')}
                </p>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative">
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl py-10 px-8 shadow-soft border border-white dark:border-white/5 rounded-[3rem]">
                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2">
                                <p className="text-xs text-red-600 dark:text-red-400 font-bold text-center uppercase tracking-wider">{error}</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="name" className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                                {t('full_name')}
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                    <User className="h-4 w-4 text-gray-300 group-focus-within:text-brand-500 transition-colors" />
                                </div>
                                <input
                                    id="name"
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="John Doe"
                                    className="block w-full pl-12 pr-6 py-4 bg-gray-50/50 dark:bg-black/20 border-gray-100 dark:border-white/5 focus:bg-white dark:focus:bg-black border focus:border-brand-500 dark:focus:border-brand-500 rounded-2xl text-[15px] font-bold transition-all outline-none text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-700 shadow-inner"
                                />
                            </div>
                        </div>

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
                            <label htmlFor="password" className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                                {t('password')}
                            </label>
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
                                    placeholder={t('password_min_placeholder')}
                                    className="block w-full pl-12 pr-6 py-4 bg-gray-50/50 dark:bg-black/20 border-gray-100 dark:border-white/5 focus:bg-white dark:focus:bg-black border focus:border-brand-500 dark:focus:border-brand-500 rounded-2xl text-[15px] font-bold transition-all outline-none text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-700 shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-black/30 p-4">
                            <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-brand-500" />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                                    {t('allergy_profile_required_title')}
                                </p>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                                {t('allergy_profile_register_description')}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {ALLERGY_OPTIONS.map((item) => {
                                    const active = selectedAllergies.includes(item.id);
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => toggleAllergy(item.id)}
                                            className={`min-h-10 rounded-xl border px-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                                                active
                                                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                                    : 'bg-white/70 dark:bg-gray-900/60 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                            }`}
                                        >
                                            {t(item.labelKey)}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                onClick={toggleNoKnownAllergies}
                                className={`w-full min-h-10 rounded-xl border px-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                                    noKnownAllergies
                                        ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                        : 'bg-white/70 dark:bg-gray-900/60 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                }`}
                            >
                                {t('allergy_profile_none')}
                            </button>
                            {allergyError && (
                                <p className="text-[11px] font-bold text-red-600 dark:text-red-400">{allergyError}</p>
                            )}
                        </div>

                        <div className="py-2">
                           <div className="flex items-start gap-3 px-1">
                                <CheckCircle2 className="w-4 h-4 text-green-500 mt-1 shrink-0" />
                                <p className="text-[11px] text-gray-400 font-medium leading-relaxed uppercase tracking-wider">
                                    {t('terms_agree_prefix')} <span className="text-brand-600 font-black cursor-pointer">{t('terms')}</span> {t('terms_and', 'and')} <span className="text-brand-600 font-black cursor-pointer">{t('privacy_policy')}</span>.
                                </p>
                           </div>
                        </div>

                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium text-center">
                            {t('verification_email_notice')}
                        </p>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-brand-600 text-white rounded-[1.5rem] text-[15px] font-black uppercase tracking-[0.2em] hover:bg-black dark:hover:bg-white dark:hover:text-black active:scale-[0.98] transition-all focus:outline-none disabled:opacity-50 disabled:active:scale-100 shadow-xl shadow-brand-500/20"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <span>{t('create_account')}</span>
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="mt-10 text-center text-[14px] text-gray-500 font-medium">
                    {t('already_have_account')}{' '}
                    <Link to="/login" className="tap-target inline-flex items-center justify-center px-2 py-1 rounded-lg font-black text-brand-600 dark:text-brand-500 hover:text-black dark:hover:text-white transition-colors uppercase tracking-widest text-[11px] ml-1">
                        {t('sign_in')}
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Register;
