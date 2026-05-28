import AIChatBox from '../components/AIChatBox';
import { MobileHeader, MobilePage } from '../components/MobilePageLayout';
import { FiCpu } from 'react-icons/fi';

const AIChat = () => {
    return (
        <MobilePage>
            <MobileHeader title="PriceMate AI" icon={FiCpu} />
            <div className="max-w-4xl mx-auto">
                <AIChatBox isOpen variant="page" />
            </div>
        </MobilePage>
    );
};

export default AIChat;

