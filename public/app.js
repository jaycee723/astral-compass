/* ============================================================
   ASTRAL COMPASS — app.js
   Uses Groq (llama3-8b-8192) via /api/chat backend proxy
   Uses Aztro horoscope API via /api/horoscope backend proxy
   All user data stored in memory (no localStorage in sandboxes)
   ============================================================ */

'use strict';

// ── STATE ────────────────────────────────────────────────────
let userProfile = null;   // { name, birthday, sign, signGlyph, age, ...extras }
let horoscopeData = null; // { daily, weekly, monthly }
let chatHistory = [];     // [{ role, content }]
let activePeriod = 'weekly';

// ── ZODIAC ───────────────────────────────────────────────────
const SIGNS = [
  { name:'Capricorn', glyph:'♑', start:[12,22], end:[1,19]  },
  { name:'Aquarius',  glyph:'♒', start:[1,20],  end:[2,18]  },
  { name:'Pisces',    glyph:'♓', start:[2,19],  end:[3,20]  },
  { name:'Aries',     glyph:'♈', start:[3,21],  end:[4,19]  },
  { name:'Taurus',    glyph:'♉', start:[4,20],  end:[5,20]  },
  { name:'Gemini',    glyph:'♊', start:[5,21],  end:[6,20]  },
  { name:'Cancer',    glyph:'♋', start:[6,21],  end:[7,22]  },
  { name:'Leo',       glyph:'♌', start:[7,23],  end:[8,22]  },
  { name:'Virgo',     glyph:'♍', start:[8,23],  end:[9,22]  },
  { name:'Libra',     glyph:'♎', start:[9,23],  end:[10,22] },
  { name:'Scorpio',   glyph:'♏', start:[10,23], end:[11,21] },
  { name:'Sagittarius',glyph:'♐',start:[11,22], end:[12,21] },
];

function getSign(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  for (const s of SIGNS) {
    const [sm, sd] = s.start;
    const [em, ed] = s.end;
    if (sm === 12 && em === 1) {
      if ((m === 12 && day >= sd) || (m === 1 && day <= ed)) return s;
    } else {
      if ((m === sm && day >= sd) || (m === em && day <= ed)) return s;
    }
  }
  return SIGNS[0];
}

function getAge(dateStr) {
  const b = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'In the quiet hours';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'In the still of the night';
}

// ── DOM REFS ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const onboarding    = $('onboarding');
const dashboard     = $('dashboard');
const startForm     = $('startForm');
const chatForm      = $('chatForm');
const chatInput     = $('chatInput');
const messages      = $('messages');
const sendBtn       = $('sendBtn');
const suggestions   = $('suggestions');
const profileDialog = $('profileDialog');
const profileForm   = $('profileForm');
const toastEl       = $('toast');
const editProfileBtn = $('editProfileBtn');
const openProfileBtn = $('openProfileBtn');
const deleteProfileBtn = $('deleteProfileBtn');
const clearChatBtn  = $('clearChatBtn');

// ── TOAST ─────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

// ── PROFILE PROGRESS ──────────────────────────────────────────
function calcProfileProgress(p) {
  if (!p) return 20;
  const fields = ['focus','relationship','work','goal','challenge','decisionStyle'];
  const filled = fields.filter(f => p[f] && p[f].trim()).length;
  return Math.round(20 + (filled / fields.length) * 80);
}

function updateProgressUI() {
  const pct = calcProfileProgress(userProfile);
  $('profileProgress').textContent = pct + '%';
  $('progressBar').style.width = pct + '%';
}

// ── SIGNAL BARS ───────────────────────────────────────────────
const SIGNALS = [
  { key:'love',   label:'Love'   },
  { key:'career', label:'Career' },
  { key:'health', label:'Vitality'},
  { key:'luck',   label:'Fortune'},
];

function renderSignals(data) {
  const wrap = $('signalBars');
  wrap.innerHTML = '';
  SIGNALS.forEach(({ key, label }) => {
    const raw = data[key] || data[key + '_intensity'] || '';
    const num = parseInt(raw, 10);
    const pct = !isNaN(num) ? Math.min(100, Math.max(0, num)) : Math.floor(Math.random()*40)+40;
    const bar = document.createElement('div');
    bar.className = 'signal-bar';
    bar.innerHTML = `
      <span>${label}</span>
      <div class="signal-bar-track"><div class="signal-bar-fill" style="width:0%"></div></div>
      <span>${pct}%</span>`;
    wrap.appendChild(bar);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { bar.querySelector('.signal-bar-fill').style.width = pct + '%'; });
    });
  });
}

