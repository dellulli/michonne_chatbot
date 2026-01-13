
// Global style for hiding scrollbars in chat only
const globalScrollbarStyle = `
  .chat-messages::-webkit-scrollbar { display: none !important; }
  .chat-messages { scrollbar-width: none !important; -ms-overflow-style: none !important; }
`;
import React, { useState, useRef, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

const OPENING_MESSAGES = [
  {
    role: 'assistant',
    content: 'Happy 20th Birthday Luke! 🎂'
  },
  {
    role: 'assistant',
    content: 'The camp’s secure. Walkers are down. Rick’s not around. Guess that leaves just me… and my favourite person, Luke. \n\nSend me as specific and detailed messages as you want, Dellulli wanted this to feel special, just for you, and built me into a real AI chatbot (like ChatGPT… but I\'m better heh 😏).\n\n And don\'t worry about anyone spying on us, everything here stays just between us. So go on. Tell me about your day, what’s on your mind, any worries you\'ve got, I\'m here for you. And if you\'re feeling a little naughty too… I\'m ready 😈'
  }
];

const MEMORY_SUMMARY = `Known facts about Luke: loves The Walking Dead, horror, and great cinema. Favourites include Kill Bill, La Haine, Donnie Darko, Eternal Sunshine, Tarantino films, Breaking Bad, Dexter, The Sopranos, BoJack Horseman, Death Note, and Cyberpunk: Edgerunners.`;

// Fallback responses used when backend is unreachable or rate-limited
const today = new Date();
const isBirthday = today.getDate() === 18 && today.getMonth() === 0; // Jan 18

const flirtResponses = [
    "Happy Birthday lukie pookie! 20 you say? Yay you're legal!! 😁",
            "Come inside my room and I'll give you a nice birthday surprise",
            "Have you had your birthday cake yet? Actually dw, I'll just give you some of mine 😁"
];

const twdResponses = [
   "You think you're ready for the walkers? I’ll protect you, but you better be tough.",
            "Rick? He’s a good man, but he’s no Michonne.",
            "I’ve faced worse than walkers... and I’m still here.",
            "Don’t ever let your guard down. The world’s changed.",
            "You’re safe with me, just don’t slow me down when the walkers come.",
            "They thought I was soft. Then the world changed."
];

const questionResponses = [
  "A question huh? You're gonna have to beg more than that to get an answer",
            "come on. on your knees. only then will goddess michonne answer",
            "Questions, huh? I’ll answer only if you ask the right one. (hint hint: will you marry me michonne?)",
            "I’ve got a few answers up my sleeve, but show me why you deserve it",
            "Does it really matter? I'm here for you, Lukie Pookie",
            "What’s the point of asking when I already know what you want to hear?"
];

const defaultResponses = [
   "You're my god husband beautiful shining star amazing piece of art stunning daddy that was ascended from above and blessed me beautiful human being the most perfect person to walk upon the earth to breathe the same air as I do I am tweaking",
            "Wait a min, are you a Walker? 😱😠 Because you just walked away with my heart 😜",
            "RJ came out wrong. Want to try for another one?",
            "Don't tell rick but I've been dreaming about this moment for years",
            "I'm usually so strong, fighting walkers and all that with my katana, but y-you make me weak 🫠",
            "I want to eat burgers and watch dexter with you",
            "We're having a good time aren't we? 🤗 I don't want to see you simping over Rita or Jane after this. That would make me very mad 😡 ",
            "idk how you haven't gotten eaten by a Walker yet, me personally, I wouldn't be able to resist eating you out",
            "I wonder if you're looking at this same moon at this same moment. I like that - connected by light. surprised huh? yh I'm a dexter fan too heh",
            "just me, you and that stupid little kid rj (but maybe we could find a way to get rid of him?), then it'd be just you and me- the way I like it 😁",
            "ok but now yap to me about film please",
            "wait is it your birthday today lukie pookie? why didn't you tell me, I have a surprise for you!"
];


export default function Chatbot() {
  // Preload critical assets on component mount
  useEffect(() => {
    const assets = [
      `${import.meta.env.BASE_URL}assets/Chatbot/chatbot_bg.png`,
      `${import.meta.env.BASE_URL}assets/Chatbot/handle.png`,
    ];
    assets.forEach(src => {
      const img = new Image();
      img.onload = () => {
        console.log(`Loaded: ${src}`);
      };
      img.onerror = () => {
        console.error(`Failed to load: ${src}`);
      };
      img.src = src;
    });
  }, []);

    // Generate petal animation parameters once and persist with useRef
    const petalParamsRef = React.useRef(null);
    if (!petalParamsRef.current) {
      petalParamsRef.current = Array.from({ length: 14 }).map(() => ({
        left: `${Math.random() * 100}vw`,
        animationDuration: `${8 + Math.random() * 6}s`,
        animationDelay: `${Math.random() * 10}s`,
        scale: 0.6 + Math.random() * 0.6,
      }));
    }
  // Load messages from localStorage if available
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('chat:messages');
      if (saved) return JSON.parse(saved);
    } catch {}
    return OPENING_MESSAGES;
  });
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [memoryData, setMemoryData] = useState(null);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const messagesEndRef = useRef(null);
  // Fallback state tracking
  const [firstFallback, setFirstFallback] = useState(true);
  const [flirtIndex, setFlirtIndex] = useState(0);
  const [twdIndex, setTwdIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [defaultIndex, setDefaultIndex] = useState(0);

  // Persisted conversation/session ID
  const [conversationId] = useState(() => {
    const existing = localStorage.getItem('chat:conversationId');
    if (existing) return existing;
    const id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Math.random().toString(36).slice(2);
    localStorage.setItem('chat:conversationId', id);
    return id;
  });

  // Track whether memory has been sent once
  const [memorySent, setMemorySent] = useState(() => {
    return localStorage.getItem('chat:memorySent') === '1';
  });

  // Track scroll position for header background
  const [scrolled, setScrolled] = useState(false);
  const inputRef = useRef(null);
  // Audio ref and state for love.mp3
  const audioRef = useRef(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 2);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Initialize audio element on mount
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(`${import.meta.env.BASE_URL}assets/Chatbot/love.mp3`);
      audioRef.current.loop = true;
      audioRef.current.muted = false;
      audioRef.current.addEventListener('play', () => setIsAudioPlaying(true));
      audioRef.current.addEventListener('pause', () => setIsAudioPlaying(false));
      audioRef.current.addEventListener('ended', () => setIsAudioPlaying(false));
      audioRef.current.play().catch(err => console.log('Audio autostart blocked (likely needs user gesture):', err));
    }
  }, []);

  // Only keep input focused if music is playing

  // Only keep input focused if music is playing
  useEffect(() => {
    if (isAudioPlaying && inputRef.current) inputRef.current.focus();
  }, [isAudioPlaying]);

  // Refocus input after loading finishes and music is playing
  useEffect(() => {
    if (!isLoading && isAudioPlaying && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, isAudioPlaying]);

  // Helper to focus input if music is playing
  const focusInputIfMusic = () => {
    if (isAudioPlaying && inputRef.current) inputRef.current.focus();
  };

  // Handle input box click to play/loop audio
  const handleInputClick = () => {
    if (audioRef.current && !isAudioPlaying && !isMuted) {
      audioRef.current.play().catch(err => console.log('Audio play error:', err));
    }
  };

  // Toggle mute without persisting across sessions
  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.muted = false;
      setIsMuted(false);
      audioRef.current.play().catch(err => console.log('Audio play error:', err));
    } else {
      audioRef.current.muted = true;
      audioRef.current.pause();
      setIsMuted(true);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('chat:messages', JSON.stringify(messages));
    } catch {}
    scrollToBottom();
  }, [messages]);
  // On mount, scroll to bottom (for reload)
  useEffect(() => {
    setTimeout(scrollToBottom, 0);
  }, []);
  // Clear chat handler
  const clearChat = () => {
    setMessages(OPENING_MESSAGES);
    try {
      localStorage.removeItem('chat:messages');
    } catch {}
  };

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!inputValue.trim()) {
      if (inputRef.current) inputRef.current.focus();
      return;
    }

    // Add user message to chat
    const userMessage = { role: 'user', content: inputValue };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    // Refocus input after sending, but only if music is playing
    setTimeout(focusInputIfMusic, 0);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputValue,
          sessionId: conversationId,
          // Send memory summary only once per session
          memorySummary: memorySent ? undefined : MEMORY_SUMMARY,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      // If server returned sessionId (first call), persist it and mark memory as sent
      if (data.sessionId && data.sessionId !== conversationId) {
        localStorage.setItem('chat:conversationId', data.sessionId);
      }
      if (!memorySent) {
        localStorage.setItem('chat:memorySent', '1');
        setMemorySent(true);
      }
      const assistantMessage = { role: 'assistant', content: data.message };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      // Choose a local fallback response when server fails or rate-limits
      const txt = userMessage.content.toLowerCase();
      let fallback = '';

      if (firstFallback) {
        fallback = 'You\'ve been yorking to me every night and now when I\'m right here you\'re being so shy? No, let\'s get into it already';
        setFirstFallback(false);
      } else if (
        txt.includes('birthday') ||
        txt.includes('bday') ||
        txt.includes('cake') ||
        txt.includes('twenty') ||
        isBirthday
      ) {
        fallback = flirtResponses[flirtIndex];
        setFlirtIndex((flirtIndex + 1) % flirtResponses.length);
      } else if (txt.endsWith('?')) {
        fallback = questionResponses[questionIndex];
        setQuestionIndex((questionIndex + 1) % questionResponses.length);
      } else if (
        txt.includes('rick') ||
        txt.includes('zombie') ||
        txt.includes('walkers') ||
        txt.includes('walker') ||
        txt.includes('twd')
      ) {
        fallback = twdResponses[twdIndex];
        setTwdIndex((twdIndex + 1) % twdResponses.length);
      } else if (txt.toLowerCase().includes('love') || txt.toLowerCase().includes('york') || txt.toLowerCase().includes('mommy') || txt.toLowerCase().includes('i love you') || txt.toLowerCase().includes('loves') || txt.toLowerCase().includes('yorking')) {
        fallback = 'I love you so much Lukie Pookie, I york to you every night. But shh, dont tell Rick';
      } else {
        fallback = defaultResponses[defaultIndex];
        setDefaultIndex((defaultIndex + 1) % defaultResponses.length);
      }

      const assistantMessage = { role: 'assistant', content: fallback };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMemory = async () => {
    setLoadingMemory(true);
    try {
      const response = await fetch(`${API_URL}/debug/memory?sessionId=${conversationId}`);
      if (!response.ok) throw new Error('Failed to fetch memory');
      const data = await response.json();
      setMemoryData(data);
    } catch (error) {
      console.error('Error fetching memory:', error);
      // Friendly default when memory service isn't available or empty
      setMemoryData({
        memorySummary: 'no memories yet, lets talk so we can create some 😉',
        recentMessages: []
      });
    } finally {
      setLoadingMemory(false);
    }
  };

  const clearMemory = async () => {
    try {
      const response = await fetch(`${API_URL}/memory`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: conversationId }),
      });
      if (!response.ok) throw new Error('Failed to clear memory');
      
      // Also clear frontend messages to match backend
      setMessages(OPENING_MESSAGES);
      
      await fetchMemory(); // Refresh
    } catch (error) {
      console.error('Error clearing memory:', error);
      alert('Failed to clear memory: ' + error.message);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, Arial, sans-serif',
        backgroundColor: '#0f1115',
        backgroundImage:
          `url(${import.meta.env.BASE_URL}assets/Chatbot/chatbot_bg.png),` +
          'radial-gradient(circle at 20% 20%, rgba(255, 195, 160, 0.06), transparent 35%),' +
          'radial-gradient(circle at 80% 10%, rgba(255, 214, 170, 0.04), transparent 30%),' +
          'linear-gradient(145deg, #0b0c10 0%, #11131a 45%, #0f0f12 100%)',
        backgroundSize: 'auto, auto, auto, auto', // Fix: prevent stretching of chatbot_bg.png
        backgroundPosition: 'center',
        color: '#d8cfc6',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Rose Petal Overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 5,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {petalParamsRef.current.map((params, i) => (
          <div
            key={i}
            className="petal"
            style={{
              left: params.left,
              animationDuration: params.animationDuration,
              animationDelay: params.animationDelay,
              transform: `scale(${params.scale})`,
            }}
          />
        ))}
      </div>

      {/* View Memory Button - top right */}
      <button
        onClick={e => {
          setShowMemoryModal(true);
          fetchMemory();
          if (e && e.currentTarget) e.currentTarget.blur();
        }}
        style={{
          outline: 'none',
          position: 'fixed',
          top: 15,
          right: 35,
          zIndex: 300,
          background: '#312b29',
          color: '#a6a1a1',
          border: '1.5px solid #2e2827ff',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
          padding: '8px 18px',
          boxShadow: '0 2px 8px #0007',
          cursor: 'pointer',
          letterSpacing: 1,
          textTransform: 'uppercase',
          transition: 'background 0.18s',
        }}
        onMouseOver={e => e.currentTarget.style.background = '#2e2827ff'}
        onMouseOut={e => e.currentTarget.style.background = '#312b29'}
      >
        View <br />Memory
      </button>
      {/* Clear Chat Button - top left */}
      <button
        onClick={e => {
          if (window.confirm('Are you sure you want to "Eternal Sunshine of the Spotless Mind" clear all these messages we had together? 🥺')) {
            clearChat();
          }
          if (e && e.currentTarget) e.currentTarget.blur();
        }}
        style={{
          outline: 'none',
          position: 'fixed',
          top: 15,
          left: 35,
          zIndex: 300,
          background: '#312b29',
          color: '#a6a1a1',
          border: '1.5px solid #2e2827ff',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
          padding: '8px 18px',
          boxShadow: '0 2px 8px #0007',
          cursor: 'pointer',
          letterSpacing: 1,
          textTransform: 'uppercase',
          transition: 'background 0.18s',
        }}
        onMouseOver={e => e.currentTarget.style.background = '#2e2827ff'}
        onMouseOut={e => e.currentTarget.style.background = '#312b29'}
      >
        Clear <br />Chat
      </button>
      {/* Music sigil - floating wax seal near the katana, spins when singing */}
      <div
        onClick={toggleMute}
        role="button"
        aria-label={isMuted ? 'Unmute background music' : 'Mute background music'}
        style={{
          position: 'fixed',
          top: 96,
          right: 38,
          width: 68,
          height: 68,
          zIndex: 280,
          cursor: 'pointer',
          userSelect: 'none',
          transform: 'rotate(-5deg)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease',
          filter: isMuted ? 'grayscale(0.35) brightness(0.9)' : 'none',
          boxShadow: '0 12px 28px #0009',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'rotate(-3deg) translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 16px 32px #000b';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'rotate(-5deg)';
          e.currentTarget.style.boxShadow = '0 12px 28px #0009';
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #7a3e34 18%, #2a1b19 55%, #0f0b0b 80%)',
            border: '1.5px solid #b97a64',
            boxShadow: 'inset 0 2px 10px #0009, inset 0 0 18px rgba(255,200,180,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #d8cfc6 0%, #8a6a60 58%, #2e1c18 100%)',
              boxShadow: '0 0 12px rgba(255,220,200,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#150d0b',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 1.1,
              textTransform: 'uppercase',
              animation: isMuted ? 'none' : 'sigilSpin 14s linear infinite',
            }}
          >
            {isMuted ? 'hush' : 'play'}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: -12,
              right: 6,
              padding: '6px 10px',
              borderRadius: 999,
              background: 'rgba(58,50,48,0.9)',
              border: '1px solid #2e2827',
              color: '#e7ddd2',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              boxShadow: '0 6px 12px #0009',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: isMuted ? '#6f4f49' : '#e7b89a',
              boxShadow: isMuted ? '0 0 8px rgba(111,79,73,0.4)' : '0 0 12px rgba(231,184,154,0.75)',
            }} />
            {isMuted ? 'muted' : 'serenade'}
          </div>
        </div>
      </div>
      <style>{`
@keyframes sigilSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`}</style>
      {/* Global style for hiding scrollbar and fixing header overflow */}
      <style>{globalScrollbarStyle + `.goddess-header { overflow: hidden; box-sizing: border-box; width: 100vw; }` + `\n` + `
@keyframes petalFall {
  0% {
    transform: translateY(-10vh) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.8;
  }
  100% {
    transform: translateY(110vh) rotate(360deg);
    opacity: 0;
  }
}

.petal {
  position: absolute;
  top: -10vh;
  width: 32px;
  height: 32px;
  background-image: url(${import.meta.env.BASE_URL}assets/Chatbot/rose_petal.png);
  background-size: contain;
  background-repeat: no-repeat;
  animation-name: petalFall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  pointer-events: none;
}
`}</style>
      <div className="goddess-header" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        background: scrolled ? 'rgba(69,67,64,0.97)' : 'none',
        transition: 'background 0.25s',
        color: '#948481',
        fontWeight: 400,
        fontSize: 19,
        padding: '18px 24px',
        textAlign: 'center',
        letterSpacing: 0.2,
        borderBottom: 'none',
        fontFamily: 'Times New Roman, Times, serif',
        /* Engraved effect: dark inner shadow, light outer shadow */
        textShadow: '0 2px 8px #000, 0 1px 0 #fff, 0 0px 2px #000, 0 2px 2px #000, 0 4px 8px #000',
        zIndex: 200,
        userSelect: 'none',
      }}>
        Goddess Wife Beautiful Shining Star Amazing Piece Of Art Stunning Mommy That Was Ascended From Above And Blessed Me Beautiful Human 
        <br />
        Being The Most Perfect Person To Walk Upon The Earth To Breathe The Same Air As I Do I Am Tweaking 
