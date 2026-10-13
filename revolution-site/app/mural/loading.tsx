import { Skeletons } from '@/components/States';
export default function Loading() { return <div className="wrap" role="status" aria-label="Carregando o mural"><Skeletons n={3} /></div>; }
