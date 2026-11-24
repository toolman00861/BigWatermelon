import type { Metadata } from "next";
import { AdminDesk } from "@/components/AdminDesk";

export const metadata: Metadata = {
  title: "玩家管理 · 合成大西瓜",
};

export default function AdminPage() {
  return <AdminDesk />;
}
