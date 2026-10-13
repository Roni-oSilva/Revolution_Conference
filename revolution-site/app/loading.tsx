import { Skeletons } from '@/components/States';
export default function Loading() { return <div className="wrap" role="status" aria-label="Carregando"><Skeletons n={2} /></div>; }
