import { useNavigate } from 'react-router-dom';
import PricingSection4 from '../components/ui/pricing-section-4';
import { ArrowLeftIcon } from 'lucide-react';

export default function PricingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="fixed top-4 left-4 z-[100] flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white transition-colors"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
      >
        <ArrowLeftIcon size={13} />
        Back
      </button>

      <PricingSection4 />
    </div>
  );
}
