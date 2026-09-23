import './globals.css';

const criticalCss = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f4f7fb; color: #102a43; font-family: Arial, Helvetica, sans-serif; }
  button, input, textarea { font: inherit; }
  button { cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: .55; }
  .app-shell { min-height: 100vh; }
  .topbar { border-bottom: 1px solid #dbe4ee; background: #fff; }
  .topbar-inner { display: flex; max-width: 1152px; margin: 0 auto; padding: 20px; align-items: center; justify-content: space-between; gap: 16px; }
  .brand-label { margin: 0; color: #138a72; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
  .brand-title { margin: 2px 0 0; color: #102a43; font-size: 20px; }
  .topbar-note { color: #64748b; font-size: 14px; font-weight: 600; }
  .app-grid { display: grid; grid-template-columns: minmax(280px, .9fr) minmax(0, 1.4fr); gap: 24px; max-width: 1152px; margin: 0 auto; padding: 32px 20px; }
  .panel { border: 1px solid #dbe4ee; background: #fff; padding: 20px; box-shadow: 0 1px 2px rgba(15, 23, 42, .06); }
  .builder-panel { align-self: start; }
  .builder-panel h2, .kit-output h2 { margin-top: 0; color: #102a43; }
  .builder-panel > p { color: #475569; font-size: 14px; line-height: 1.6; }
  .account-panel { margin: 20px 0; padding: 16px 0; border-top: 1px solid #dbe4ee; border-bottom: 1px solid #dbe4ee; }
  .account-panel input, .builder-form input, .builder-form textarea, .question-editor textarea { width: 100%; border: 1px solid #cbd5e1; border-radius: 2px; padding: 10px 12px; background: #fff; color: #102a43; }
  .account-panel input { margin-top: 8px; }
  .account-actions, .toolbar { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
  .link-button { border: 0; background: transparent; padding: 0; color: #138a72; font-size: 14px; font-weight: 700; text-decoration: underline; }
  .builder-form { display: grid; gap: 16px; }
  .field { display: grid; gap: 6px; color: #334155; font-size: 14px; font-weight: 700; }
  .builder-form textarea { min-height: 288px; resize: vertical; line-height: 1.55; }
  .primary-button { min-height: 44px; border: 1px solid #138a72; background: #138a72; padding: 10px 16px; color: #fff; font-size: 14px; font-weight: 800; }
  .primary-button:hover { background: #0f765f; }
  .status { margin: 16px 0 0; color: #138a72; font-size: 14px; font-weight: 700; }
  .error { margin: 16px 0 0; color: #be123c; font-size: 14px; font-weight: 700; }
  .empty-state { border: 1px dashed #94a3b8; background: #fff; padding: 64px 24px; text-align: center; }
  .empty-state p { max-width: 520px; margin: 8px auto 0; color: #475569; line-height: 1.6; }
  .output-stack { display: grid; gap: 24px; }
  .summary-header, .section-header { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .summary-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .coverage-badge { border: 1px solid #a7f3d0; background: #ecfdf5; padding: 8px 12px; color: #166534; font-size: 14px; font-weight: 800; }
  .secondary-button { border: 1px solid #138a72; background: #fff; padding: 8px 12px; color: #138a72; font-size: 14px; font-weight: 800; }
  .two-column { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
  .requirements-list, .schedule-list, .saved-list { margin: 12px 0 0; padding: 0; list-style: none; }
  .requirements-list li { border-bottom: 1px solid #f1f5f9; padding: 12px 0; }
  .requirements-list li:last-child { border: 0; }
  .schedule-list { display: grid; gap: 12px; }
  .schedule-list li { border-left: 4px solid #dc5f47; background: #fff7ed; padding: 12px; }
  .question-list, .practice-grid { display: grid; gap: 12px; }
  .practice-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .question-editor, .flashcard { border: 1px solid #dbe4ee; background: #fff; padding: 16px; box-shadow: 0 1px 2px rgba(15, 23, 42, .05); }
  .question-editor textarea { margin-top: 12px; min-height: 80px; line-height: 1.5; }
  .saved-list button { width: 100%; border: 1px solid #dbe4ee; background: #fff; padding: 10px 12px; color: #102a43; font-size: 14px; font-weight: 700; text-align: left; }
  @media (max-width: 860px) { .app-grid { grid-template-columns: 1fr; padding: 20px; } .two-column, .practice-grid { grid-template-columns: 1fr; } .topbar-note { display: none; } }
`;

export const metadata = {
  title: 'Trao Prep Kit',
  description: 'Build an evidence-linked interview preparation kit.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><style dangerouslySetInnerHTML={{ __html: criticalCss }} />{children}</body>
    </html>
  );
}
