"use client";

import { useState } from 'react';

const faqs = [
  { question: "How is PCOD risk calculated?", answer: "Our AI model analyzes your symptoms, menstrual cycle data, and lifestyle factors to estimate your risk. It is not a substitute for professional medical advice." },
  { question: "Is my data private?", answer: "Yes. Your data is encrypted and we do not share your personal health information with third parties without your explicit consent." },
  { question: "Can I share my data with my partner?", answer: "Yes, you can enable partner sharing in your settings to share specific cycle and health data with your partner." }
];

export default function HelpModal({ isOpen, onClose }) {
  const [openFaq, setOpenFaq] = useState(null);
  const [message, setMessage] = useState('');
  const [type, setType] = useState('bug');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Message cannot be empty');
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, type })
      });

      if (!res.ok) throw new Error('Failed to submit feedback');

      setSuccess(true);
      setMessage('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 3000);
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Help & Support</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            ✕
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Frequently Asked Questions</h3>
          <div className="space-y-2 mb-8">
            {faqs.map((faq, idx) => (
              <div key={idx} className="border border-white/10 rounded-lg overflow-hidden bg-white/5">
                <button
                  className="w-full px-4 py-3 text-left text-white font-medium flex justify-between items-center focus:outline-none"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                >
                  {faq.question}
                  <span className="text-white/50">{openFaq === idx ? '−' : '+'}</span>
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-3 text-white/70 text-sm animate-in slide-in-from-top-2 duration-200">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>

          <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Submit Feedback</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Feedback Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="bug">Report a Bug</option>
                <option value="feature">Feature Request</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what went wrong or what you'd like to see..."
                rows={4}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              ></textarea>
              {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
            {success && (
              <div className="bg-green-500/20 border border-green-500/50 text-green-400 text-sm px-4 py-2 rounded-lg text-center animate-in fade-in zoom-in duration-300">
                Message sent successfully!
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
