import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Shield, Link, Ban, List, Mail, Save, Loader2, CheckCircle2, AlertCircle, Copy, Check, Plus, Trash2, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../utils/api.js';

const T = {
  bg: 'var(--paper)', panel: 'var(--card)', border: 'var(--hair)', text: 'var(--ink)',
  dim: 'var(--mute)', accent: 'var(--indigo)', gold: 'var(--gold)', display: 'var(--font-display, serif)',
};

const s = {
  wrap:     { display: 'flex', flexDirection: 'column', height: '100vh', background: T.bg, color: T.text, fontFamily: 'var(--font-ui, inherit)' },
  toolbar:  { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 },
  title:    { fontFamily: T.display, fontStyle: 'italic', fontSize: 20, fontWeight: 600, marginRight: 'auto' },
  tabBar:   { display: 'flex', gap: 0, borderBottom: `1px solid ${T.border}`, flexShrink: 0, padding: '0 20px' },
  tab:      (a) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', cursor: 'pointer', fontSize: 13, borderBottom: '2px solid ' + (a ? T.accent : 'transparent'), color: a ? T.text : T.dim, background: 'transparent', fontWeight: a ? 600 : 400, userSelect: 'none' }),
  body:     { flex: 1, overflowY: 'auto', padding: '24px 20px' },
  section:  { marginBottom: 28 },
  sHead:    { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: T.dim, marginBottom: 10 },
  fieldRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.border}`, gap: 16 },
  fieldLbl: { fontSize: 13, color: T.text, fontWeight: 500 },
  fieldHint:{ fontSize: 12, color: T.dim, marginTop: 2 },
  input:    { padding: '5px 9px', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 0, color: T.text, fontSize: 13, outline: 'none', width: 80 },
  inputWide:{ padding: '5px 9px', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 0, color: T.text, fontSize: 13, outline: 'none', width: 260 },
  textarea: { width: '100%', minHeight: 90, padding: '7px 10px', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 0, color: T.text, fontSize: 12.5, fontFamily: 'var(--font-mono, monospace)', resize: 'vertical', outline: 'none' },
  toggle:   { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 },
  btn:      { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 0, color: T.text, cursor: 'pointer', fontSize: 12.5 },
  btnP:     { background: T.accent, borderColor: T.accent, color: 'var(--paper)' },
  btnDanger:{ borderColor: 'var(--hd-design, #c33)', color: 'var(--hd-design, #c33)' },
  saveBar:  { display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, padding: '10px 12px', background: `color-mix(in srgb, var(--paper) 88%, transparent)`, backdropFilter: 'blur(6px)', borderTop: `1px solid ${T.border}`, position: 'sticky', bottom: 0 },
  table:    { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th:       { textAlign: 'left', padding: '7px 10px', borderBottom: `1px solid ${T.border}`, color: T.dim, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  td:       { padding: '8px 10px', borderBottom: `1px solid ${T.border}`, verticalAlign: 'middle' },
  mono:     { fontFamily: 'var(--font-mono, monospace)', fontSize: 12 },
  badge:    (kind) => ({ display: 'inline-block', padding: '2px 8px', fontSize: 11, fontWeight: 600, background: kind === 'permanent' ? 'color-mix(in srgb, var(--hd-design,#c33) 12%, transparent)' : 'color-mix(in srgb, var(--gold) 14%, transparent)', color: kind === 'permanent' ? 'var(--hd-design,#c33)' : T.gold, border: `1px solid ${kind === 'permanent' ? 'var(--hd-design,#c33)' : T.gold}` }),
  logBadge: (type) => {
    const map = { lockout: [T.gold, T.gold], permanent_block: ['var(--hd-design,#c33)', 'var(--hd-design,#c33)'], manual_unblock: [T.accent, T.accent], magic_login_generated: [T.accent, T.accent], magic_login_used: [T.accent, T.accent], login_success: ['var(--hd-personality,#2d8a5e)', 'var(--hd-personality,#2d8a5e)'], register_success: ['var(--hd-personality,#2d8a5e)', 'var(--hd-personality,#2d8a5e)'] };
    const [bg, fg] = map[type] || [T.dim, T.dim];
    return { fontSize: 11, color: fg, fontWeight: 600 };
  },
  empty:    { padding: 40, textAlign: 'center', color: T.dim, fontSize: 13 },
  urlBox:   { display: 'flex', alignItems: 'center', gap: 8, background: T.panel, border: `1px solid ${T.border}`, padding: '8px 12px', fontSize: 12, fontFamily: 'var(--font-mono, monospace)', color: T.dim, wordBreak: 'break-all', marginTop: 10 },
  myIpRow:  { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: `color-mix(in srgb, var(--indigo) 6%, transparent)`, border: `1px solid ${T.border}`, marginBottom: 12, fontSize: 13 },
  toast:    (k) => ({ position: 'fixed', bottom: 18, right: 18, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 15px', background: T.panel, border: `1px solid ${k === 'error' ? 'var(--hd-design,#c33)' : T.accent}`, color: T.text, fontSize: 13 }),
};

// Clipboard copy that also works in non-secure (http://) contexts where
// navigator.clipboard is undefined — falls back to a hidden textarea + execCommand.
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const LOG_LABELS = {
  lockout: 'Temporary lockout', permanent_block: 'Permanent block', manual_unblock: 'Unblocked',
  magic_login_generated: 'Magic link generated', magic_login_used: 'Magic link used',
  login_success: 'Login success', register_success: 'Registration',
};

function Toggle({ checked, onChange }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 0, cursor: 'pointer' }}>
      <div style={{ position: 'relative', width: 36, height: 20 }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 20, background: checked ? T.accent : T.border, transition: '.2s' }} />
        <div style={{ position: 'absolute', width: 14, height: 14, left: checked ? 19 : 3, top: 3, borderRadius: '50%', background: 'var(--paper)', transition: '.2s' }} />
      </div>
    </label>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <div style={s.fieldRow}>
      <div>
        <div style={s.fieldLbl}>{label}</div>
        {hint && <div style={s.fieldHint}>{hint}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{children}</div>
    </div>
  );
}

// ─── Lockout Settings tab ────────────────────────────────────────────────────

function LockoutTab({ settings, setSettings, onSave, saving }) {
  const [myIp, setMyIp] = useState('');

  useEffect(() => {
    apiFetch('lunacco/v1/admin/security/my-ip')
      .then((d) => setMyIp(d.ip || ''))
      .catch(() => {});
  }, []);

  const whitelistHasMyIp = myIp && settings.ip_whitelist
    .split(/\r?\n/).map((l) => l.trim()).includes(myIp);

  const addMyIpToWhitelist = () => {
    if (!myIp || whitelistHasMyIp) return;
    setSettings((p) => {
      const lines = p.ip_whitelist.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      lines.push(myIp);
      return { ...p, ip_whitelist: lines.join('\n') };
    });
  };

  return (
    <div>
      <div style={s.section}>
        <div style={s.sHead}>Thresholds</div>
        <FieldRow label="Max login attempts" hint="Failed attempts before temporary lockout triggers">
          <input style={s.input} type="number" min="1" max="100" value={settings.max_login_attempts}
            onChange={(e) => setSettings(p => ({ ...p, max_login_attempts: +e.target.value }))} />
        </FieldRow>
        <FieldRow label="Lockout duration" hint="Minutes before the IP can try again">
          <input style={s.input} type="number" min="1" max="10080" value={settings.lockout_duration}
            onChange={(e) => setSettings(p => ({ ...p, lockout_duration: +e.target.value }))} />
          <span style={{ fontSize: 12, color: T.dim }}>min</span>
        </FieldRow>
        <FieldRow label="Auto-promote to permanent block" hint="Lockouts within 30 days before permanent block (0 = off)">
          <input style={s.input} type="number" min="0" max="999" value={settings.permanent_block_threshold}
            onChange={(e) => setSettings(p => ({ ...p, permanent_block_threshold: +e.target.value }))} />
        </FieldRow>
        <FieldRow label="Enable audit log" hint="Record lockout, block, and login events (max 200 entries)">
          <Toggle checked={settings.lockout_log_enabled} onChange={(v) => setSettings(p => ({ ...p, lockout_log_enabled: v }))} />
        </FieldRow>
      </div>
      <div style={s.section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={s.sHead}>IP whitelist</div>
          {myIp && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: T.dim }}>Your IP:</span>
              <span style={{ ...s.mono, color: T.text, fontSize: 12 }}>{myIp}</span>
              {whitelistHasMyIp
                ? <span style={{ fontSize: 11, color: T.accent, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={12} /> whitelisted</span>
                : <button style={{ ...s.btn, padding: '3px 10px', fontSize: 12 }} onClick={addMyIpToWhitelist}><Plus size={12} /> Add my IP</button>
              }
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: T.dim, marginBottom: 8 }}>Whitelisted IPs bypass all lockout checks. One per line. Remember to save after adding.</div>
        <textarea style={s.textarea} value={settings.ip_whitelist}
          onChange={(e) => setSettings(p => ({ ...p, ip_whitelist: e.target.value }))}
          placeholder={'192.168.1.100\n10.0.0.1'} />
      </div>
      <div style={s.saveBar}>
        <button style={{ ...s.btn, ...s.btnP }} onClick={onSave} disabled={saving}>
          {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
          Save settings
        </button>
      </div>
    </div>
  );
}

// ─── Magic Login tab ─────────────────────────────────────────────────────────

function MagicTab({ settings, setSettings, onSave, saving }) {
  const [email, setEmail] = useState('');
  const [genBusy, setGenBusy] = useState(false);
  const [genResult, setGenResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!email) return;
    setGenBusy(true);
    setGenResult(null);
    try {
      const res = await apiFetch('lunacco/v1/admin/security/magic-link', { method: 'POST', body: JSON.stringify({ email }) });
      setGenResult(res);
    } catch (e) {
      setGenResult({ error: e.message || 'Failed to generate link' });
    } finally { setGenBusy(false); }
  };

  const copy = async () => {
    if (!genResult?.url) return;
    const ok = await copyToClipboard(genResult.url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <div style={s.section}>
        <div style={s.sHead}>Settings</div>
        <FieldRow label="Enable magic login" hint="Lets admins generate one-click sign-in links for users">
          <Toggle checked={settings.magic_login_enabled} onChange={(v) => setSettings(p => ({ ...p, magic_login_enabled: v }))} />
        </FieldRow>
        <FieldRow label="Link expiry" hint="Minutes until the link expires">
          <input style={s.input} type="number" min="1" max="1440" value={settings.magic_login_expiry}
            onChange={(e) => setSettings(p => ({ ...p, magic_login_expiry: +e.target.value }))} />
          <span style={{ fontSize: 12, color: T.dim }}>min</span>
        </FieldRow>
        <FieldRow label="Post-login redirect" hint="Leave blank to redirect to the home page">
          <input style={s.inputWide} type="url" placeholder="https://…" value={settings.post_login_redirect_url}
            onChange={(e) => setSettings(p => ({ ...p, post_login_redirect_url: e.target.value }))} />
        </FieldRow>
      </div>

      {settings.magic_login_enabled && (
        <div style={s.section}>
          <div style={s.sHead}>Generate a link for a user</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input style={{ ...s.inputWide, width: 260 }} type="email" placeholder="user@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generate()} />
            <button style={s.btn} onClick={generate} disabled={genBusy || !email}>
              {genBusy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Link size={14} />}
              Generate
            </button>
          </div>
          {genResult?.error && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--hd-design,#c33)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={13} /> {genResult.error}
            </div>
          )}
          {genResult?.url && (
            <>
              <div style={s.urlBox}>
                <span style={{ flex: 1, wordBreak: 'break-all' }}>{genResult.url}</span>
                <button style={s.btn} onClick={copy}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div style={{ fontSize: 12, color: T.dim, marginTop: 6 }}>
                For {genResult.display_name} · expires in {genResult.expiry_minutes} min · single use — do not share publicly.
              </div>
            </>
          )}
        </div>
      )}

      <div style={s.saveBar}>
        <button style={{ ...s.btn, ...s.btnP }} onClick={onSave} disabled={saving}>
          {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
          Save settings
        </button>
      </div>
    </div>
  );
}

// ─── Blocked IPs tab ─────────────────────────────────────────────────────────

function BlocksTab({ flash }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newIp, setNewIp] = useState('');
  const [newReason, setNewReason] = useState('');
  const [busy, setBusy] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const blocksData = await apiFetch('lunacco/v1/admin/security/blocks');
      setBlocks(blocksData.blocks || []);
    } catch (e) { flash(e.message || 'Failed to load', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addBlock = async () => {
    if (!newIp) return;
    setBusy('add');
    try {
      await apiFetch('lunacco/v1/admin/security/blocks', { method: 'POST', body: JSON.stringify({ ip: newIp, reason: newReason || 'manual' }) });
      setNewIp(''); setNewReason('');
      flash('IP blocked successfully', 'ok');
      load();
    } catch (e) { flash(e.message || 'Failed to block IP', 'error'); }
    finally { setBusy(''); }
  };

  const removeBlock = async (ip) => {
    setBusy(ip);
    try {
      await apiFetch(`lunacco/v1/admin/security/blocks/${encodeURIComponent(ip)}`, { method: 'DELETE' });
      flash('IP unblocked', 'ok');
      load();
    } catch (e) { flash(e.message || 'Failed to unblock', 'error'); }
    finally { setBusy(''); }
  };

  if (loading) return <div style={s.empty}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>;

  return (
    <div>
      <div style={s.section}>
        <div style={s.sHead}>Add permanent block</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ ...s.inputWide, width: 180 }} type="text" placeholder="IP address" value={newIp}
            onChange={(e) => setNewIp(e.target.value)} />
          <input style={{ ...s.inputWide, width: 180 }} type="text" placeholder="Reason (optional)" value={newReason}
            onChange={(e) => setNewReason(e.target.value)} />
          <button style={{ ...s.btn, ...s.btnDanger }} onClick={addBlock} disabled={busy === 'add' || !newIp}>
            {busy === 'add' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Ban size={14} />}
            Block IP
          </button>
        </div>
      </div>

      <div style={s.section}>
        <div style={s.sHead}>Permanent blocks ({blocks.length})</div>
        {blocks.length === 0
          ? <div style={s.empty}>No permanently blocked IPs.</div>
          : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>IP address</th>
                  <th style={s.th}>Reason</th>
                  <th style={s.th}>Blocked at</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b) => (
                  <tr key={b.ip}>
                    <td style={s.td}><span style={s.mono}>{b.ip}</span></td>
                    <td style={s.td}><span style={s.badge('permanent')}>{b.reason || 'manual'}</span></td>
                    <td style={s.td} colSpan={1}><span style={{ color: T.dim, fontSize: 12 }}>{b.blocked_at || '—'}</span></td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <button style={{ ...s.btn, padding: '3px 10px', fontSize: 12 }} onClick={() => removeBlock(b.ip)} disabled={busy === b.ip}>
                        {busy === b.ip ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Unblock'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
}

// ─── Audit Log tab ───────────────────────────────────────────────────────────

function LogTab({ flash }) {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const d = await apiFetch('lunacco/v1/admin/security/log'); setLog(d.log || []); }
    catch (e) { flash(e.message || 'Failed to load log', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const clearLog = async () => {
    if (!window.confirm('Clear the entire audit log? This cannot be undone.')) return;
    setClearing(true);
    try {
      await apiFetch('lunacco/v1/admin/security/log', { method: 'DELETE' });
      setLog([]);
      flash('Log cleared', 'ok');
    } catch (e) { flash(e.message || 'Failed to clear', 'error'); }
    finally { setClearing(false); }
  };

  if (loading) return <div style={s.empty}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: T.dim }}>{log.length} events · most recent first · max 200 retained</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btn} onClick={load}><RefreshCw size={13} /> Refresh</button>
          {log.length > 0 && (
            <button style={{ ...s.btn, ...s.btnDanger }} onClick={clearLog} disabled={clearing}>
              {clearing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
              Clear log
            </button>
          )}
        </div>
      </div>
      {log.length === 0
        ? <div style={s.empty}>No events recorded yet.</div>
        : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Time</th>
                <th style={s.th}>Event</th>
                <th style={s.th}>IP</th>
                <th style={s.th}>User</th>
              </tr>
            </thead>
            <tbody>
              {log.map((e, i) => (
                <tr key={i}>
                  <td style={{ ...s.td, ...s.mono, color: T.dim, whiteSpace: 'nowrap' }}>{e.time}</td>
                  <td style={s.td}><span style={s.logBadge(e.type)}>{LOG_LABELS[e.type] || e.type}</span></td>
                  <td style={{ ...s.td, ...s.mono }}>{e.ip || '—'}</td>
                  <td style={{ ...s.td, fontSize: 12 }}>{e.username || (e.user_id ? `#${e.user_id}` : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </div>
  );
}

