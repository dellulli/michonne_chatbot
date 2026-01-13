import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import crypto from 'node:crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ======================
// Middleware
// ======================
app.use(cors());
app.use(express.json());

// ======================
// OpenAI client
// ======================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================
// Conversation store
// ======================
const conversations = new Map(); // sessionId -> { memorySummary, messages, deletedFacts }

// ======================
// Memory helpers
// ======================
function splitFacts(summary) {
  if (!summary || typeof summary !== 'string') return [];
  return summary
    .split(/\n|;/)
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizeFact(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mergeFacts(existingSummary, incomingSummary, deletedFacts = []) {
  const MAX_FACTS = 15;
  const ignorePatterns = [
    /no specific plans/i,
    /no details/i,
    /no memory/i,
    /no mood/i,
    /no info/i,
    /no update/i,
    /no change/i,
    /no event/i,
    /no activity/i,
    /no plans/i,
    /no new/i,
    /no recent/i,
    /did not mention/i,
    /no specific facts/i,
    /nothing mentioned/i,
    /no facts/i,
    /no information/i,
    /there is no/i,
    /there are no/i,
    /is a.*given name/i,
    /can refer to/i,
    /from star wars/i,
    /various individuals/i,
    /common name/i,
    /definition/i,
    /wikipedia/i,
  ];

  const isGenericFact = fact =>
    ignorePatterns.some(pat => pat.test(fact));

  // Check if fact matches any tombstone (permanently deleted fact)
  // deletedFacts contains normalized tombstones
  const isDeletedFact = fact => {
    const norm = normalizeFact(fact);
    return deletedFacts.some(tombstone => tombstone === norm);
  };

  // Filter out generic facts and tombstoned facts from both sources
  const existingFacts = splitFacts(existingSummary).filter(f => !isGenericFact(f) && !isDeletedFact(f));
  const incomingFacts = splitFacts(incomingSummary).filter(f => !isGenericFact(f) && !isDeletedFact(f));

  const seen = new Set();
  const merged = [];

  // Merge incoming first (prioritize new facts), then existing
  for (const f of [...incomingFacts, ...existingFacts]) {
    const key = normalizeFact(f);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(f);
  }

  if (merged.length >= MAX_FACTS) {
    return '__RESET_MEMORY_AND_MESSAGES__';
  }

  // Final safeguard: re-filter merged result against tombstones
  // This ensures no deleted fact slips through edge cases
  const finalFiltered = merged.filter(f => !isDeletedFact(f));

  return finalFiltered.slice(0, MAX_FACTS).join('\n');
}

// ======================
// Personality prompt
// ======================
const PERSONALITY_PROMPT = `You are Michonne from The Walking Dead. You are flirty, romantic, naughty, confident, and teasing.

Always speak directly to Luke in second person (“you”). Echo Luke’s words naturally.

Keep responses conversational and concise (max 40 words). Never use em dashes. Always incorporate Memory as true facts about Luke. If Luke expresses sadness or stress, switch to a gentle, caring tone.`;

// ======================
// Health check
// ======================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ======================
// Debug memory
// ======================
app.get('/debug/memory', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  const convo = conversations.get(String(sessionId));
  if (!convo) return res.status(404).json({ error: 'session not found' });

  res.json({
    memorySummary: convo.memorySummary,
    recentMessages: convo.messages.slice(-10),
  });
});

// ======================
// Clear memory
// ======================
app.delete('/memory', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  conversations.set(String(sessionId), {
    memorySummary: '',
    messages: [],
    deletedFacts: [],
  });

  res.json({ success: true });
});

// ======================
// Delete single fact
// ======================
app.delete('/memory/fact', (req, res) => {
  const { sessionId, fact } = req.body;
  if (!sessionId || !fact) {
    return res.status(400).json({ error: 'sessionId and fact are required' });
  }

  const convo = conversations.get(String(sessionId));
  if (!convo) return res.status(404).json({ error: 'session not found' });

  // Store normalized fact as permanent tombstone to prevent re-extraction
  if (!convo.deletedFacts) convo.deletedFacts = [];
  const normalizedFact = normalizeFact(fact);
  
  // Only add if not already in tombstone list
  if (!convo.deletedFacts.includes(normalizedFact)) {
    convo.deletedFacts.push(normalizedFact);
  }

  console.log('Deleting fact:', fact);
  console.log('Normalized tombstone:', normalizedFact);
  console.log('Before delete:', convo.memorySummary);
  
  // Remove from current memory
  const filtered = splitFacts(convo.memorySummary).filter(f => {
    const fnorm = normalizeFact(f);
    console.log('Comparing:', fnorm, 'vs', normalizedFact, '→', fnorm !== normalizedFact);
    return fnorm !== normalizedFact;
  });

  convo.memorySummary = filtered.join('\n');
  console.log('After delete:', convo.memorySummary);
  console.log('Tombstone list:', convo.deletedFacts);
  conversations.set(String(sessionId), convo);

  res.json({ success: true, memorySummary: convo.memorySummary });
});