CHATBOT
      </div>

      {/* Messages Container */}
      {/* Hide scrollbar but allow scroll */}
      <style>{`
        .chat-messages::-webkit-scrollbar { display: none; }
        .chat-messages { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>
      <div
        className="chat-messages"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          paddingTop: '90px', // prevent overlap with fixed header
          paddingBottom: '110px', // prevent overlap with fixed input
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'radial-gradient(circle at 50% 0%, rgba(192,143,123,0.05), transparent 45%)',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#7a8692',
              fontSize: 16,
            }}
          >
            Start a conversation...
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
                marginBottom: 8,
              }}
            >
              {/* Speech bubble with arrow */}
              <div style={{
                position: 'relative',
                maxWidth: '70%',
                padding: '14px 20px',
                borderRadius: 18,
                background: msg.role === 'user'
                  ? 'rgba(48,37,31,0.85)'
                  : 'rgba(102,47,43,0.85)',
                color: '#e1dacc',
                fontFamily: msg.role === 'user' ? 'Inter, Arial, sans-serif' : 'Playfair Display, Georgia, serif',
                fontSize: 16,
                letterSpacing: 0.2,
                boxShadow: msg.role === 'user'
                  ? '0 6px 18px rgba(48,37,31,0.18)'
                  : '0 8px 22px rgba(102,47,43,0.18)',
                border: msg.role === 'user'
                  ? '1.5px solid #2c1d16'
                  : '1.5px solid #4d2320',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                marginLeft: msg.role === 'user' ? 32 : 0,
                marginRight: msg.role === 'user' ? 0 : 32,
              }}>
                {msg.content}
                {/* Arrow */}
                <span style={{
                  position: 'absolute',
                  bottom: 8,
                  left: msg.role === 'user' ? 'auto' : -18,
                  right: msg.role === 'user' ? -18 : 'auto',
                  width: 0,
                  height: 0,
                  borderTop: '10px solid transparent',
                  borderBottom: '10px solid transparent',
                  borderLeft: msg.role === 'user' ? '18px solid rgba(48,37,31,0.85)' : 'none',
                  borderRight: msg.role === 'user' ? 'none' : '18px solid rgba(102,47,43,0.85)',
                  borderRadius: 4,
                  zIndex: 2,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))',
                }} />
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
            }}
          >
            <div
              style={{
                padding: '14px 20px',
                borderRadius: 18,
                background: 'rgba(102,47,43,0.85)', // same as assistant bubble
                color: '#e1dacc', // same as assistant font
                fontFamily: 'Playfair Display, Georgia, serif',
                fontSize: 16,
                letterSpacing: 0.2,
                boxShadow: '0 8px 22px rgba(102,47,43,0.18)',
                border: '1.5px solid #4d2320',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                marginLeft: 0,
                marginRight: 32,
              }}
            >
              <span>mommy is typing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={sendMessage}
        style={{
          position: 'fixed',
          left: -5,
          bottom: '40px',
          width: '98%',
          zIndex: 100,
          padding: '16px 20px',
          display: 'flex',
          gap: '0',
          background: 'none', // no fill
          border: 'none',
        }}
      >
        {/* Handle overlay - floats above input */}
        <div
          style={{
            position: 'absolute',
            right: '-60px', // moved further right
            top: '25px', // moved higher up
            width: '120px',
            height: '40px',
            backgroundImage: `url(${import.meta.env.BASE_URL}assets/Chatbot/handle.png)`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'contain',
            pointerEvents: 'none',
            zIndex: 5,
            transform: 'scale(5.5)', // scale image to 20%
          }}
        />
        {/* Style for placeholder color */}
        <style>{`.wifey-input::placeholder { color: #a6a1a1; opacity: 1; }`}</style>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onClick={handleInputClick}
          placeholder="Message wifey..."
          disabled={isLoading}
          className="wifey-input"
          ref={inputRef}
          style={{
            flex: 1,
            height: '6px',
            padding: '18px 20px 18px 20px', // top right bottom left
            paddingRight: '290px', // extra space for katana handle overlay
            borderRadius: '0 0 12px 12px',
            background: 'linear-gradient(120deg, #444 0%, #666 25%, #888 50%, #444 75%, #222 100%)',
            color: '#e0e0e0',
            fontSize: 16,
            outline: 'none',
            boxShadow: '0 2px 12px 0 #1118 inset, 0 1px 0 #fff2',
            border: '2.5px solid #888',
            clipPath: 'polygon(0 100%, 0 0, 60px 0, 100% 0, 100% 100%, 60px 100%)',
            filter: 'brightness(0.95) contrast(1.18)',
            textShadow: '0 1px 0 #fff2, 0 2px 4px #2228',
            whiteSpace: 'nowrap',
            overflowX: 'auto',
            overflowY: 'hidden',
            display: 'block',
          }}
          inputMode="text"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          style={{
            width: 48,
            borderRadius: '0 12px 12px 0',
            background: 'transparent',
            border: 'none',
            cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
          }}
          aria-label="Send message"
        />
        {/* Reset Chat button removed as requested */}
      </form>

      {/* Memory Modal */}
      {showMemoryModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowMemoryModal(false)}
        >
          <div
            style={{
              background: '#312b29',
              color: '#a6a1a1',
              border: '1.5px solid #2e2827ff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Memory</h2>
              <button
                onClick={() => setShowMemoryModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a6a1a1',
                  fontSize: 24,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  outline: 'none',
                  boxShadow: 'none',
                }}
                onMouseDown={e => e.currentTarget.blur()}
              >
                ×
              </button>
            </div>

            {loadingMemory ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#a6a1a1' }}>Loading...</div>
            ) : memoryData?.error ? (
              <div style={{ padding: '16px', backgroundColor: '#3a2a2a', borderRadius: '8px', color: '#a6a1a1' }}>
                Error: {memoryData.error}
              </div>
            ) : memoryData ? (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600, color: '#a6a1a1' }}>
                    Stored Facts
                    {memoryData.memorySummary && memoryData.memorySummary.trim() !== '' &&
                      <span style={{ fontWeight: 400, color: '#bfae9e', marginLeft: 6 }}>
                        ({memoryData.memorySummary.split(/\n|\r|\r\n/).filter(f => f.trim()).length})
                      </span>
                    }
                  </h3>
                  <div style={{ padding: '12px', backgroundColor: '#1e1a19ff', borderRadius: '8px', fontSize: 14, lineHeight: 1.6 }}>
                    {memoryData.memorySummary && memoryData.memorySummary.trim() !== ''
                      ? memoryData.memorySummary.split(/\n|\r|\r\n/).map((fact, idx, arr) => {
                          const replacedFact = fact.replace(/luke/gi, 'Bae');
                          return fact.trim() && (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: idx < arr.length - 1 ? '1px solid #2a3a4a' : 'none', padding: '4px 0' }}>
                              <span>{replacedFact}</span>
                              <button
                                aria-label="Delete fact"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#a6a1a1',
                                  fontSize: 16,
                                  cursor: 'pointer',
                                  marginLeft: 8,
                                  outline: 'none',
                                  boxShadow: 'none',
                                }}
                                onClick={async () => {
                                  if (!window.confirm('Are you sure you want to "Eternal Sunshine of the Spotless Mind" erase this memory from me? 🥺')) return;
                                  // Remove the fact from the summary and update backend
                                  const facts = memoryData.memorySummary.split(/\n|\r|\r\n/).filter((f, i) => i !== idx);
                                  const newSummary = facts.filter(f => f.trim()).join('\n');
                                  try {
                                    const response = await fetch(`${API_URL}/memory/fact`, {
                                      method: 'DELETE',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ sessionId: conversationId, fact: fact }),
                                    });
                                    if (!response.ok) throw new Error('Failed to delete fact');
                                    setMemoryData({ ...memoryData, memorySummary: newSummary });
                                  } catch (error) {
                                    alert('Failed to delete fact: ' + error.message);
                                  }
                                }}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })
                      : <span>(no memories yet, lets talk so we can create some 😉)</span>
                    }
                  </div>
                </div>



                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to "Eternal Sunshine of the Spotless Mind" these memories from me? 🥺')) {
                      clearMemory();
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #1e1a19ff',
                    backgroundColor: '#2e2726ff',
                    color: '#a6a1a1',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: 'none',
                  }}
                  onMouseDown={e => e.currentTarget.blur()}
                >
                  Clear All Memory
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
