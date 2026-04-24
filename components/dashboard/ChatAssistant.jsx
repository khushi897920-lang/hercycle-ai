'use client'

// ── Suggestion chip definitions ───────────────────────────────────────────────
// Each chip has a visible label and the full message sent to the AI.
// Hindi variants are provided for the language toggle.
const CHIPS = {
  EN: [
    { label: '📅 Next period?',   message: 'When is my next period predicted?' },
    { label: '🩺 What is PCOD?',  message: 'Can you explain what PCOD/PCOS is?' },
    { label: '😖 Cramp relief?',  message: 'What helps with period cramps?' },
    { label: '🥗 Cycle nutrition?', message: 'What should I eat during my period?' },
  ],
  हि: [
    { label: '📅 अगला पीरियड?',      message: 'मेरा अगला पीरियड कब होगा?' },
    { label: '🩺 PCOD क्या है?',     message: 'PCOD/PCOS क्या होता है, समझाएं।' },
    { label: '😖 क्रैम्प्स से राहत?', message: 'पीरियड क्रैम्प्स से राहत के उपाय बताएं।' },
    { label: '🥗 चक्र पोषण?',        message: 'पीरियड के दौरान क्या खाना चाहिए?' },
  ],
}

export default function ChatAssistant({
  chatMessages,
  isTyping,
  chatInput,
  setChatInput,
  handleSendMessage,
  activeLang,
  nextPeriodDate,   // injected into AI context so it can answer date questions accurately
}) {
  // Chips disappear once the user has sent at least one message
  // (chatMessages starts with 1 AI greeting, so > 1 means user has replied)
  const showChips = chatMessages.length <= 1

  const chips = CHIPS[activeLang] || CHIPS.EN

  const handleChipClick = (chip) => {
    // Send the full message, optionally enriched with the predicted date
    const enrichedMessage = nextPeriodDate && chip.message.toLowerCase().includes('next period')
      ? `${chip.message} (My predicted date is ${nextPeriodDate})`
      : chip.message

    // Fill input briefly for visual feedback, then send
    setChatInput(chip.label)
    handleSendMessage(enrichedMessage)
  }

  return (
    <div className="chat-card glass">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-avatar">🤖</div>
        <h4>Health Assistant</h4>
      </div>

      {/* Message thread */}
      <div className="chat-messages">
        {chatMessages.map((msg, i) => (
          <div key={i} className={`bubble bubble-${msg.role}`}>
            {msg.text}
          </div>
        ))}
        {isTyping && (
          <div className="typing-indicator">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
        )}
      </div>

      {/* Quick-tap suggestion chips — shown only before first user message */}
      {showChips && (
        <div className="chat-chips" aria-label="Suggested questions">
          {chips.map((chip) => (
            <button
              key={chip.label}
              className="chat-chip"
              onClick={() => handleChipClick(chip)}
              title={chip.message}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="chat-input-row">
        <input
          type="text"
          className="chat-input"
          placeholder={activeLang === 'EN' ? 'Ask me anything...' : 'मुझसे कुछ भी पूछें...'}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <button className="chat-send-btn" onClick={handleSendMessage} aria-label="Send">➤</button>
      </div>
    </div>
  )
}
