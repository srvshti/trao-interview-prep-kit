'use client';

import { useEffect, useMemo, useState } from 'react';
import { deriveWeakSpots } from '../src/practice.mjs';

const SAMPLE_JD = `Backend Engineer\n\nRequired: TypeScript, Node.js, REST APIs, SQL, and strong communication.\nNice to have: AWS and Docker.\nYou will design reliable services, debug production issues, and collaborate with product teams.`;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && text[index + 1] === '"' && quoted) { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(field); field = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function parseBatchCases(text, fileName) {
  let cases;
  if (fileName.toLowerCase().endsWith('.json')) {
    cases = JSON.parse(text);
    if (!Array.isArray(cases)) throw new Error('The JSON file must contain an array of role cases.');
  } else {
    const [headers, ...rows] = parseCsv(text);
    if (!headers) throw new Error('The CSV file is empty.');
    const keys = headers.map((header) => header.trim().toLowerCase());
    cases = rows.map((row) => Object.fromEntries(keys.map((key, index) => [key, row[index]?.trim() || ''])));
  }
  const normalized = cases.map((item, index) => ({
    id: item.id || `batch-${index + 1}`,
    jd: item.jd || item.job_description || item.jobdescription,
    companyUrl: item.companyUrl || item.company_url || item.companywebsite || item.company_website,
    days: item.days || item.days_available || 3
  }));
  if (!normalized.length) throw new Error('Add at least one role case to the file.');
  const invalid = normalized.find((item) => !item.jd || !item.companyUrl);
  if (invalid) throw new Error('Every row needs a job description (jd or job_description) and company URL (company_url).');
  return normalized;
}

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

function sourceUrl(source) {
  return typeof source === 'string' ? source : source?.url;
}

function Flashcard({ card, score, revealed, onReveal, onScore, onNext }) {
  return (
    <article className="flashcard border border-slate-200 bg-white p-5 shadow-sm">
      <p className="m-0 text-xs font-bold uppercase text-slate-500">Flashcard</p>
      <h3 className="mb-3 mt-2 text-base leading-6 text-ink">{card.front}</h3>
      {!revealed ? <button type="button" onClick={() => onReveal(card.id)} className="secondary-button border border-mint px-3 py-2 text-sm font-bold text-mint hover:bg-emerald-50">Reveal answer</button> : <>
        <p className="m-0 text-sm leading-6 text-slate-600">{card.back}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex gap-2" aria-label={`Set confidence for ${card.front}`}>
            {[1, 2, 3].map((value) => (
              <button key={value} type="button" onClick={() => onScore(card.id, value)} className={`h-8 w-8 rounded border text-sm font-bold ${score === value ? 'border-mint bg-mint text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-mint'}`} aria-label={`Confidence ${value} out of 3`}>
                {value}
              </button>
            ))}
          </div>
          <button type="button" onClick={onNext} className="link-button text-sm font-bold text-mint underline">Skip for now</button>
        </div>
      </>}
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
      <label className="mt-3 block text-xs font-bold uppercase text-slate-500">Category<select aria-label={`Category for ${question.id}`} value={question.category} onChange={(event) => onChange({ category: event.target.value })} className="ml-2 border border-slate-300 bg-white px-2 py-1 text-sm font-normal normal-case text-slate-700"><option value="technical">Technical</option><option value="behavioural">Behavioural</option><option value="system-design">System design</option><option value="company-fit">Company fit</option></select></label>
      <textarea aria-label={`Question ${question.id}`} value={question.prompt} onChange={(event) => onChange({ prompt: event.target.value })} className="mt-3 min-h-20 w-full resize-y border border-slate-300 p-3 text-sm leading-6" />
      <textarea aria-label={`Answer outline for ${question.id}`} value={question.answer_outline} onChange={(event) => onChange({ answer_outline: event.target.value })} className="mt-3 min-h-20 w-full resize-y border border-slate-300 p-3 text-sm leading-6 text-slate-600" />
    </article>
  );
}

function FlashcardEditor({ card, onChange, onDelete }) {
  return (
    <article className="question-editor border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3"><p className="m-0 text-xs font-bold uppercase text-slate-500">{card.id}</p><button type="button" onClick={onDelete} className="text-sm font-bold text-rose-700">Delete</button></div>
      <textarea aria-label={`Flashcard front ${card.id}`} value={card.front} onChange={(event) => onChange({ front: event.target.value })} className="mt-3 min-h-16 w-full resize-y border border-slate-300 p-3 text-sm leading-6" />
      <textarea aria-label={`Flashcard back ${card.id}`} value={card.back} onChange={(event) => onChange({ back: event.target.value })} className="mt-3 min-h-16 w-full resize-y border border-slate-300 p-3 text-sm leading-6 text-slate-600" />
    </article>
  );
}

export default function HomePage() {
  const [form, setForm] = useState({ companyUrl: 'https://example.com', days: '3', jd: SAMPLE_JD });
  const [kit, setKit] = useState(null);
  const [scores, setScores] = useState({});
  const [revealedCardIds, setRevealedCardIds] = useState([]);
  const [coveredCardIds, setCoveredCardIds] = useState([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
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
  const [regeneratingSchedule, setRegeneratingSchedule] = useState(false);
  const [questionRevision, setQuestionRevision] = useState(0);
  const [selectedQuestionCategory, setSelectedQuestionCategory] = useState('technical');
  const [generationProgress, setGenerationProgress] = useState([]);
  const [buildingKit, setBuildingKit] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState([]);

  const practiceQueue = useMemo(() => {
    if (!kit) return [];
    return [...kit.flashcards].sort((a, b) => {
      const aCovered = coveredCardIds.includes(a.id) ? 1 : 0;
      const bCovered = coveredCardIds.includes(b.id) ? 1 : 0;
      return aCovered - bCovered || (scores[a.id] ?? 0) - (scores[b.id] ?? 0);
    });
  }, [kit, scores, coveredCardIds]);
  const activePracticeCard = practiceQueue[practiceIndex % Math.max(practiceQueue.length, 1)] || null;
  const weakSpots = useMemo(() => kit ? deriveWeakSpots(kit.flashcards, scores) : [], [kit, scores]);
  const skippedResearchSources = kit?.research_audit?.fetch_errors || [];

  const regenerableCategories = useMemo(() => {
    if (!kit) return [];
    return [...new Set(kit.questions
      .filter((question) => !question.id.startsWith('custom-'))
      .map((question) => question.category)
      .filter((category) => ['technical', 'behavioural'].includes(category)))];
  }, [kit]);

  useEffect(() => { refreshAccount(); }, []);
  useEffect(() => {
    if (regenerableCategories.length && !regenerableCategories.includes(selectedQuestionCategory)) {
      setSelectedQuestionCategory(regenerableCategories[0]);
    }
  }, [regenerableCategories, selectedQuestionCategory]);

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
    if (buildingKit) return;
    setBuildingKit(true);
    setStatus('Building your kit...');
    setGenerationProgress([
      { label: 'Validating role details', state: 'done' },
      { label: 'Researching company context', state: 'active' },
      { label: 'Generating questions, flashcards, and schedule', state: 'pending' }
    ]);
    setError('');
    try {
      const response = await fetch('/api/kits', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not build preparation kit');
      setKit({ ...data.kit, editor_state: { pinned_question_ids: [], edited_question_ids: [] } });
      setSavedId(data.savedId);
      setPinnedQuestionIds([]);
      setEditedQuestionIds([]);
      setScores({});
      setRevealedCardIds([]);
      setCoveredCardIds([]);
      setPracticeIndex(0);
      setGenerationProgress([
        { label: 'Validating role details', state: 'done' },
        { label: 'Researching company context', state: 'done' },
        { label: 'Generating questions, flashcards, and schedule', state: 'done' }
      ]);
      setStatus(data.saved ? 'Kit ready and saved privately. Start with the must-have requirements.' : 'Kit ready. Sign in to save it privately.');
      if (data.saved) await refreshAccount();
    } catch (requestError) {
      setStatus('');
      setGenerationProgress((current) => current.map((step) => step.state === 'active' ? { ...step, state: 'failed' } : step));
      setError(requestError.message);
    } finally {
      setBuildingKit(false);
    }
  }

  async function importBatch(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBatchLoading(true);
    setError('');
    setBatchResults([]);
    try {
      const cases = parseBatchCases(await file.text(), file.name);
      const results = [];
      for (const [index, item] of cases.entries()) {
        setStatus(`Building kit ${index + 1} of ${cases.length}: ${item.id}`);
        const response = await fetch('/api/kits', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(item) });
        const data = await response.json();
        results.push(response.ok
          ? { id: item.id, status: 'ready', kit: { ...data.kit, editor_state: { pinned_question_ids: [], edited_question_ids: [] } }, savedId: data.savedId }
          : { id: item.id, status: 'failed', error: data.error || 'Could not build this kit' });
        setBatchResults([...results]);
      }
      const completed = results.filter((result) => result.status === 'ready');
      if (completed[0]) {
        setKit(completed[0].kit);
        setSavedId(completed[0].savedId || null);
        setPinnedQuestionIds([]);
        setEditedQuestionIds([]);
      }
      setStatus(`${completed.length} of ${cases.length} batch kit${cases.length === 1 ? '' : 's'} ready.${account ? ' Saved kits are available in your private workspace.' : ' Sign in to save future kits privately.'}`);
      if (account) await refreshAccount();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBatchLoading(false);
    }
  }

  function updateQuestion(id, patch) {
    setEditedQuestionIds((current) => current.includes(id) ? current : [...current, id]);
    setKit((current) => ({ ...current, questions: current.questions.map((question) => question.id === id ? { ...question, ...patch } : question) }));
  }

  function deleteQuestion(id) {
    setKit((current) => ({
      ...current,
      questions: current.questions.filter((question) => question.id !== id),
      schedule: { ...current.schedule, days: current.schedule.days.map((day) => ({ ...day, question_ids: day.question_ids.filter((questionId) => questionId !== id) })) }
    }));
    setPinnedQuestionIds((current) => current.filter((questionId) => questionId !== id));
    setEditedQuestionIds((current) => current.filter((questionId) => questionId !== id));
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
      const question = { id: `custom-${Date.now()}`, requirement_ids: requirement ? [requirement.id] : [], category: selectedQuestionCategory, prompt: 'Add your custom interview question', answer_outline: 'Add the answer structure and evidence you want to practice.', difficulty: 2 };
      return { ...current, questions: [...current.questions, question] };
    });
    setStatus('Custom question added at the bottom. Edit it, then pin it or save your changes.');
  }

  function revealCard(id) {
    setRevealedCardIds((current) => current.includes(id) ? current : [...current, id]);
  }

  function advancePractice() {
    setPracticeIndex((current) => practiceQueue.length > 1 ? (current + 1) % practiceQueue.length : 0);
  }

  function scoreCard(id, value) {
    setScores((current) => ({ ...current, [id]: value }));
    setCoveredCardIds((current) => current.includes(id) ? current : [...current, id]);
    setRevealedCardIds((current) => current.filter((cardId) => cardId !== id));
    setPracticeIndex(0);
  }

  function updateBrief(patch) {
    setKit((current) => ({ ...current, company_brief: { ...current.company_brief, ...patch } }));
  }

  function updateFlashcard(id, patch) {
    setKit((current) => ({ ...current, flashcards: current.flashcards.map((card) => card.id === id ? { ...card, ...patch } : card) }));
  }

  function addFlashcard() {
    setKit((current) => {
      const requirement = current.role.requirements.find((item) => item.priority === 'must') || current.role.requirements[0];
      const card = { id: `custom-card-${Date.now()}`, front: 'Add a flashcard prompt', back: 'Add the answer or cue you want to recall.', requirement_ids: requirement ? [requirement.id] : [] };
      return { ...current, flashcards: [...current.flashcards, card] };
    });
    setStatus('Custom flashcard added. Edit it, then save your changes.');
  }

  async function regenerateQuestionCategory() {
    if (!kit) return;
    if (!regenerableCategories.includes(selectedQuestionCategory)) {
      setStatus(`There are no generated ${selectedQuestionCategory} questions in this kit. Add a matching requirement to the job description, then build a new kit.`);
      return;
    }
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

  async function regenerateSchedule() {
    if (!kit) return;
    setRegeneratingSchedule(true);
    setError('');
    try {
      const response = await fetch('/api/schedule/regenerate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questions: kit.questions, requirements: kit.role.requirements, days: kit.schedule.days_available })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Schedule could not be regenerated');
      setKit((current) => ({ ...current, schedule: data.schedule }));
      setStatus('Schedule regenerated from the current questions and available days. Your brief, questions, and flashcards were preserved.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRegeneratingSchedule(false);
    }
  }

  async function saveChanges() {
    if (!account || !savedId || !kit) {
      setError('Sign in and create a kit before saving edits.');
      return;
    }
    setError('');
    const kitToSave = {
      ...kit,
      editor_state: { ...kit.editor_state, pinned_question_ids: pinnedQuestionIds, edited_question_ids: editedQuestionIds },
      practice_state: { confidence_by_flashcard_id: scores, covered_flashcard_ids: coveredCardIds }
    };
    const response = await fetch(`/api/kits/${savedId}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kit: kitToSave }) });
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
      setKit((current) => ({ ...current, company_brief: data.companyBrief, source: { ...current.source, pages_used: data.companyBrief.sources }, research_audit: data.audit }));
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
            <button type="submit" disabled={buildingKit} className="primary-button h-11 bg-mint px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">{buildingKit ? 'Generating kit...' : 'Create prep kit'}</button>
          </form>
          <div className="mt-5 border-t border-slate-200 pt-4">
            <label className="block text-sm font-semibold text-slate-700">Build several roles from a file
              <input type="file" accept=".json,.csv,application/json,text/csv" onChange={importBatch} disabled={batchLoading} className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-bold file:text-mint disabled:opacity-50" />
            </label>
            <p className="mb-0 mt-2 text-xs leading-5 text-slate-500">Upload JSON or CSV. Use <code>jd</code>, <code>company_url</code>, and optional <code>days</code> and <code>id</code> columns.</p>
          </div>
          {status && <p className="status mb-0 mt-4 text-sm font-semibold text-mint" role="status">{status}</p>}
          {error && <p className="error mb-0 mt-4 text-sm font-semibold text-rose-700" role="alert">{error}</p>}
          {batchResults.length > 0 && <ul className="mb-0 mt-3 grid list-none gap-2 p-0" aria-label="Batch generation results">{batchResults.map((result) => <li key={result.id} className={`border px-3 py-2 text-sm ${result.status === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>{result.id}: {result.status === 'ready' ? 'ready' : result.error}</li>)}</ul>}
          {account && savedKits.length > 0 && <div className="mt-5 border-t border-slate-200 pt-4"><p className="m-0 text-xs font-bold uppercase text-slate-500">Saved kits</p><ul className="mb-0 mt-2 grid list-none gap-2 p-0">{savedKits.slice(0, 4).map((saved) => <li key={saved.id}><button type="button" onClick={() => { setKit(saved.kit); setSavedId(saved.id); setPinnedQuestionIds(saved.kit.editor_state?.pinned_question_ids || []); setEditedQuestionIds(saved.kit.editor_state?.edited_question_ids || []); setScores(saved.kit.practice_state?.confidence_by_flashcard_id || {}); setCoveredCardIds(saved.kit.practice_state?.covered_flashcard_ids || []); setStatus('Saved kit loaded.'); }} className="w-full border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-ink hover:border-mint">{saved.kit.role.title}</button></li>)}</ul></div>}
        </section>

        <section aria-live="polite">
          {!kit ? (
            <div className="empty-state border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <h2 className="m-0 text-lg font-bold text-ink">Your focused plan will appear here</h2>
              <p className="mx-auto mb-0 mt-2 max-w-md text-sm leading-6 text-slate-600">The generator uses deterministic coverage checks so every must-have requirement has a matching question and a scheduled practice slot.</p>
            </div>
          ) : (
            <div className="output-stack grid gap-6">
              {generationProgress.length > 0 && <section className="panel border border-slate-200 bg-white p-5 shadow-sm" aria-label="Generation progress"><h2 className="m-0 text-lg font-bold text-ink">Generation progress</h2><ol className="mb-0 mt-3 grid list-none gap-2 p-0">{generationProgress.map((step) => <li key={step.label} className={`border-l-4 px-3 py-2 text-sm font-semibold ${step.state === 'done' ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : step.state === 'failed' ? 'border-rose-500 bg-rose-50 text-rose-900' : step.state === 'active' ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-300 bg-slate-50 text-slate-600'}`}>{step.state === 'done' ? 'Done: ' : step.state === 'active' ? 'Working: ' : step.state === 'failed' ? 'Failed: ' : 'Waiting: '}{step.label}</li>)}</ol></section>}
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
                <label className="mt-4 block text-xs font-bold uppercase text-slate-500">Company brief<textarea aria-label="Company brief summary" value={kit.company_brief.summary} onChange={(event) => updateBrief({ summary: event.target.value })} className="mt-2 min-h-20 w-full resize-y border border-slate-300 p-3 text-sm font-normal normal-case leading-6 text-slate-600" /></label>
                <label className="mt-3 block text-xs font-bold uppercase text-slate-500">What they do<textarea aria-label="What the company does" value={kit.company_brief.what_they_do} onChange={(event) => updateBrief({ what_they_do: event.target.value })} className="mt-2 min-h-16 w-full resize-y border border-slate-300 p-3 text-sm font-normal normal-case leading-6 text-slate-600" /></label>
                {sourceUrl(kit.company_brief.sources?.[0]) && <a className="mt-3 inline-block text-sm font-semibold text-mint underline" href={sourceUrl(kit.company_brief.sources[0])} target="_blank" rel="noreferrer">Source: {sourceUrl(kit.company_brief.sources[0])}</a>}
                {skippedResearchSources.length > 0 && <details className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"><summary className="cursor-pointer font-bold">Research notes: {skippedResearchSources.length} source{skippedResearchSources.length === 1 ? '' : 's'} skipped</summary><ul className="mb-0 mt-2 list-disc space-y-1 pl-5 leading-6">{skippedResearchSources.map((item, index) => <li key={`${item.url}-${index}`}><span className="font-semibold">{item.url}:</span> {item.error}</li>)}</ul></details>}
                {kit.company_brief.interview_process && <div className="mt-4 border-l-4 border-amber-400 bg-amber-50 px-3 py-3"><p className="m-0 text-xs font-bold uppercase tracking-wide text-amber-900">Public interview signals</p><textarea aria-label="Public interview signals" value={kit.company_brief.interview_process.summary} onChange={(event) => updateBrief({ interview_process: { ...kit.company_brief.interview_process, summary: event.target.value } })} className="mt-2 min-h-16 w-full resize-y border border-amber-200 bg-white p-3 text-sm leading-6 text-slate-700" />{kit.company_brief.interview_process.sources?.length > 0 && <ul className="mb-0 mt-3 grid list-none gap-1 p-0" aria-label="Public interview discussion sources">{kit.company_brief.interview_process.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-mint underline">{source.title || source.url}</a></li>)}</ul>}<p className="mb-0 mt-2 text-xs leading-5 text-amber-950">Community discussion is supplementary and is not treated as verified company policy.</p></div>}
              </div>

              <div className="two-column grid gap-6 xl:grid-cols-2">
                <section className="panel border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="m-0 text-lg font-bold text-ink">Requirements</h2>
                  {kit.role.extraction_note && <p className="mt-3 border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">{kit.role.extraction_note}</p>}
                  <div className="mt-3 border-b border-slate-100 pb-3 text-sm leading-6 text-slate-600"><p className="m-0"><span className="font-bold text-ink">Seniority:</span> {kit.role.seniority}</p>{kit.role.responsibilities.length > 0 && <><p className="mb-1 mt-3 font-bold text-ink">Role responsibilities</p><ul className="m-0 list-disc space-y-1 pl-5">{kit.role.responsibilities.map((responsibility) => <li key={responsibility}>{responsibility}</li>)}</ul></>}</div>
                  <ul className="requirements-list m-0 mt-3 list-none p-0">{kit.role.requirements.map((requirement) => <Requirement key={requirement.id} requirement={requirement} />)}</ul>
                </section>
                <section className="panel border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-lg font-bold text-ink">Practice schedule</h2><button type="button" onClick={regenerateSchedule} disabled={regeneratingSchedule} className="link-button text-sm font-bold text-mint underline disabled:opacity-50">{regeneratingSchedule ? 'Regenerating...' : 'Regenerate schedule'}</button></div>
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
                  <div className="toolbar flex flex-wrap gap-3"><button type="button" onClick={addQuestion} className="link-button text-sm font-bold text-mint underline">Add question</button><label className="text-sm font-semibold text-slate-700">Category<select value={selectedQuestionCategory} onChange={(event) => setSelectedQuestionCategory(event.target.value)} className="ml-2 border border-slate-300 bg-white px-2 py-1 text-sm">{regenerableCategories.map((category) => <option key={category} value={category}>{category === 'technical' ? 'Technical' : 'Behavioural'}</option>)}</select></label><button type="button" onClick={regenerateQuestionCategory} disabled={regeneratingQuestions || regenerableCategories.length === 0} className="link-button text-sm font-bold text-mint underline disabled:opacity-50">{regeneratingQuestions ? 'Regenerating...' : 'Regenerate category'}</button><button type="button" onClick={saveChanges} className="primary-button bg-mint px-3 py-2 text-sm font-bold text-white hover:bg-emerald-800">Save edits</button></div>
                </div>
                <div className="question-list grid gap-3">{kit.questions.map((question, index) => <QuestionEditor key={question.id} question={question} index={index} total={kit.questions.length} pinned={pinnedQuestionIds.includes(question.id)} onChange={(patch) => updateQuestion(question.id, patch)} onMove={(direction) => moveQuestion(question.id, direction)} onPin={() => setPinnedQuestionIds((current) => current.includes(question.id) ? current.filter((id) => id !== question.id) : [...current, question.id])} onDelete={() => deleteQuestion(question.id)} />)}</div>
              </section>

              <section>
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div><h2 className="m-0 text-lg font-bold text-ink">Practice cards</h2><p className="mb-0 mt-1 text-sm text-slate-600">Reveal the answer, rate your confidence, then the next weak or uncovered card comes forward.</p></div>
                  <span className="text-sm font-semibold text-slate-500">{coveredCardIds.length}/{kit.flashcards.length} covered</span>
                </div>
                {activePracticeCard && <Flashcard card={activePracticeCard} score={scores[activePracticeCard.id]} revealed={revealedCardIds.includes(activePracticeCard.id)} onReveal={revealCard} onScore={scoreCard} onNext={advancePractice} />}
              </section>

              <section className="border-l-4 border-coral bg-orange-50 px-4 py-4" aria-label="Weak spots report">
                <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="m-0 text-lg font-bold text-ink">Weak spots</h2><p className="mb-0 mt-1 text-sm text-slate-600">Your next practice session starts with cards you rated lowest.</p></div><span className="text-sm font-bold text-coral">{weakSpots.length} to revisit</span></div>
                {Object.keys(scores).length === 0 ? <p className="mb-0 mt-3 text-sm leading-6 text-slate-600">Rate a few flashcards to build a focused review list.</p> : weakSpots.length === 0 ? <p className="mb-0 mt-3 text-sm leading-6 text-slate-600">No cards are rated low. Keep practising to maintain that confidence.</p> : <ul className="mb-0 mt-3 grid list-none gap-2 p-0">{weakSpots.map((spot) => <li key={spot.id} className="border border-orange-200 bg-white px-3 py-2 text-sm text-slate-700">Confidence {spot.confidence}/3: {spot.front}</li>)}</ul>}
              </section>

              <section>
                <div className="section-header mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="m-0 text-lg font-bold text-ink">Flashcard editor</h2><p className="mb-0 mt-1 text-sm text-slate-600">Edit, add, or remove the cues used in practice mode.</p></div><button type="button" onClick={addFlashcard} className="link-button text-sm font-bold text-mint underline">Add flashcard</button></div>
                <div className="question-list grid gap-3">{kit.flashcards.map((card) => <FlashcardEditor key={card.id} card={card} onChange={(patch) => updateFlashcard(card.id, patch)} onDelete={() => setKit((current) => ({ ...current, flashcards: current.flashcards.filter((item) => item.id !== card.id) }))} />)}</div>
              </section>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
