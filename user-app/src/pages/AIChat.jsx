import AIChatBox from '../components/AIChatBox';
import { MobileHeader, MobilePage } from '../components/MobilePageLayout';
import { FiCpu } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

const AIChat = () => {
    const { t } = useTranslation();
    return (
        <MobilePage>
            <MobileHeader title={t('ai_chat_title', 'PriceMate AI')} icon={FiCpu} />
            <div className="max-w-4xl mx-auto">
                <AIChatBox isOpen variant="page" />
            </div>
        </MobilePage>
    );
};

export default AIChat;

