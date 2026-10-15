import { createRoot } from 'react-dom/client';
import { VaporCountdown } from '../components/ui/countdown-vapor-digits';

const el = document.getElementById('vc-mount');
if (el) createRoot(el).render(<VaporCountdown targetDate="2026-10-17T18:00:00-03:00" />);
