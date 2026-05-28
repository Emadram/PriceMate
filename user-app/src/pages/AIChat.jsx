import AIChatBox from '../components/AIChatBox';
import { MobilePage } from '../components/MobilePageLayout';

const AIChat = () => {
    return (
        <MobilePage>
            <div className="max-w-4xl mx-auto">
                <AIChatBox isOpen variant="page" />
            </div>
        </MobilePage>
    );
};

export default AIChat;

