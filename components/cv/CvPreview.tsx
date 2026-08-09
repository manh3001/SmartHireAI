import type { CvInput } from "@/lib/cv/types";
import type { CvTemplate } from "@/lib/cv/templates";
import { normalizeAccent, accentById, type CvAccent } from "@/lib/cv/accents";
import { normalizeFont, fontById, type CvFont } from "@/lib/cv/fonts";
import ClassicPreview from "./preview/ClassicPreview";
import ModernPreview from "./preview/ModernPreview";
import SidebarPreview from "./preview/SidebarPreview";

// "Tờ giấy" CV: nền trắng bo góc + bóng; nội dung theo mẫu (slate + accent cố ý ngoài token).
export default function CvPreview({
  cv,
  template = "classic",
  accent = "indigo",
  font = "roboto",
}: {
  cv: CvInput;
  template?: CvTemplate;
  accent?: CvAccent;
  font?: CvFont;
}) {
  const a = accentById(normalizeAccent(accent));
  const stack = fontById(normalizeFont(font)).cssStack;
  return (
    <div
      className="mx-auto w-full max-w-[210mm] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      style={stack ? { fontFamily: stack } : undefined}
    >
      {template === "modern" ? (
        <ModernPreview cv={cv} accent={a} />
      ) : template === "sidebar" ? (
        <SidebarPreview cv={cv} accent={a} />
      ) : (
        <ClassicPreview cv={cv} />
      )}
    </div>
  );
}
