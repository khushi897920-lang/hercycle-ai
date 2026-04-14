export default function ChatAssistant({ chatMessages, isTyping, chatInput, setChatInput, handleSendMessage, activeLang }) {
  return (
    <div className="chat-card glass">
      <div className="chat-header">
        <div className="chat-avatar">🤖</div>
        <h4>Health Assistant</h4>
      </div>

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

      <div className="chat-input-row">
        <input
          type="text"
          className="chat-input"
          placeholder={activeLang === 'EN' ? 'Ask me anything...' : 'मुझसे कुछ भी पूछें...'}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <button className="chat-send-btn" onClick={handleSendMessage}>➤</button>
      </div>
    </div>
  );
}
