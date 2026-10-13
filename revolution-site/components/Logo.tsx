/** Logo: chama (símbolo próprio) + nome "REVOLUTION" com "CONFERENCE" em vermelho. SVG/CSS puro, sem imagem externa. */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'xl' }) {
  return (
    <span className={`logo logo-${size}`}>
      <svg className="logo-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path d="M32 4c3 10 15 16 15 31a15 15 0 0 1-30 0c0-7 3-11 7-15 1 4 3 7 6 8-1-8 0-17 2-24z" fill="#ef4a2b" />
        <path d="M32 30c2 5 7 8 7 14a7 7 0 0 1-14 0c0-4 2-6 3-7 1 2 2 3 4 3-1-3-1-7 0-10z" fill="#fbe7d2" />
      </svg>
      <span className="logo-text" aria-hidden="true"><b>REVOLUTION</b><i>CONFERENCE</i></span>
    </span>
  );
}