// ─── Email Templates tab ─────────────────────────────────────────────────────

function EmailTab({ settings, setSettings, onSave, saving }) {
  const logoUrl = window.LunaCcoData?.appHeaderLogoUrl || '';
  const siteName = window.LunaCcoData?.appHeaderTitle || 'LunaCco';

  return (
    <div>
      <div style={s.section}>
        <div style={s.sHead}>Magic login email</div>
        <div style={{ fontSize: 12, color: T.dim, marginBottom: 12 }}>
          Sent when a user requests a magic sign-in link. Logo is pulled from Business Settings.
        </div>
        <div style={{ maxWidth: 500, border: `1px solid ${T.border}`, padding: 20, background: T.panel, marginBottom: 16 }}>
          {logoUrl
            ? <img src={logoUrl} alt="Logo" style={{ maxHeight: 36, marginBottom: 16, display: 'block' }} />
            : <div style={{ fontSize: 12, color: T.dim, marginBottom: 16, fontStyle: 'italic' }}>[Logo from Business Settings]</div>
          }
          <div style={{ fontSize: 13, lineHeight: 1.65, marginBottom: 16, color: T.text }}>
            Hi <strong>[Name]</strong>,<br /><br />
            Click the button below to sign in to <strong>{siteName}</strong>.
            The link expires in <strong>[{settings.magic_login_expiry} minutes]</strong> and can only be used once.
          </div>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <span style={{ display: 'inline-block', background: T.accent, color: 'var(--paper)', padding: '10px 24px', fontSize: 13, fontWeight: 600 }}>
              Sign in to {siteName}
            </span>
          </div>
          <div style={{ fontSize: 11, color: T.dim }}>If you didn't request this, you can safely ignore this email.</div>
        </div>
        <div style={{ fontSize: 12, color: T.dim }}>
          Magic link emails are sent as branded HTML using the logo and site name from <strong>Business Settings</strong>.
          This preview reflects what users receive.
        </div>
      </div>

      <div style={s.section}>
        <div style={s.sHead}>IP block notification</div>
        <FieldRow label="Notify admin on IP block" hint="Send admin email when an IP is permanently blocked">
          <Toggle checked={!!settings.block_notify_admin} onChange={(v) => setSettings(p => ({ ...p, block_notify_admin: v }))} />
        </FieldRow>
      </div>

      <div style={s.saveBar}>
        <button style={{ ...s.btn, ...s.btnP }} onClick={onSave} disabled={saving}>
          {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
          Save settings
        </button>
      </div>
    </div>
  );
}

// ─── Root view ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'lockout', label: 'Login lockout', Icon: Shield },
  { id: 'magic',   label: 'Magic login',   Icon: Link   },
  { id: 'blocks',  label: 'Blocked IPs',   Icon: Ban    },
  { id: 'log',     label: 'Audit log',     Icon: List   },
  { id: 'email',   label: 'Emails',        Icon: Mail   },
];

