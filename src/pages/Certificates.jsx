import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Bar, DemoTag, Empty, ErrorState, fmtDate, Icon, PageSkeleton, RankEmblem, rankMeta, useApi, useToast } from '../components/ui.jsx';
import { Logo } from '../components/Shell.jsx';

export function CertCard({ c }) {
  const rm = rankMeta(c.rank);
  return <div className="cert" style={{ '--rank': rm.color }}>
    <div className="row between" style={{ alignItems: 'flex-start' }}><div className="row gap-6"><Logo size={20} /><span className="serif" style={{ fontSize: 15 }}>Consult <b className="acc">Brain</b></span></div><RankEmblem rank={c.rank} size={58} glow /></div>
    <div><div className="eyebrow" style={{ color: rm.color }}>Certificate of achievement</div><div className="who mt-8">{c.name}</div>
      <p className="t2 mt-8" style={{ fontSize: 'clamp(11px, 2.2cqw, 15px)', maxWidth: '78%' }}>has attained the rank of <b style={{ color: rm.color }}>{c.rankName}</b> on Consult Brain by investigating, quantifying and defending business diagnoses across {c.cases} case{c.cases === 1 ? '' : 's'}.</p></div>
    <div className="row between" style={{ alignItems: 'flex-end', gap: 16 }}><div className="row wrap" style={{ gap: '4px 14px', maxWidth: '62%' }}>{c.skillsMeta.map((s) => <span key={s.id} className="xs muted">{s.label} <b className="mono" style={{ color: 'var(--text)' }}>{Math.round(c.skills[s.id])}</b></span>)}</div>
      <div style={{ textAlign: 'right' }}><div className="mono xs">{c.id}</div><div className="xs muted">Issued {fmtDate(c.issuedAt)}{c.demo ? ' · demo' : ''}</div></div></div>
  </div>;
}

async function downloadPdf(c) {
  const { jsPDF } = await import('jspdf'); const rm = rankMeta(c.rank);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); const W = 297, H = 210;
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  doc.setFillColor(252, 250, 246); doc.rect(0, 0, W, H, 'F'); doc.setDrawColor(...rgb(rm.color)); doc.setLineWidth(0.8); doc.rect(10, 10, W - 20, H - 20); doc.setLineWidth(0.2); doc.setDrawColor(190, 184, 170); doc.rect(13, 13, W - 26, H - 26);
  doc.setFont('times', 'normal'); doc.setFontSize(18); doc.setTextColor(30, 30, 34); doc.text('Consult Brain', 24, 30);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...rgb(rm.color === '#F1E9D8' ? '#8A6A1E' : rm.color)); doc.text('CERTIFICATE OF ACHIEVEMENT', 24, 62, { charSpace: 1.2 });
  doc.setFont('times', 'normal'); doc.setFontSize(40); doc.setTextColor(24, 24, 28); doc.text(c.name, 24, 84);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13); doc.setTextColor(70, 74, 82);
  doc.text(doc.splitTextToSize(`has attained the rank of ${c.rankName} on Consult Brain by investigating, quantifying and defending business diagnoses across ${c.cases} case${c.cases === 1 ? '' : 's'}.`, 190), 24, 98);
  doc.setFont('times', 'normal'); doc.setFontSize(30); doc.setTextColor(...rgb(rm.color === '#F1E9D8' ? '#8A6A1E' : rm.color)); doc.text(c.rankName, W - 24, 34, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.500); doc.setTextColor(110, 114, 122); doc.text('SKILLS DEMONSTRATED (RATING / 100)', 24, 128, { charSpace: 0.8 });
  c.skillsMeta.forEach((s, i) => { const x = 24 + (i % 3) * 84, y = 138 + Math.floor(i / 3) * 14; doc.setFont('helvetica', 'normal'); doc.setFontSize(10.500); doc.setTextColor(60, 64, 72); doc.text(s.label, x, y); doc.setFont('courier', 'bold'); doc.setTextColor(24, 24, 28); doc.text(String(Math.round(c.skills[s.id])), x + 66, y, { align: 'right' }); doc.setFillColor(228, 224, 214); doc.rect(x, y + 2, 66, 1.200, 'F'); doc.setFillColor(...rgb(rm.color === '#F1E9D8' ? '#8A6A1E' : rm.color)); doc.rect(x, y + 2, 0.66 * Math.round(c.skills[s.id]), 1.200, 'F'); });
  doc.setFont('courier', 'normal'); doc.setFontSize(10); doc.setTextColor(24, 24, 28); doc.text(`Verification ID  ${c.id}`, 24, 180);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 114, 122); doc.text(`Issued ${fmtDate(c.issuedAt)}  ·  Verify at ${location.origin}/verify/${c.id}${c.demo ? '  ·  Demo account' : ''}`, 24, 186);
  doc.setFontSize(7.500); doc.text(doc.splitTextToSize(c.disclaimer, 250), 24, 193);
  doc.save(`Consult-Brain-${c.rankName}-${c.id}.pdf`);
}