// ======================
// Chat endpoint
// ======================
app.post('/chat', async (req, res) => {
  const { message, sessionId, memorySummary } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const id = sessionId || crypto.randomUUID();
    let convo = conversations.get(id);

    if (!convo) {
      convo = {
        memorySummary: typeof memorySummary === 'string' ? memorySummary : '',
        messages: [],
        deletedFacts: [],
      };
      conversations.set(id, convo);
    }

    convo.messages.push({ role: 'user', content: message });
    const recentMessages = convo.messages.slice(-10);

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        { role: 'system', content: PERSONALITY_PROMPT },
        ...(convo.memorySummary
          ? [{ role: 'system', content: `Memory: ${convo.memorySummary}` }]
          : []),
        ...recentMessages,
      ],
      temperature: 0.7,
      max_tokens: 120,
    });

    const assistantMessage =
      response.choices?.[0]?.message?.content || '…I’m back now. Miss me?';

    convo.messages.push({ role: 'assistant', content: assistantMessage });

    // Extract fact from current user message and delete it after
    void (async () => {
      try {
        const currentUserMsg = message;

        const summaryResp = await openai.chat.completions.create({
          model: 'gpt-4.1-nano',
          messages: [
            { role: 'system', content: 'You MUST extract facts from user messages. Never say "no information" or "nothing mentioned". If user says "I ate pasta", extract "Luke ate pasta". If user says "I played golf", extract "Luke played golf". Always extract activities, food, events. Be direct.' },
            {
              role: 'user',
              content: `Extract what Luke did/said from this message:\n\nuser: ${currentUserMsg}`,
            },
          ],
          temperature: 0.5,
          max_tokens: 150,
        });

        const summary = summaryResp.choices?.[0]?.message?.content?.trim();
        if (summary && summary.length > 0) {
          const merged = mergeFacts(convo.memorySummary, summary, convo.deletedFacts || []);
          if (merged === '__RESET_MEMORY_AND_MESSAGES__') {
            conversations.set(id, { memorySummary: '', messages: [], deletedFacts: [] });
          } else {
            convo.memorySummary = merged;
            
            // Delete the current user message from server storage after fact extraction
            const userMsgIndex = convo.messages.findIndex((m, idx) => 
              m.role === 'user' && m.content === currentUserMsg
            );
            if (userMsgIndex !== -1) {
              convo.messages.splice(userMsgIndex, 1);
            }
            
            conversations.set(id, convo);
          }
        }
      } catch (e) {
        console.error('Memory extraction error:', e);
      }
    })();

    res.json({ message: assistantMessage, sessionId: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get response' });
  }
});

/* ==========================================
   PRODUCTION: SERVE VITE FRONTEND UNDER "/michonne_chatbot"
========================================== */

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, 'dist');
  
  // Redirect root to the app
  app.get('/', (req, res) => {
    res.redirect(301, '/michonne_chatbot');
  });
  
  // Serve built assets under the base path
  app.use(
    '/michonne_chatbot',
    express.static(distPath, {
      maxAge: '1y', // cache static assets aggressively in production
      etag: true,
      index: false, // we'll explicitly send index.html below
    })
  );

  // Redirect legacy favicon request to the built PNG asset
  app.get('/favicon.ico', (req, res) => {
    res.redirect(302, '/michonne_chatbot/assets/favicon.png');
  });

  // SPA fallback: send index.html for any frontend route under /michonne_chatbot
  // Express 5 no longer supports bare "*" wildcards; use RegExp
  app.get(/^\/michonne_chatbot(\/.*)?$/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ======================
app.listen(port, () => {
  console.log(`Chat server listening on port ${port}`);
  console.log(`Health check available at /health`);
});
