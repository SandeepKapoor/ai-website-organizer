import { getFolderTree } from "@/lib/folderTree";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const folders = await getFolderTree();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar folders={folders} />
        {/* Independent scroll region from the sidebar — scrolling one never moves the other. */}
        <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