export function Certificates() {
  const { data: d, loading, error, reload } = useApi('/certificates'); const toast = useToast(); const nav = useNavigate();
  if (loading) return <PageSkeleton />; if (error) return <ErrorState error={error} retry={reload} />;
  return (
    <div className="page">
      <div className="page-h"><div><div className="eyebrow mb-8">Certificates</div><h1>Milestone certificates</h1><p className="t2 mt-8" style={{ maxWidth: 720 }}>Issued by Consult Brain when you reach a rank. Each carries a verification ID anyone can check. They record demonstrated skill on this platform; they are not academic qualifications and are not accredited by any university.</p></div></div>
      {d.certificates.length === 0 ? <div className="panel"><Empty icon="cert" title="No certificates yet" action={<button className="btn sm mt-8" onClick={() => nav('/progress')}>See the rank ladder</button>}>Your first certificate is issued at Silver: 800 XP, one completed case and every skill rated 35 or higher.</Empty></div>
        : <div className="grid g2">{d.certificates.map((c) => <div key={c.id}><CertCard c={c} /><div className="row between mt-8"><span className="xs muted row gap-6">{c.demo && <DemoTag />}Verification ID <span className="mono">{c.id}</span></span><span className="row"><button className="btn sm" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/verify/${c.id}`); toast('Verification link copied', 'good'); }}><Icon name="link" size={13} />Copy link</button><button className="btn sm primary" onClick={() => downloadPdf(c).catch(() => toast('PDF could not be generated', 'bad'))}><Icon name="download" size={13} />Download PDF</button></span></div></div>)}</div>}
      {d.next && <div className="panel pad mt-24" style={{ maxWidth: 560 }}><div className="eyebrow mb-12">Next certificate: {d.next.name}</div>{d.next.reqs.map((q) => <div key={q.label} className="mb-8"><div className="row between small"><span className="row gap-6"><Icon name={q.met ? 'check' : 'minus'} size={13} className={q.met ? 'pos' : 'muted'} />{q.label}</span>{!q.met && <span className="mono xs muted">{q.current.toLocaleString('en-IN')}/{q.target.toLocaleString('en-IN')}</span>}</div>{!q.met && <Bar value={q.current} max={q.target} className="thin mt-4" />}</div>)}</div>}
    </div>
  );
}

export function Verify() {
  const { code } = useParams(); const [q, setQ] = useState(code || ''); const [state, setState] = useState({ loading: !!code }); const nav = useNavigate();
  const look = (id) => { setState({ loading: true }); api(`/verify/${encodeURIComponent(id.trim())}`).then((d) => setState({ cert: d.certificate })).catch((e) => setState({ error: e.message })); };
  React.useEffect(() => { if (code) look(code); }, [code]); // eslint-disable-line
  return <div className="page" style={{ maxWidth: 760, paddingTop: 48 }}><Link to="/" className="brand" style={{ padding: 0, marginBottom: 28 }}><Logo size={24} /><span style={{ fontSize: 17 }}>Consult <b>Brain</b></span></Link>
    <div className="eyebrow mb-8">Certificate verification</div><h1>Check a Consult Brain certificate</h1>
    <form className="row mt-16" onSubmit={(e) => { e.preventDefault(); if (q.trim()) nav(`/verify/${q.trim().toUpperCase()}`); }}><input className="input num" placeholder="CB-XXXXX-XXXXX" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Verification ID" /><button className="btn primary">Verify</button></form>
    <div className="mt-24">{state.loading ? <div className="skel" style={{ height: 200 }} /> : state.error ? <div className="callout neg"><b>Not verified.</b> {state.error}</div> : state.cert ? <><div className="callout pos mb-16"><Icon name="check" size={14} style={{ verticalAlign: -2, marginRight: 6 }} /><b>Verified.</b> This certificate was issued by Consult Brain to {state.cert.name} on {fmtDate(state.cert.issuedAt)}.{state.cert.demo ? ' It belongs to a seeded demo account.' : ''}</div><CertCard c={state.cert} /><p className="xs muted mt-12">{state.cert.disclaimer}</p></> : <p className="small muted">Enter the identifier printed on the certificate.</p>}</div></div>;
}
