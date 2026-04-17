"use client";

import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: Date;
  isWhale?: boolean;
  isYou?: boolean;
}

export default function LiveChat() {
  const { connected, connect, publicKey } = useWallet();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  if (!connected) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 h-[calc(100vh-300px)] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span>💬</span> Arena Chat
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-gray-400 mb-4">Connect wallet to join the conversation</p>
            <button
              onClick={connect}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold hover:scale-105 transition-transform"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mock initial messages
  useEffect(() => {
    const mockMessages: Message[] = [
      { id: '1', user: '8Px...3F2', text: 'DOGE to the moon! 🚀', timestamp: new Date(Date.now() - 300000), isWhale: true },
      { id: '2', user: '7Bs...9K1', text: 'PEPE season baby', timestamp: new Date(Date.now() - 240000) },
      { id: '3', user: '3Jf...2M8', text: '10 SOL bet on SHIB', timestamp: new Date(Date.now() - 180000), isWhale: true },
      { id: '4', user: '9x2...4L7', text: 'This is so addictive!', timestamp: new Date(Date.now() - 120000) },
      { id: '5', user: '4kL...6N3', text: 'Let\'s gooo! 🔥', timestamp: new Date(Date.now() - 60000) },
    ];
    setMessages(mockMessages);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simulate incoming messages
  useEffect(() => {
    const mockUsers = ['5nR...8P9', '2qT...1Q4', '6rU...5R2'];
    const mockTexts = ['Nice bet!', 'Whale alert! 🐋', 'PEPE gonna win', 'SHIB army where?', 'LFG! 🚀'];
    
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const newMessage: Message = {
          id: Date.now().toString(),
          user: mockUsers[Math.floor(Math.random() * mockUsers.length)],
          text: mockTexts[Math.floor(Math.random() * mockTexts.length)],
          timestamp: new Date(),
          isWhale: Math.random() > 0.8,
        };
        setMessages(prev => [...prev.slice(-20), newMessage]);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const sendMessage = () => {
    if (!inputText.trim()) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      user: publicKey ? publicKey.toString().slice(0, 6) + '...' : 'You',
      text: inputText,
      timestamp: new Date(),
      isYou: true,
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setIsTyping(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 h-[calc(100vh-300px)] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <span>💬</span> Arena Chat
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-400">Live</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-2 mb-3 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-2 ${msg.isYou ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              msg.isWhale 
                ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400' 
                : msg.isYou
                ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400'
                : 'bg-gray-700 text-gray-300'
            }`}>
              {msg.user.slice(0, 2).toUpperCase()}
            </div>
            <div className={`flex-1 ${msg.isYou ? 'text-right' : ''}`}>
              <div className={`flex items-center gap-2 ${msg.isYou ? 'justify-end' : ''}`}>
                <span className={`text-xs font-bold ${msg.isYou ? 'text-purple-400' : 'text-cyan-400'}`}>
                  {msg.user}
                </span>
                {msg.isWhale && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">WHALE</span>
                )}
                <span className="text-[10px] text-gray-500">{formatTime(msg.timestamp)}</span>
              </div>
              <div className={`text-sm mt-0.5 ${msg.isYou ? 'text-purple-300' : 'text-gray-300'}`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            setIsTyping(true);
          }}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
          maxLength={100}
        />
        <button
          onClick={sendMessage}
          disabled={!inputText.trim()}
          className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          Send
        </button>
      </div>
    </div>
  );
}
