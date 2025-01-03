import React from 'react';

const Chatbox = ({ messages, userInput, setUserInput, handleSend, handleKeyDown }) => {
  return (
    <div className="chatbox">
      <div className="messages">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${msg.sender === 'user' ? 'user' : 'ai'}`}
          >
            {msg.text}
          </div>
        ))}
      </div>
      <div className="input">
        <input
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Ask a question about products..."
          onKeyDown={handleKeyDown}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};

export default Chatbox;


















