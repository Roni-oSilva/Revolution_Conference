import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { isConfigured } from "@/lib/supabase";

const links = [["/fotos", "Fotos"], ["/videos", "Vídeos"], ["/comunidade", "Comunidade"], ["/eventos", "Eventos"]];

export function Layout() {
  const { profile, isAdmin, signOut } = useAuth();
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-black/55 px-4 py-2 backdrop-blur">
        <Link to="/" className="font-display text-2xl">Apaixonados pela Presença</Link>
        <nav className="flex flex-wrap items-center gap-4 text-lg">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "text-[#ff5a3c]" : "hover:text-[#ff5a3c]")}>{label}</NavLink>
          ))}
          {isAdmin && <NavLink to="/admin" className="text-yellow-300">Admin</NavLink>}
          {profile ? (
            <button onClick={signOut} className="btn-ghost">Sair ({profile.name.split(" ")[0]})</button>
          ) : isConfigured ? (
            <Link to="/login" className="btn-ghost">Entrar</Link>
          ) : null}
        </nav>
      </header>
      <Outlet />
      <footer className="px-6 py-10 text-center text-sm opacity-60">
        Revolução Jovem Teen · Ulianópolis — PA
      </footer>
    </>
  );
}

export function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-24">
      <h1 className="mb-6 text-5xl md:text-7xl">{title}</h1>
      {!isConfigured && (
        <p className="mb-6 border border-yellow-400/50 p-3 text-yellow-200">
          Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja .env.example).
        </p>
      )}
      {children}
    </main>
  );
}
