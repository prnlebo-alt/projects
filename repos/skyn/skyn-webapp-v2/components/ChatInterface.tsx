'use client';

import { useState, useRef, useEffect } from 'react';
import MessageBubble  from './MessageBubble';
import ModelSelector  from './ModelSelector';
import UsageMeter     from './UsageMeter';
import UpgradeModal   from './UpgradeModal';
import { suggestModel, MODEL_COLORS } from '@/lib/model-router';
import { canUseFeature }  from '@/lib/plans';
import type { Model, Conversation, Message, Plan } from '@/types/app';

type ChatUiMessage = { role: string; content: string; model?: Model; id?: string };
type StreamPayload = { text?: string; error?: string };

function parseStreamPayload(data: string): StreamPayload | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed === 'object' && parsed !== null) return parsed as StreamPayload;
  } catch {}
  return null;
}

interface Props {
  conversation?:  Conversation;
  initialMessages?: Message[];
  plan:           Plan;
  usage:          { used: number; limit: number; cost: number };
  onNewConversation?: (conv: Conversation) => void;
  onTitleUpdate?:  (id: string, title: string) => void;
}

export default function ChatInterface({
  conversation, initialMessages = [], plan, usage, onNewConversation, onTitleUpdate,
}: Props) {
  const [messages,   setMessages]   = useState<ChatUiMessage[]>
    (initialMessages.map(m => ({ role: m.role, content: m.content, model: m.model ?? undefined, id: m.id })));
  const [input,      setInput]      = useState('');
  const [model,      setModel]      = useState<Model>('claude');
  const [streaming,  setStreaming]  = useState(false);
  const [streamText, setStreamText] = useState('');
  const [convId,     setConvId]     = useState<string | undefined>(conversation?.id);
  const [suggest,    setSuggest]    = useState<ReturnType<typeof suggestModel> | null>(null);
  const [showUpgrade,setShowUpgrade]= useState(false);
  const [usageState, setUsageState] = useState(usage);
  const [compareMode,setCompareMode]= useState(false);
  const [comparing,  setComparing]  = useState(false);
  const [compareResults, setCompareResults] = useState<Partial<Record<Model, string>>>({});

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamText]);

  function handleInputChange(val: string) {
    setInput(val);
    if (val.trim().length > 3) setSuggest(suggestModel(val));
    else setSuggest(null);
  }

  async function ensureConversation(firstMsg: string): Promise<string> {
    if (convId) return convId;
    const res  = await fetch('/api/conversations', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model, title: firstMsg.slice(0, 60) }),
    });
    const data = await res.json();
    const id   = data.conversation.id;
    setConvId(id);
    onNewConversation?.(data.conversation);
    return id;
  }

  async function saveMessage(conversationId: string, role: string, content: string, msgModel?: Model) {
    try {
      await fetch('/api/conversations/messages', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ conversationId, role, content, model: msgModel }),
      });
    } catch {}
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;
    if (usageState.used >= usageState.limit) { setShowUpgrade(true); return; }

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSuggest(null);
    setStreaming(true);
    setStreamText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const cid = await ensureConversation(text);
    await saveMessage(cid, 'user', text);

    const allMessages = [...messages, userMsg];

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ model, messages: allMessages, conversationId: cid }),
      });

      if (res.status === 429) {
        const data = await res.json();
        if (data.error === 'limit_reached') { setShowUpgrade(true); setStreaming(false); return; }
      }

      if (!res.body) throw new Error('No stream');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   full    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const data = line.replace('data: ', '');
          if (data === '[DONE]') break;
          const parsed = parseStreamPayload(data);
          if (parsed?.text) { full += parsed.text; setStreamText(full); }
        }
      }

      const aiMsg = { role: 'assistant', content: full, model };
      setMessages(prev => [...prev, aiMsg]);
      setStreamText('');
      setUsageState(prev => ({ ...prev, used: prev.used + 1 }));

      await saveMessage(cid, 'assistant', full, model);

      // Auto-update title after first exchange
      if (messages.length === 0 && onTitleUpdate) {
        onTitleUpdate(cid, text.slice(0, 50));
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.', model }]);
    } finally {
      setStreaming(false);
      setStreamText('');
    }
  }

  async function runCompare() {
    const text = input.trim();
    if (!text || comparing) return;
    if (!canUseFeature('compare', plan)) { setShowUpgrade(true); return; }

    setComparing(true);
    setCompareResults({});
    setInput('');
    const allMessages = [...messages, { role: 'user', content: text }];

    const models: Model[] = ['claude', 'gpt', 'gemini'];
    await Promise.all(models.map(async m => {
      try {
        const res = await fetch('/api/chat', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ model: m, messages: allMessages }),
        });
        if (!res.body) return;
        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let   full    = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '));
          for (const line of lines) {
            const data = line.replace('data: ', '');
            if (data === '[DONE]') break;
            const parsed = parseStreamPayload(data);
            if (parsed?.text) { full += parsed.text; setCompareResults(prev => ({ ...prev, [m]: full })); }
          }
        }
      } catch {}
    }));
    setComparing(false);
  }

  const canCompare = canUseFeature('compare', plan);
  const color      = MODEL_COLORS[model];

  return (
    <>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} trigger={usageState.used >= usageState.limit ? 'limit' : 'feature'} />}

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, height:'100%' }}>
        {/* Topbar */}
        <div style={{
          height:'48px', flexShrink:0,
          background:'var(--nx-topbar)', borderBottom:'1px solid var(--nx-border)',
          display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px',
        }}>
          <ModelSelector value={model} onChange={setModel} />
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <button
              onClick={() => setCompareMode(c => !c)}
              title={canCompare ? 'Compare all models' : 'Compare — Starter+'}
              style={{
                padding:'4px 10px', borderRadius:'6px', fontSize:'11px', cursor:'pointer',
                border:`1px solid ${compareMode ? 'var(--nx-accent)' : 'var(--nx-border)'}`,
                background: compareMode ? 'var(--nx-accent)11' : 'transparent',
                color: compareMode ? 'var(--nx-accent)' : 'var(--nx-text-muted)',
                fontFamily:'var(--nx-font)',
              }}
            >
              ⊞ Compare
            </button>
            <div style={{
              padding:'3px 10px', borderRadius:'20px', fontSize:'10px', fontWeight:600,
              background:`${color}22`, border:`1px solid ${color}44`, color,
              fontFamily:'var(--nx-font)',
            }}>
              {model}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column' }}>
          {messages.length === 0 && !streaming && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'12px' }}>
              <div style={{ fontSize:'28px', color:'var(--nx-accent)', opacity:0.6 }}>✦</div>
              <div style={{ fontSize:'13px', color:'var(--nx-text-muted)', fontFamily:'var(--nx-font)' }}>
                Start a conversation with {model === 'claude' ? 'Claude' : model === 'gpt' ? 'GPT-4o' : 'Gemini'}
              </div>
              <div style={{ fontSize:'11px', color:'var(--nx-text-muted)', opacity:0.6, fontFamily:'var(--nx-font)' }}>
                Switch models anytime · Compare side-by-side · Save prompts
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={msg.id ?? i} message={msg} />
          ))}

          {streaming && streamText && (
            <MessageBubble
              message={{ role: 'assistant', content: streamText, model }}
              isStreaming
            />
          )}

          {streaming && !streamText && (
            <div style={{ display:'flex', gap:'8px', alignItems:'center', padding:'8px 0' }}>
              <div style={{ width:26, height:26, borderRadius:'50%', background:`${color}22`, border:`1px solid ${color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', color, fontWeight:700 }}>
                {model === 'claude' ? 'C' : model === 'gpt' ? 'G' : '◈'}
              </div>
              <div style={{ fontSize:'12px', color:'var(--nx-text-muted)', fontStyle:'italic', fontFamily:'var(--nx-font)' }}>thinking…</div>
            </div>
          )}

          {/* Compare results */}
          {compareMode && Object.keys(compareResults).length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginTop:'12px' }}>
              {(['claude','gpt','gemini'] as Model[]).map(m => (
                <div key={m} style={{ background:'var(--nx-bubble-ai)', border:'var(--nx-bubble-border-ai)', borderRadius:'var(--nx-radius-lg)', boxShadow:'var(--nx-bubble-shadow)', overflow:'hidden' }}>
                  <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--nx-border)', fontSize:'10px', fontWeight:700, color:MODEL_COLORS[m], fontFamily:'var(--nx-font)', display:'flex', alignItems:'center', gap:'5px' }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:MODEL_COLORS[m], display:'inline-block' }} />
                    {m}
                    {comparing && !compareResults[m] && <span style={{ color:'var(--nx-text-muted)', fontWeight:400 }}>· thinking…</span>}
                  </div>
                  <div style={{ padding:'10px', fontSize:'11px', color:'var(--nx-text)', lineHeight:1.6, fontFamily:'var(--nx-font)', maxHeight:'200px', overflowY:'auto' }}>
                    {compareResults[m] ?? ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{
          borderTop:'1px solid var(--nx-border)', padding:'12px 16px',
          background:'var(--nx-topbar)', flexShrink:0,
        }}>
          {suggest && input.length > 3 && (
            <div style={{ marginBottom:'8px', fontSize:'10px', color:'var(--nx-text-muted)', display:'flex', alignItems:'center', gap:'6px', fontFamily:'var(--nx-font)' }}>
              Router:
              <button
                onClick={() => { setModel(suggest.model); setSuggest(null); }}
                style={{ background:'transparent', border:'none', cursor:'pointer', color:MODEL_COLORS[suggest.model], fontSize:'10px', fontWeight:600, padding:0, fontFamily:'var(--nx-font)' }}
              >
                {suggest.model} suggested
              </button>
              <span style={{ opacity:0.6 }}>— {suggest.reason}</span>
            </div>
          )}

          <div style={{ display:'flex', gap:'8px', alignItems:'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                handleInputChange(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (compareMode) runCompare();
                  else sendMessage();
                }
              }}
              placeholder={compareMode ? 'Ask all three models at once…' : 'Ask anything… (/ for saved prompts)'}
              rows={1}
              style={{
                flex:1, padding:'9px 12px', borderRadius:'10px', resize:'none', outline:'none',
                border:'1px solid var(--nx-border)', background:'var(--nx-bubble-ai)',
                color:'var(--nx-text)', fontSize:'13px', lineHeight:1.5, minHeight:'38px',
                fontFamily:'var(--nx-font)',
              }}
            />
            <button
              onClick={() => compareMode ? runCompare() : sendMessage()}
              disabled={!input.trim() || streaming || comparing}
              style={{
                width:36, height:36, borderRadius:'8px', border:'none', flexShrink:0,
                background: input.trim() ? 'var(--nx-accent)' : 'var(--nx-border)',
                color: input.trim() ? 'var(--nx-bg)' : 'var(--nx-text-muted)',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center',
                transition:'background 0.15s',
              }}
            >
              ↑
            </button>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginTop:'6px' }}>
            <UsageMeter used={usageState.used} limit={usageState.limit} cost={usageState.cost} />
            {usageState.used >= usageState.limit * 0.8 && (
              <button
                onClick={() => setShowUpgrade(true)}
                style={{ fontSize:'10px', color:'var(--nx-accent)', background:'transparent', border:'none', cursor:'pointer', fontFamily:'var(--nx-font)', whiteSpace:'nowrap' }}
              >
                Upgrade →
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
