import type { CvInput } from "@/lib/cv/types";
import type { CvTemplate } from "@/lib/cv/templates";
import ClassicPreview from "./preview/ClassicPreview";
import ModernPreview from "./preview/ModernPreview";
import SidebarPreview from "./preview/SidebarPreview";

// "Tờ giấy" CV: nền trắng bo góc + bóng; nội dung theo mẫu (slate/indigo cố ý ngoài token).
export default function CvPreview({ cv, template = "classic" }: { cv: CvInput; template?: CvTemplate }) {
  return (
    <div className="mx-auto w-full max-w-[210mm] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {template === "modern" ? (
        <ModernPreview cv={cv} />
      ) : template === "sidebar" ? (
        <SidebarPreview cv={cv} />
      ) : (
        <ClassicPreview cv={cv} />
      )}
    </div>
  );
}
