'use client';

import { useEffect, useMemo, useState } from 'react';

const SAMPLE_JD = `Backend Engineer\n\nRequired: TypeScript, Node.js, REST APIs, SQL, and strong communication.\nNice to have: AWS and Docker.\nYou will design reliable services, debug production issues, and collaborate with product teams.`;

function Requirement({ requirement }) {
  return (
    <li className="border-b border-slate-100 py-3 last:border-0">
      <p className="m-0 text-sm font-semibold text-ink">{requirement.text}</p>
      <span className={`mt-2 inline-block rounded px-2 py-1 text-xs font-bold ${requirement.priority === 'must' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'}`}>
        {requirement.priority === 'must' ? 'Must have' : 'Nice to have'} · {requirement.kind}
      </span>
    </li>
  );
}

function Flashcard({ card, score, onScore }) {
  return (
    <article className="flashcard border border-slate-200 bg-white p-5 shadow-sm">
      <p className="m-0 text-xs font-bold uppercase text-slate-500">Flashcard</p>
      <h3 className="mb-3 mt-2 text-base leading-6 text-ink">{card.front}</h3>
      <p className="m-0 text-sm leading-6 text-slate-600">{card.back}</p>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-xs font-semibold text-slate-500">Confidence: {score ?? 'not rated'}</span>
        <div className="flex gap-2" aria-label={`Set confidence for ${card.front}`}>
          {[1, 2, 3].map((value) => (
            <button key={value} type="button" onClick={() => onScore(card.id, value)} className={`h-8 w-8 rounded border text-sm font-bold ${score === value ? 'border-mint bg-mint text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-mint'}`} aria-label={`Confidence ${value} out of 3`}>
              {value}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function QuestionEditor({ question, index, total, pinned, onChange, onMove, onPin, onDelete }) {
  return (
    <article className="question-editor border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-xs font-bold uppercase text-slate-500">{question.id} · {question.category} · difficulty {question.difficulty}/3</p>
        <div className="flex items-center gap-3 text-sm font-bold text-mint">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="disabled:opacity-30">Up</button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="disabled:opacity-30">Down</button>
          <button type="button" onClick={onPin}>{pinned ? 'Unpin' : 'Pin'}</button>
          <button type="button" onClick={onDelete} className="text-rose-700">Delete</button>
        </div>
      </div>
      <textarea aria-label={`Question ${question.id}`} value={question.prompt} onChange={(event) => onChange(event.target.value)} className="mt-3 min-h-20 w-full resize-y border border-slate-300 p-3 text-sm leading-6" />
      <p className="mb-0 mt-3 text-sm leading-6 text-slate-600">{question.answer_outline}</p>
    </article>
  );
}

export default function HomePage() {
  const [form, setForm] = useState({ companyUrl: 'https://example.com', days: '3', jd: SAMPLE_JD });
  const [kit, setKit] = useState(null);
  const [scores, setScores] = useState({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [researching, setResearching] = useState(false);
  const [account, setAccount] = useState(null);
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [savedKits, setSavedKits] = useState([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [pinnedQuestionIds, setPinnedQuestionIds] = useState([]);
  const [editedQuestionIds, setEditedQuestionIds] = useState([]);
  const [regeneratingQuestions, setRegeneratingQuestions] = useState(false);
  const [questionRevision, setQuestionRevision] = useState(0);
  const [selectedQuestionCategory, setSelectedQuestionCategory] = useState('technical');

  const weakestFirst = useMemo(() => {
    if (!kit) return [];
    return [...kit.flashcards].sort((a, b) => (scores[a.id] ?? 0) - (scores[b.id] ?? 0));
  }, [kit, scores]);

  useEffect(() => { refreshAccount(); }, []);

  async function refreshAccount() {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    setAccount(data.user);
    if (data.user) {
      const kitsResponse = await fetch('/api/kits');
      const kitsData = await kitsResponse.json();
      if (kitsResponse.ok) setSavedKits(kitsData.kits);
    } else {
      setSavedKits([]);
    }
  }

  async function submitAuth(mode) {
    setAuthLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update account');
      setAccount(data.user);
      setCredentials({ email: '', password: '' });
      setStatus(mode === 'register' ? 'Account created. New kits will now be saved privately.' : 'Signed in. Your private kits are available.');
      await refreshAccount();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAccount(null);
    setSavedKits([]);
    setStatus('Signed out. New kits will not be saved until you sign in again.');
  }

  async function createPrepKit(event) {
    event.preventDefault();
    setStatus('Building your kit...');
    setError('');
    try {
      const response = await fetch('/api/kits', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not build preparation kit');
      setKit(data.kit);
      setSavedId(data.savedId);
      setPinnedQuestionIds([]);
      setEditedQuestionIds([]);
      setScores({});
      setStatus(data.saved ? 'Kit ready and saved privately. Start with the must-have requirements.' : 'Kit ready. Sign in to save it privately.');
      if (data.saved) await refreshAccount();
    } catch (requestError) {
      setStatus('');
      setError(requestError.message);
    }
  }

  function updateQuestion(id, prompt) {
    setKit((current) => ({ ...current, questions: current.questions.map((question) => question.id === id ? { ...question, prompt } : question) }));
    setEditedQuestionIds((current) => current.includes(id) ? current : [...current, id]);
  }

  function moveQuestion(id, direction) {
    setKit((current) => {
      const questions = [...current.questions];
      const from = questions.findIndex((question) => question.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= questions.length) return current;
      [questions[from], questions[to]] = [questions[to], questions[from]];
      return { ...current, questions };
    });
  }

  function addQuestion() {
    setKit((current) => {
      const requirement = current.role.requirements.find((item) => item.priority === 'must') || current.role.requirements[0];
      const question = { id: `custom-${Date.now()}`, requirement_ids: requirement ? [requirement.id] : [], category: 'technical', prompt: 'Add your custom interview question', answer_outline: 'Add the answer structure and evidence you want to practice.', difficulty: 2 };
      return { ...current, questions: [...current.questions, question] };
    });
    setStatus('Custom question added at the bottom. Edit it, then pin it or save your changes.');
  }

  async function regenerateQuestionCategory() {
    if (!kit) return;
    setRegeneratingQuestions(true);
    setError('');
    try {
      const revision = questionRevision + 1;
      const response = await fetch('/api/questions/regenerate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requirements: kit.role.requirements, companyBrief: kit.company_brief, category: selectedQuestionCategory, revision })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not regenerate questions');
      const generatedById = new Map(data.questions.map((question) => [question.id, question]));
      setKit((current) => ({
        ...current,
        questions: current.questions.map((question) => (
          question.category !== selectedQuestionCategory || question.id.startsWith('custom-') || pinnedQuestionIds.includes(question.id) || editedQuestionIds.includes(question.id)
            ? question
            : generatedById.get(question.id) || question
        ))
      }));
      setQuestionRevision(revision);
      setStatus(`Fresh ${selectedQuestionCategory} questions generated. Pinned, edited, custom, and other-category questions were preserved.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRegeneratingQuestions(false);
    }
  }

  async function saveChanges() {
    if (!account || !savedId || !kit) {
      setError('Sign in and create a kit before saving edits.');
      return;
    }
    setError('');
    const response = await fetch(`/api/kits/${savedId}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kit }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'Could not save kit changes'); return; }
    setStatus('Kit changes saved privately.');
    await refreshAccount();
  }

  async function researchCompany() {
    if (!kit) return;
    setResearching(true);
    setError('');
    try {
      const response = await fetch('/api/research', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ companyUrl: form.companyUrl, requirements: kit.role.requirements, includeQuestions: false }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Company research could not be completed');
      setKit((current) => ({ ...current, company_brief: data.companyBrief, source: { ...current.source, pages_used: data.companyBrief.sources } }));
      setStatus(`Company brief refreshed from ${data.audit.pages_retrieved} page${data.audit.pages_retrieved === 1 ? '' : 's'}. Your questions and schedule were left unchanged.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setResearching(false);
    }
  }

  return (
    <main className="app-shell min-h-screen">
      <header className="topbar border-b border-slate-200 bg-white">
        <div className="topbar-inner mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div>
            <p className="brand-label m-0 text-xs font-bold uppercase tracking-wide text-mint">Trao</p>
            <h1 className="brand-title m-0 text-xl font-bold text-ink">Interview Prep Kit</h1>
          </div>
          <span className="topbar-note text-sm font-semibold text-slate-500">Evidence-linked practice</span>
        </div>
      </header>

      <div className="app-grid mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[0.9fr_1.4fr]">
        <section className="panel builder-panel h-fit border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="m-0 text-lg font-bold text-ink">Build a kit</h2>
          <p className="mb-5 mt-2 text-sm leading-6 text-slate-600">Paste a job description and choose the time you have. Every generated question stays tied to a requirement.</p>
          <div className="account-panel mb-5 border-y border-slate-200 py-4">
            {account ? (
              <div className="flex items-center justify-between gap-3">
                <div><p className="m-0 text-xs font-bold uppercase text-mint">Private workspace</p><p className="mb-0 mt-1 text-sm font-semibold text-ink">{account.email}</p></div>
                <button type="button" onClick={signOut} className="link-button text-sm font-bold text-mint underline">Sign out</button>
              </div>
            ) : (
              <div className="grid gap-3">
                <p className="m-0 text-xs font-bold uppercase text-slate-500">Sign in to save private kits</p>
                <input type="email" value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} className="h-9 border border-slate-300 px-3 text-sm" placeholder="Email address" aria-label="Email address" />
                <input type="password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} className="h-9 border border-slate-300 px-3 text-sm" placeholder="Password (8+ characters)" aria-label="Password" />
                <div className="account-actions flex gap-3">
                  <button type="button" disabled={authLoading} onClick={() => submitAuth('login')} className="link-button text-sm font-bold text-mint underline disabled:opacity-50">Sign in</button>
                  <button type="button" disabled={authLoading} onClick={() => submitAuth('register')} className="link-button text-sm font-bold text-mint underline disabled:opacity-50">Create account</button>
                </div>
              </div>
            )}
          </div>
          <form className="builder-form grid gap-4" onSubmit={createPrepKit}>
            <label className="field grid gap-1 text-sm font-semibold text-slate-700">
              Company website
              <input required type="url" value={form.companyUrl} onChange={(event) => setForm({ ...form, companyUrl: event.target.value })} className="h-10 border border-slate-300 px-3 text-sm" placeholder="https://company.com" />
            </label>
            <label className="field grid gap-1 text-sm font-semibold text-slate-700">
              Days available
              <input required min="1" max="60" type="number" value={form.days} onChange={(event) => setForm({ ...form, days: event.target.value })} className="h-10 border border-slate-300 px-3 text-sm" />
            </label>
            <label className="field grid gap-1 text-sm font-semibold text-slate-700">
              Job description
              <textarea required value={form.jd} onChange={(event) => setForm({ ...form, jd: event.target.value })} className="min-h-72 resize-y border border-slate-300 p-3 text-sm leading-6" />
            </label>
            <button type="submit" className="primary-button h-11 bg-mint px-4 text-sm font-bold text-white hover:bg-emerald-800">Create prep kit</button>
          </form>
          {status && <p className="status mb-0 mt-4 text-sm font-semibold text-mint" role="status">{status}</p>}
          {error && <p className="error mb-0 mt-4 text-sm font-semibold text-rose-700" role="alert">{error}</p>}
          {account && savedKits.length > 0 && <div className="mt-5 border-t border-slate-200 pt-4"><p className="m-0 text-xs font-bold uppercase text-slate-500">Saved kits</p><ul className="mb-0 mt-2 grid list-none gap-2 p-0">{savedKits.slice(0, 4).map((saved) => <li key={saved.id}><button type="button" onClick={() => { setKit(saved.kit); setSavedId(saved.id); setPinnedQuestionIds([]); setEditedQuestionIds([]); setStatus('Saved kit loaded.'); }} className="w-full border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-ink hover:border-mint">{saved.kit.role.title}</button></li>)}</ul></div>}
        </section>

        <section aria-live="polite">
          {!kit ? (
            <div className="empty-state border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <h2 className="m-0 text-lg font-bold text-ink">Your focused plan will appear here</h2>
              <p className="mx-auto mb-0 mt-2 max-w-md text-sm leading-6 text-slate-600">The generator uses deterministic coverage checks so every must-have requirement has a matching question and a scheduled practice slot.</p>
            </div>
          ) : (
            <div className="output-stack grid gap-6">
              <div className="panel border border-slate-200 bg-white p-5 shadow-sm">
                <div className="summary-header flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="m-0 text-xs font-bold uppercase tracking-wide text-mint">{kit.source.company}</p>
                    <h2 className="mb-0 mt-1 text-xl font-bold text-ink">{kit.role.title}</h2>
                  </div>
                  <div className="summary-actions flex flex-wrap items-center justify-end gap-2">
                    <span className="coverage-badge border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">Coverage: {kit.coverage.uncovered_requirement_ids.length === 0 ? 'complete' : 'needs review'}</span>
                    <button type="button" onClick={researchCompany} disabled={researching} className="secondary-button border border-mint px-3 py-2 text-sm font-bold text-mint hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60">
                      {researching ? 'Researching...' : 'Research company'}
                    </button>
                  </div>
                </div>
                <p className="mb-0 mt-4 text-sm leading-6 text-slate-600">{kit.company_brief.summary}</p>
                {kit.company_brief.sources?.[0] && <a className="mt-3 inline-block text-sm font-semibold text-mint underline" href={kit.company_brief.sources[0].url} target="_blank" rel="noreferrer">Source: {kit.company_brief.sources[0].title || kit.company_brief.sources[0].url}</a>}
              </div>

              <div className="two-column grid gap-6 xl:grid-cols-2">
                <section className="panel border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="m-0 text-lg font-bold text-ink">Requirements</h2>
                  <ul className="requirements-list m-0 mt-3 list-none p-0">{kit.role.requirements.map((requirement) => <Requirement key={requirement.id} requirement={requirement} />)}</ul>
                </section>
                <section className="panel border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="m-0 text-lg font-bold text-ink">Practice schedule</h2>
                  <ol className="schedule-list m-0 mt-3 grid list-none gap-3 p-0">
                    {kit.schedule.days.map((day) => (
                      <li key={day.day} className="border-l-4 border-coral bg-orange-50 px-3 py-3">
                        <p className="m-0 text-sm font-bold text-ink">Day {day.day}: {day.focus}</p>
                        <p className="mb-0 mt-1 text-sm text-slate-600">{day.question_ids.length ? `${day.question_ids.join(', ')} · ` : ''}{day.minutes} minutes</p>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              <section>
                <div className="section-header mb-3 flex flex-wrap items-end justify-between gap-3">
                  <div><h2 className="m-0 text-lg font-bold text-ink">Questions</h2><p className="mb-0 mt-1 text-sm text-slate-600">Edit, move, pin, or remove prompts before your next practice round.</p></div>
                  <div className="toolbar flex flex-wrap gap-3"><button type="button" onClick={addQuestion} className="link-button text-sm font-bold text-mint underline">Add question</button><label className="text-sm font-semibold text-slate-700">Category<select value={selectedQuestionCategory} onChange={(event) => setSelectedQuestionCategory(event.target.value)} className="ml-2 border border-slate-300 bg-white px-2 py-1 text-sm"><option value="technical">Technical</option><option value="behavioural">Behavioural</option></select></label><button type="button" onClick={regenerateQuestionCategory} disabled={regeneratingQuestions} className="link-button text-sm font-bold text-mint underline disabled:opacity-50">{regeneratingQuestions ? 'Regenerating...' : 'Regenerate category'}</button><button type="button" onClick={saveChanges} className="primary-button bg-mint px-3 py-2 text-sm font-bold text-white hover:bg-emerald-800">Save edits</button></div>
                </div>
                <div className="question-list grid gap-3">{kit.questions.map((question, index) => <QuestionEditor key={question.id} question={question} index={index} total={kit.questions.length} pinned={pinnedQuestionIds.includes(question.id)} onChange={(prompt) => updateQuestion(question.id, prompt)} onMove={(direction) => moveQuestion(question.id, direction)} onPin={() => setPinnedQuestionIds((current) => current.includes(question.id) ? current.filter((id) => id !== question.id) : [...current, question.id])} onDelete={() => setKit((current) => ({ ...current, questions: current.questions.filter((item) => item.id !== question.id) }))} />)}</div>
              </section>

              <section>
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div><h2 className="m-0 text-lg font-bold text-ink">Practice cards</h2><p className="mb-0 mt-1 text-sm text-slate-600">Low-confidence cards float to the front.</p></div>
                  <span className="text-sm font-semibold text-slate-500">{kit.flashcards.length} cards</span>
                </div>
                <div className="practice-grid grid gap-4 md:grid-cols-2">{weakestFirst.map((card) => <Flashcard key={card.id} card={card} score={scores[card.id]} onScore={(id, value) => setScores({ ...scores, [id]: value })} />)}</div>
              </section>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
