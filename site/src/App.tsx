import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import Home from "@/pages/Home";
import Photos from "@/pages/Photos";
import PhotoDetail from "@/pages/PhotoDetail";
import Videos from "@/pages/Videos";
import Community from "@/pages/Community";
import Admin from "@/pages/Admin";
import { Login, Signup } from "@/pages/Auth";
import { EventList, EventPage } from "@/pages/Events";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="fotos" element={<Photos />} />
            <Route path="fotos/:id" element={<PhotoDetail />} />
            <Route path="videos" element={<Videos />} />
            <Route path="comunidade" element={<Community />} />
            <Route path="eventos" element={<EventList />} />
            <Route path="eventos/:slug" element={<EventPage />} />
            <Route path="login" element={<Login />} />
            <Route path="cadastro" element={<Signup />} />
            <Route path="admin" element={<Admin />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