// ── HOROSCOPE FETCH ───────────────────────────────────────────
async function loadHoroscope(sign) {
  ['dailyText','periodText'].forEach(id => {
    $(id).classList.add('is-loading');
    $(id).textContent = 'Gathering the stars…';
  });
  $('energyScore').textContent = '—';

  try {
    const res = await fetch(`/api/horoscope?sign=${encodeURIComponent(sign.toLowerCase())}`);
    if (!res.ok) throw new Error('horoscope fetch failed');
    const data = await res.json();
    horoscopeData = data;

    // Daily
    const daily = data.daily || {};
    $('dailyText').textContent = daily.description || 'The cosmos is quiet today — a perfect time for reflection.';
    $('dailyText').classList.remove('is-loading');
    $('energyScore').textContent = daily.stars ? '★'.repeat(parseInt(daily.stars,10)||3) : '★★★';
    renderSignals(daily);

    // Period
    updatePeriodText();

    // Personalised greeting from AI
    buildGreeting();
  } catch (e) {
    ['dailyText','periodText'].forEach(id => {
      $(id).classList.remove('is-loading');
      $(id).textContent = 'The celestial signal is faint right now. Try refreshing in a moment.';
    });
  }
}

function updatePeriodText() {
  if (!horoscopeData) return;
  const text = horoscopeData[activePeriod];
  const el = $('periodText');
  el.classList.remove('is-loading');
  el.textContent = (typeof text === 'string' ? text : text?.description) ||
    'The pattern for this period is still forming.';
}

// ── DASHBOARD INIT ────────────────────────────────────────────
function showDashboard() {
  onboarding.hidden = true;
  dashboard.hidden  = false;
  editProfileBtn.hidden = false;

  const { name, sign, signGlyph, birthday } = userProfile;
  $('welcomeTitle').textContent = greeting() + ', ' + name;
  $('dateLine').textContent = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  $('signName').textContent  = sign;
  $('signGlyph').textContent = signGlyph;
  $('dailyTitle').textContent = sign + ' — today's energy';

  updateProgressUI();
  loadHoroscope(sign);
}

// ── ONBOARDING FORM ───────────────────────────────────────────
startForm.addEventListener('submit', e => {
  e.preventDefault();
  const name  = $('uname').value.trim();
  const birthday = $('birthday').value;
  if (!name || !birthday) return;

  const signObj = getSign(birthday);
  userProfile = {
    name,
    birthday,
    sign:      signObj.name,
    signGlyph: signObj.glyph,
    age:       getAge(birthday),
  };
  showDashboard();
});

// ── PROFILE DIALOG ────────────────────────────────────────────
function openProfileDialog() {
  if (userProfile) {
    const f = profileForm;
    ['focus','relationship','work','goal','challenge','decisionStyle','responseStyle','notes']
      .forEach(key => {
        const el = f.elements[key];
        if (el) el.value = userProfile[key] || '';
      });
  }
  profileDialog.showModal();
}

openProfileBtn.addEventListener('click', openProfileDialog);
editProfileBtn.addEventListener('click', openProfileDialog);

profileForm.addEventListener('submit', e => {
  if (profileForm.returnValue === 'cancel') return;
  const fd = new FormData(profileForm);
  ['focus','relationship','work','goal','challenge','decisionStyle','responseStyle','notes']
    .forEach(key => { userProfile[key] = fd.get(key) || ''; });
  updateProgressUI();
  showToast('Profile saved — your readings are now more personalised ✦');
});

deleteProfileBtn.addEventListener('click', () => {
  if (!confirm('Clear your personal data and return to the start?')) return;
  userProfile = null;
  horoscopeData = null;
  chatHistory = [];
  onboarding.hidden  = false;
  dashboard.hidden   = true;
  editProfileBtn.hidden = true;
  startForm.reset();
  messages.innerHTML = '';
  profileDialog.close();
  showToast('Data cleared.');
});

// ── PERIOD TABS ───────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected','false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected','true');
    activePeriod = btn.dataset.period;
    updatePeriodText();
  });
});

// ── SUGGESTION CHIPS ──────────────────────────────────────────
suggestions.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    chatInput.value = btn.textContent;
    chatInput.dispatchEvent(new Event('input'));
    chatInput.focus();
  });
});

// ── CLEAR CHAT ────────────────────────────────────────────────
clearChatBtn.addEventListener('click', () => {
  chatHistory = [];
  messages.innerHTML = `
    <div class="message oracle">
      <div class="avatar" aria-hidden="true">✦</div>
      <div class="bubble"><p>The slate is clear. Ask me anything.</p></div>
    </div>`;
  showToast('Conversation cleared');
});

// ── AUTO RESIZE TEXTAREA ──────────────────────────────────────
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
});

