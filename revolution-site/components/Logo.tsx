/** Logo oficial REVOLUÇÃO Jovem Teen (public/logo.png, fundo preto como o tema do site). */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'xl' }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`logo logo-${size}`} src={size === 'xl' ? '/logo.png' : '/logo-sm.png'} alt="Revolução Jovem Teen" width={size === 'xl' ? 700 : 200} height={size === 'xl' ? 596 : 170} decoding="async" />
  );
}