export default function SecurityAdminView() {
  const [tab, setTab] = useState('lockout');
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const flash = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    apiFetch('lunacco/v1/admin/security/settings')
      .then(setSettings)
      .catch((e) => flash(e.message || 'Failed to load settings', 'error'));
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await apiFetch('lunacco/v1/admin/security/settings', { method: 'POST', body: JSON.stringify(settings) });
      flash('Settings saved', 'ok');
    } catch (e) { flash(e.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const logoUrl = window.LunaCcoData?.appHeaderLogoUrl || '';

  return (
    <div style={s.wrap}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={s.toolbar}>
        {logoUrl && <img src={logoUrl} alt="" style={{ height: 28, width: 'auto', marginRight: 4 }} />}
        <span style={s.title}>Security &amp; Access</span>
        <a href={window.LunaCcoData?.returnMainUrl || '#'}
          style={{ ...s.btn, fontSize: 12, color: T.dim, textDecoration: 'none' }}>
          ← {window.LunaCcoData?.returnMainLabel || 'Dashboard'}
        </a>
      </div>

      <div style={s.tabBar}>
        {TABS.map(({ id, label, Icon }) => (
          <div key={id} style={s.tab(tab === id)} onClick={() => setTab(id)}>
            <Icon size={14} />
            {label}
          </div>
        ))}
      </div>

      <div style={s.body}>
        {!settings
          ? <div style={s.empty}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
          : tab === 'lockout' ? <LockoutTab settings={settings} setSettings={setSettings} onSave={saveSettings} saving={saving} />
          : tab === 'magic'   ? <MagicTab   settings={settings} setSettings={setSettings} onSave={saveSettings} saving={saving} />
          : tab === 'blocks'  ? <BlocksTab  flash={flash} />
          : tab === 'log'     ? <LogTab     flash={flash} />
          : tab === 'email'   ? <EmailTab   settings={settings} setSettings={setSettings} onSave={saveSettings} saving={saving} />
          : null
        }
      </div>

      {toast && (
        <div style={s.toast(toast.kind)}>
          {toast.kind === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
