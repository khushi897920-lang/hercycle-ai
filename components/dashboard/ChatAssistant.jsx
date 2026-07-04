'use client'

import { useTranslations } from 'next-intl'

export default function ChatAssistant({
  chatMessages,
  isTyping,
  chatInput,
  setChatInput,
  handleSendMessage,
  nextPeriodDate,   // injected into AI context so it can answer date questions accurately
}) {
  const t = useTranslations('Chat')

  // Chips disappear once the user has sent at least one message
  // (chatMessages starts with 1 AI greeting, so > 1 means user has replied)
  const showChips = chatMessages.length <= 1

  const chips = [
    { label: t('chips.nextPeriod'), message: t('chips.nextPeriodMsg') },
    { label: t('chips.pcod'), message: t('chips.pcodMsg') },
    { label: t('chips.cramps'), message: t('chips.crampsMsg') },
    { label: t('chips.nutrition'), message: t('chips.nutritionMsg') },
  ]

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
        <h4>{t('header')}</h4>
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
          placeholder={t('placeholder')}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <button className="chat-send-btn" onClick={()=>handleSendMessage()} aria-label="Send">➤</button>
      </div>
    </div>
  )
}