// ── MESSAGE RENDERING ────────────────────────────────────────
function appendMessage(role, text) {
  const wrap = document.createElement('div');
  wrap.className = 'message ' + (role === 'user' ? 'user' : 'oracle');

  const av = document.createElement('div');
  av.className = 'avatar';
  av.setAttribute('aria-hidden','true');
  av.textContent = role === 'user'
    ? (userProfile?.name?.slice(0,1)?.toUpperCase() || 'U')
    : '✦';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  text.split('\n\n').forEach(para => {
    if (!para.trim()) return;
    const p = document.createElement('p');
    p.textContent = para.trim();
    bubble.appendChild(p);
  });

  wrap.appendChild(av);
  wrap.appendChild(bubble);
  messages.appendChild(wrap);
  messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
  return wrap;
}

function appendTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'message oracle';
  wrap.id = 'typingIndicator';
  wrap.innerHTML = `
    <div class="avatar" aria-hidden="true">✦</div>
    <div class="bubble"><div class="typing-dot"><span></span><span></span><span></span></div></div>`;
  messages.appendChild(wrap);
  messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
}

// ── BUILD SYSTEM PROMPT ───────────────────────────────────────
function buildSystemPrompt() {
  const p = userProfile || {};
  const h = horoscopeData?.daily || {};

  const profile = [
    `Name: ${p.name || 'unknown'}`,
    `Age: ${p.age || 'unknown'} | Sun sign: ${p.sign || 'unknown'}`,
    p.focus        ? `Life focus: ${p.focus}` : '',
    p.relationship ? `Relationship: ${p.relationship}` : '',
    p.work         ? `Work/role: ${p.work}` : '',
    p.goal         ? `Current goal: ${p.goal}` : '',
    p.challenge    ? `Main challenge: ${p.challenge}` : '',
    p.decisionStyle? `Decision style: ${p.decisionStyle}` : '',
    p.notes        ? `Extra context: ${p.notes}` : '',
  ].filter(Boolean).join('\n');

  const horoscope = [
    h.description ? `Today's horoscope: ${h.description}` : '',
    h.color       ? `Lucky colour: ${h.color}` : '',
    h.lucky_number? `Lucky number: ${h.lucky_number}` : '',
    h.compatibility?`Compatible with: ${h.compatibility}` : '',
    h.mood        ? `Mood: ${h.mood}` : '',
  ].filter(Boolean).join('\n');

  const style = p.responseStyle || 'Balanced';

  return `You are Astral Compass, an insightful and empathetic AI fortune teller and life guide.

USER PROFILE:
${profile}

TODAY'S CELESTIAL CONTEXT:
${horoscope || 'No live data available — draw on general astrological wisdom.'}

STYLE: ${style}. Speak warmly and personally using the user's name occasionally. Be specific to their profile — mention their sign, age, stated challenges, and goals where relevant. Keep answers to 2–4 paragraphs. After answering, ask ONE follow-up question that would help you understand them better (vary the topics: emotions, ambitions, past experiences, values, relationships). Never make definitive predictions — frame insights as possibilities and tendencies. Never suggest medical, legal, or financial advice.`;
}

// ── INITIAL GREETING ─────────────────────────────────────────
async function buildGreeting() {
  if (!userProfile) return;
  const p = userProfile;
  const h = horoscopeData?.daily;
  const preview = h?.description?.slice(0, 80) || 'the stars are stirring';

  const greetMsg = `Welcome, ${p.name}. You are a ${p.sign}, and today ${preview}…\n\nWhat has been weighing on your mind lately?`;
  $('greeting').textContent = greetMsg;
}

// ── CHAT SUBMIT ───────────────────────────────────────────────
chatForm.addEventListener('submit', async e => {
  e.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;

  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;

  // Hide suggestion chips after first question
  suggestions.style.display = 'none';

  appendMessage('user', question);
  chatHistory.push({ role:'user', content: question });

  appendTyping();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: buildSystemPrompt(),
        messages: chatHistory.slice(-12),  // keep last 12 turns for context
      })
    });

    const data = await res.json();
    const answer = data.answer || 'The oracle is silent for a moment. Please try again.';

    const typing = $('typingIndicator');
    if (typing) typing.remove();

    chatHistory.push({ role:'assistant', content: answer });
    appendMessage('oracle', answer);

    // Trim history to avoid token bloat
    if (chatHistory.length > 24) chatHistory = chatHistory.slice(-24);
  } catch (err) {
    const typing = $('typingIndicator');
    if (typing) typing.remove();
    appendMessage('oracle', 'The cosmic connection flickered. Please try again in a moment.');
  } finally {
    sendBtn.disabled = false;
    chatInput.focus();
  }
});

// Allow Shift+Enter for newline, Enter alone to submit
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});
